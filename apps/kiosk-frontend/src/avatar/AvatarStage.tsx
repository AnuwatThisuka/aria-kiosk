import { useEffect, useRef } from "react";
import {
  AvatarController,
  CanvasAvatar,
  type MouthEnvelope,
} from "@aria/avatar-engine";

/**
 * Mounts the procedural avatar and runs its render loop for the lifetime of
 * the component. The loop runs continuously: while Aria speaks it lip-syncs
 * from `envelope`; otherwise the envelope decays shut and only idle
 * blink/breathing plays, which serves as attract mode.
 */
export function AvatarStage({ envelope }: { envelope: MouthEnvelope }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new CanvasAvatar();
    renderer.mount(container);
    const controller = new AvatarController(renderer, envelope);
    controller.start();
    return () => {
      controller.stop();
      renderer.destroy();
    };
  }, [envelope]);

  return <div ref={containerRef} className="avatar-stage" aria-hidden="true" />;
}
