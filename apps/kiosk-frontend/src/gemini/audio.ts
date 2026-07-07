import { INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE } from "./model";

/* ----------------------------- pure codecs ------------------------------ */

/** Convert normalized Float32 [-1,1] samples to little-endian PCM16 bytes. */
export function floatToPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Convert PCM16 samples back to normalized Float32 [-1,1]. */
export function pcm16ToFloat(samples: Int16Array): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i]! / 0x8000;
  }
  return out;
}

/** Base64-encode raw bytes (browser/Bun `btoa`, chunked to avoid arg limits). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Decode base64 to raw bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encode mic Float32 samples to a base64 PCM16 chunk for `sendRealtimeInput`. */
export function encodeMicChunk(samples: Float32Array): string {
  const pcm = floatToPcm16(samples);
  return bytesToBase64(new Uint8Array(pcm.buffer));
}

/** Decode a base64 PCM16 chunk from the model into Float32 samples. */
export function decodeAudioChunk(b64: string): Float32Array {
  const bytes = base64ToBytes(b64);
  // Reinterpret bytes as Int16 (little-endian). Copy to guarantee alignment.
  const aligned = new Uint8Array(bytes);
  const int16 = new Int16Array(
    aligned.buffer,
    aligned.byteOffset,
    Math.floor(aligned.byteLength / 2),
  );
  return pcm16ToFloat(int16);
}

/* --------------------------- runtime (browser) --------------------------- */

/**
 * Gapless PCM16 playback queue for the model's 24kHz audio output. Schedules
 * each decoded chunk back-to-back on a dedicated AudioContext.
 */
export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private nextStartTime = 0;

  /** @param onSamples tap on each decoded chunk (e.g. to drive lip-sync). */
  constructor(private readonly onSamples?: (samples: Float32Array) => void) {}

  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    return this.ctx;
  }

  /** Queue a base64 PCM16 chunk for playback. */
  enqueue(b64: string): void {
    const samples = decodeAudioChunk(b64);
    if (samples.length === 0) return;
    this.onSamples?.(samples);
    const ctx = this.context();
    const buffer = ctx.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const start = Math.max(ctx.currentTime, this.nextStartTime);
    src.start(start);
    this.nextStartTime = start + buffer.duration;
  }

  /** Stop playback immediately (barge-in / interrupt) and reset the queue. */
  reset(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.nextStartTime = 0;
  }
}

/**
 * Microphone capture that emits base64 PCM16 chunks at 16kHz. Uses a
 * ScriptProcessorNode — deprecated but dependency-free and fully supported in
 * the kiosk's single target (Chrome). Swap for an AudioWorklet if latency
 * becomes an issue.
 */
export class MicCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private readonly onChunk: (b64: string) => void) {}

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Forcing sampleRate makes the context resample the mic to 16kHz for us.
    this.ctx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      this.onChunk(encodeMicChunk(input));
    };
    this.source.connect(this.node);
    this.node.connect(this.ctx.destination);
  }

  stop(): void {
    this.node?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.ctx) void this.ctx.close();
    this.node = null;
    this.source = null;
    this.stream = null;
    this.ctx = null;
  }
}
