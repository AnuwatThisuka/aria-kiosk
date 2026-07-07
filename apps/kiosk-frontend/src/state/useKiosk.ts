import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { MouthEnvelope } from "@aria/avatar-engine";
import { createLiveSession, type LiveSession } from "../gemini/liveClient";
import type { MediaHit } from "../lib/orchestrator";
import {
  GOODBYE_HOLD_MS,
  isIdleTimedOut,
  kioskTransition,
  type KioskState,
} from "./kioskMachine";

export interface Kiosk {
  state: KioskState;
  envelope: MouthEnvelope;
  userText: string;
  modelText: string;
  media: MediaHit | null;
  degraded: boolean;
  error: string | null;
  /** Touch/tap wake trigger: start a conversation from attract mode. */
  wake: () => void;
  /** End the conversation (visitor pressed End). */
  end: () => void;
  /** Typed-question fallback through the same grounding path. */
  sendText: (q: string) => Promise<void>;
}

/**
 * Owns the whole kiosk conversation lifecycle: the {@link kioskTransition}
 * state machine, the Gemini Live session, the inactivity timeout, and the
 * goodbye hold. Components read state and call `wake`/`end`/`sendText`.
 */
export function useKiosk(): Kiosk {
  const [state, dispatch] = useReducer(kioskTransition, "idle");
  const sessionRef = useRef<LiveSession | null>(null);
  const envelopeRef = useRef<MouthEnvelope>(new MouthEnvelope());
  const lastActivityRef = useRef<number>(Date.now());

  const [userText, setUserText] = useState("");
  const [modelText, setModelText] = useState("");
  const [media, setMedia] = useState<MediaHit | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const closeSession = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
  }, []);

  // Inactivity watchdog: auto-end after INACTIVITY_TIMEOUT_MS of silence.
  useEffect(() => {
    if (state !== "active") return;
    const id = setInterval(() => {
      if (isIdleTimedOut(lastActivityRef.current, Date.now())) {
        dispatch({ type: "timeout" });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [state]);

  // Goodbye hold: tear down the session, then return to attract mode.
  useEffect(() => {
    if (state !== "goodbye") return;
    closeSession();
    const id = setTimeout(() => {
      setUserText("");
      setModelText("");
      setMedia(null);
      setDegraded(false);
      dispatch({ type: "reset" });
    }, GOODBYE_HOLD_MS);
    return () => clearTimeout(id);
  }, [state, closeSession]);

  // Tear down on unmount.
  useEffect(() => closeSession, [closeSession]);

  const wake = useCallback(() => {
    if (state !== "idle") return;
    setError(null);
    setUserText("");
    setModelText("");
    setMedia(null);
    setDegraded(false);
    markActivity();
    dispatch({ type: "wake" });

    const session = createLiveSession({
      onStateChange: (s) => {
        if (s === "live") dispatch({ type: "connected" });
        else if (s === "reconnecting") dispatch({ type: "disconnected" });
        else if (s === "error") dispatch({ type: "error" });
      },
      onUserTranscript: (text) => {
        setUserText(text);
        markActivity();
      },
      onModelTranscript: (text, finished) => {
        setModelText((prev) => (finished ? prev + text : text));
        markActivity();
      },
      onDegraded: () => setDegraded(true),
      onAudioSamples: (samples) => envelopeRef.current.push(samples),
      onInterrupt: () => envelopeRef.current.reset(),
      onMedia: (hit) => {
        setMedia(hit);
        markActivity();
      },
      onError: (err) =>
        setError(err instanceof Error ? err.message : String(err)),
    });
    sessionRef.current = session;
    void session.connect();
  }, [state, markActivity]);

  const end = useCallback(() => dispatch({ type: "end" }), []);

  const sendText = useCallback(
    async (q: string) => {
      markActivity();
      await sessionRef.current?.sendText(q);
    },
    [markActivity],
  );

  return {
    state,
    envelope: envelopeRef.current,
    userText,
    modelText,
    media,
    degraded,
    error,
    wake,
    end,
    sendText,
  };
}
