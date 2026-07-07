import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { deriveMediaQuery } from "@aria/media-search";
import {
  fetchGeminiToken,
  findMedia,
  ground,
  type MediaHit,
} from "../lib/orchestrator";
import { AudioPlayer, MicCapture } from "./audio";
import { GEMINI_LIVE_MODEL, INPUT_SAMPLE_RATE } from "./model";

export type SessionState =
  "idle" | "connecting" | "live" | "reconnecting" | "error" | "closed";

export interface AriaLiveHandlers {
  onStateChange?: (state: SessionState) => void;
  /** Streaming transcript of what the visitor said. */
  onUserTranscript?: (text: string, finished: boolean) => void;
  /** Streaming transcript of what the avatar is saying. */
  onModelTranscript?: (text: string, finished: boolean) => void;
  /** True while a grounding lookup degraded (retrieval unavailable). */
  onDegraded?: () => void;
  /** Decoded model audio chunks — feed to the avatar lip-sync envelope. */
  onAudioSamples?: (samples: Float32Array) => void;
  /** Model was interrupted (barge-in) — flush avatar mouth/audio. */
  onInterrupt?: () => void;
  /** Contextual media to show for the current sentence, or null to clear. */
  onMedia?: (media: MediaHit | null) => void;
  onError?: (err: unknown) => void;
}

const BASE_SYSTEM_INSTRUCTION =
  "You are Aria, a friendly, concise AI receptionist on a lobby kiosk. " +
  "Answer visitor questions about the company using any provided knowledge " +
  "notes. Keep replies short and speak naturally. If you are unsure, offer " +
  "to check rather than inventing details.";

/**
 * Note injected when knowledge retrieval is down so the model degrades
 * gracefully ("let me check on that") instead of inventing an answer.
 */
const DEGRADED_NOTE =
  "(System: the knowledge base is temporarily unavailable. Tell the visitor " +
  "you'll check on that and avoid stating specific facts you're unsure of.)";

const MAX_RECONNECT_ATTEMPTS = 5;

/** Exponential backoff with a ceiling. */
function reconnectDelay(attempt: number): number {
  return Math.min(500 * 2 ** (attempt - 1), 8000);
}

/** The conversation session surface the UI depends on. */
export interface LiveSession {
  connect(): Promise<void>;
  sendText(text: string): Promise<void>;
  close(): void;
}

/** Builds a session from handlers. Overridable for tests via the window hook. */
export type SessionFactory = (handlers: AriaLiveHandlers) => LiveSession;

declare global {
  interface Window {
    /** E2E seam: when set, replaces the real Gemini session (see e2e/). */
    __ARIA_SESSION_FACTORY__?: SessionFactory;
  }
}

/**
 * Create a live session — the real Gemini-backed one, unless a test has
 * installed a `window.__ARIA_SESSION_FACTORY__` override. Prod bundles never
 * set that hook, so this is a no-cost seam.
 */
export function createLiveSession(handlers: AriaLiveHandlers): LiveSession {
  const override =
    typeof window !== "undefined" ? window.__ARIA_SESSION_FACTORY__ : undefined;
  return override ? override(handlers) : new AriaLiveSession(handlers);
}

/**
 * Core conversation loop: mints a token, opens a Gemini Live session, streams
 * mic audio in and plays audio out, grounds each visitor utterance, and
 * surfaces contextual media per spoken sentence. Auto-reconnects on unexpected
 * transport drops so the kiosk recovers unattended.
 */
export class AriaLiveSession implements LiveSession {
  private session: Session | null = null;
  private readonly player: AudioPlayer;
  private readonly mic = new MicCapture((b64) => this.sendAudio(b64));
  private userBuffer = "";
  private modelBuffer = "";
  private state: SessionState = "idle";
  private intentionalClose = false;
  private reconnectAttempts = 0;
  private micStarted = false;

  constructor(private readonly handlers: AriaLiveHandlers = {}) {
    this.player = new AudioPlayer(handlers.onAudioSamples);
  }

  private setState(state: SessionState): void {
    this.state = state;
    this.handlers.onStateChange?.(state);
  }

  async connect(): Promise<void> {
    if (this.state === "connecting" || this.state === "live") return;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    await this.openSession();
  }

  /** Open (or re-open) the Live session. Mic is started once and reused. */
  private async openSession(): Promise<void> {
    this.setState(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    try {
      const { token } = await fetchGeminiToken();
      // Ephemeral tokens are only served on the v1alpha API surface — without
      // this the Live connect fails and the session falls into a reconnect loop.
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: "v1alpha" },
      });
      this.session = await ai.live.connect({
        model: GEMINI_LIVE_MODEL,
        callbacks: {
          onopen: () => {
            this.reconnectAttempts = 0;
            this.setState("live");
          },
          onmessage: (msg) => this.handleMessage(msg),
          onerror: (e) => this.handleClose(e),
          onclose: () => this.handleClose(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: BASE_SYSTEM_INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });
      if (!this.micStarted) {
        await this.mic.start();
        this.micStarted = true;
      }
    } catch (err) {
      this.handleClose(err);
    }
  }

