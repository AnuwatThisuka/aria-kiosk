import { useEffect, useState } from "react";
import type { MediaHit } from "../lib/orchestrator";

/** How long a media asset stays on screen after it appears (ms). */
const VISIBLE_MS = 8000;

/**
 * Fades a contextual image/video in when it arrives and out after a short
 * hold. This approximates "synced to speech" — media surfaces as the sentence
 * describing it is spoken, then clears. Tighter frame-accurate sync would need
 * per-word timestamps the Live API doesn't currently expose.
 */
export function MediaPanel({ media }: { media: MediaHit | null }) {
  const [shown, setShown] = useState<MediaHit | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!media) return;
    setShown(media);
    setVisible(true);
    const hide = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(hide);
  }, [media]);

  if (!shown) return null;

  return (
    <div className={`media-panel${visible ? " show" : ""}`}>
      {shown.type === "video" ? (
        <video src={shown.url} autoPlay muted loop playsInline />
      ) : (
        <img src={shown.url} alt={shown.title ?? shown.description} />
      )}
      {shown.title && <span className="media-caption">{shown.title}</span>}
    </div>
  );
}
