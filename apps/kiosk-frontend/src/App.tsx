import { useEffect, useState } from "react";
import { AvatarStage } from "./avatar/AvatarStage";
import { MediaPanel } from "./media/MediaPanel";
import { ScreenWakeLock } from "./kiosk/wakeLock";
import { useKiosk } from "./state/useKiosk";

/**
 * Aria Kiosk frontend — full experience.
 *
 * Phase 1 conversation loop + Phase 2 avatar/lip-sync + Phase 3 contextual
 * media + Phase 4 wake/idle/timeout state machine and kiosk hardening. The
 * lifecycle lives entirely in {@link useKiosk}; this component only renders the
 * current state and forwards wake/end/text-input intents.
 */
export function App() {
  const kiosk = useKiosk();
  const [typed, setTyped] = useState("");

  // Keep the display awake for unattended kiosk operation.
  useEffect(() => {
    const lock = new ScreenWakeLock();
    lock.start();
    return () => lock.stop();
  }, []);

  const submitTyped = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = typed.trim();
    if (!q) return;
    setTyped("");
    await kiosk.sendText(q);
  };

  const inConversation =
    kiosk.state === "connecting" ||
    kiosk.state === "active" ||
    kiosk.state === "reconnecting";

  return (
    <main className="kiosk" data-state={kiosk.state}>
      <AvatarStage envelope={kiosk.envelope} />
      <MediaPanel media={kiosk.media} />

      {kiosk.state === "idle" && (
        <button className="wake" onClick={kiosk.wake}>
          Tap to talk to Aria
        </button>
      )}

      {kiosk.state === "goodbye" && (
        <p className="goodbye">Thanks — see you soon! 👋</p>
      )}

      {inConversation && (
        <>
          <p className="status" data-state={kiosk.state}>
            {kiosk.state === "connecting" && "Connecting…"}
            {kiosk.state === "reconnecting" && "Reconnecting…"}
            {kiosk.state === "active" && "Listening"}
            {kiosk.degraded ? " · knowledge base offline" : ""}
          </p>

          <section className="transcript">
            {kiosk.userText && (
              <p className="you">
                <span>You</span> {kiosk.userText}
              </p>
            )}
            {kiosk.modelText && (
              <p className="aria">
                <span>Aria</span> {kiosk.modelText}
              </p>
            )}
          </section>

          <form onSubmit={submitTyped} className="text-fallback">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Or type your question…"
              disabled={kiosk.state !== "active"}
              aria-label="Type your question"
            />
            <button
              type="submit"
              disabled={kiosk.state !== "active" || !typed.trim()}
            >
              Ask
            </button>
          </form>

          <button className="end" onClick={kiosk.end}>
            End
          </button>
        </>
      )}

      {kiosk.error && <p className="error">{kiosk.error}</p>}
    </main>
  );
}