  /** Handle a transport close/error: reconnect unless intentionally closed. */
  private handleClose(err?: unknown): void {
    if (this.intentionalClose) {
      this.setState("closed");
      return;
    }
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.fail(err ?? new Error("reconnect attempts exhausted"));
      return;
    }
    this.reconnectAttempts++;
    this.player.reset();
    this.setState("reconnecting");
    setTimeout(
      () => void this.openSession(),
      reconnectDelay(this.reconnectAttempts),
    );
  }

  private sendAudio(b64: string): void {
    // The mic keeps capturing across reconnects/close, but the socket is only
    // writable while "live" — dropping frames otherwise avoids "WebSocket is
    // already in CLOSING or CLOSED state" on a stale/closing session.
    if (this.state !== "live" || !this.session) return;
    try {
      this.session.sendRealtimeInput({
        audio: { data: b64, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
      });
    } catch {
      // Socket closed between the state check and the send — ignore; the
      // reconnect path will re-establish the session.
    }
  }

  private handleMessage(msg: LiveServerMessage): void {
    const content = msg.serverContent;

    // Barge-in: the model was interrupted — flush queued audio + mouth.
    if (content?.interrupted) {
      this.player.reset();
      this.handlers.onInterrupt?.();
    }

    // Model audio out.
    if (msg.data) this.player.enqueue(msg.data);

    // Visitor speech transcript.
    const input = content?.inputTranscription;
    if (input?.text) {
      this.userBuffer += input.text;
      this.handlers.onUserTranscript?.(this.userBuffer, false);
    }
    if (input?.finished && this.userBuffer.trim()) {
      const utterance = this.userBuffer.trim();
      this.userBuffer = "";
      this.handlers.onUserTranscript?.(utterance, true);
      void this.injectGrounding(utterance);
    }

    // Avatar speech transcript — buffer it so we can search media on the
    // whole sentence, not fragmented chunks.
    const output = content?.outputTranscription;
    if (output?.text) {
      this.modelBuffer += output.text;
      this.handlers.onModelTranscript?.(output.text, Boolean(output.finished));
    }

    // Flush the model sentence on transcription-finished or turn end, then
    // resolve contextual media for what was just said.
    if (
      (output?.finished || content?.turnComplete) &&
      this.modelBuffer.trim()
    ) {
      const sentence = this.modelBuffer.trim();
      this.modelBuffer = "";
      void this.resolveMedia(sentence);
    }
  }

  /**
   * Resolve contextual media for a spoken sentence and hand it to the UI.
   * Derives the query from any `[visual: …]` tags, else the sentence itself.
   */
  private async resolveMedia(sentence: string): Promise<void> {
    if (!this.handlers.onMedia) return;
    const query = deriveMediaQuery(sentence);
    if (!query) return;
    const result = await findMedia(query);
    if (result.media) this.handlers.onMedia(result.media);
  }

  /**
   * Retrieve company knowledge for the utterance and feed it into the session
   * context. On a degraded lookup, inject a note so the model says it'll check
   * rather than fabricating. NOTE: with live VAD the model may begin answering
   * before this lands — acceptable for the voice loop; the typed path
   * ({@link sendText}) has no such race.
   */
  private async injectGrounding(utterance: string): Promise<void> {
    const result = await ground(utterance);
    if (result.degraded) this.handlers.onDegraded?.();
    const note = result.degraded ? DEGRADED_NOTE : result.grounding;
    if (note && this.session) {
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: note }] }],
        turnComplete: false,
      });
    }
  }

  /** Text-only fallback: ground the typed question, then ask the model. */
  async sendText(text: string): Promise<void> {
    const question = text.trim();
    if (!question || !this.session) return;
    const result = await ground(question);
    if (result.degraded) this.handlers.onDegraded?.();
    const context = result.degraded ? DEGRADED_NOTE : result.grounding;
    const parts = context
      ? [{ text: context }, { text: question }]
      : [{ text: question }];
    this.session.sendClientContent({
      turns: [{ role: "user", parts }],
      turnComplete: true,
    });
  }

  private fail(err: unknown): void {
    this.handlers.onError?.(err);
    this.setState("error");
  }

  close(): void {
    this.intentionalClose = true;
    this.mic.stop();
    this.micStarted = false;
    this.player.reset();
    this.session?.close();
    this.session = null;
    this.setState("closed");
  }
}
