import { useEffect, useState, useCallback, useRef } from "react";

const MIN_DISPLAY_MS = 5500;
const MIN_DRAG_PX = 40;

type ExitDirection = "up" | "left" | "right";

type Props = {
  onDismissRequest: () => void;
};

export function IntroScreen({ onDismissRequest }: Props) {
  const [canDismiss, setCanDismiss] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<ExitDirection>("up");
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setCanDismiss(true), MIN_DISPLAY_MS);
    return () => clearTimeout(t);
  }, []);

  const startExit = useCallback(
    (direction: ExitDirection) => {
      if (!canDismiss || exiting) return;
      setExiting(true);
      setExitDirection(direction);
      onDismissRequest();
    },
    [canDismiss, exiting, onDismissRequest]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canDismiss || exiting) return;
      dragStart.current = { x: e.clientX, y: e.clientY };
    },
    [canDismiss, exiting]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!canDismiss || exiting || !dragStart.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dy) >= MIN_DRAG_PX && Math.abs(dy) >= Math.abs(dx)) {
        startExit("up");
        dragStart.current = null;
      } else if (Math.abs(dx) >= MIN_DRAG_PX) {
        startExit(dx > 0 ? "right" : "left");
        dragStart.current = null;
      }
    },
    [canDismiss, exiting, startExit]
  );

  const handlePointerUp = useCallback(() => {
    dragStart.current = null;
  }, []);

  const handleClick = useCallback(
    () => {
      if (!canDismiss || exiting) return;
      if (dragStart.current) return;
      startExit("up");
    },
    [canDismiss, exiting, startExit]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!canDismiss || exiting) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        startExit("up");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canDismiss, exiting, startExit]);

  return (
    <div
      className={`intro-screen ${exiting ? "intro-screen-exiting" : ""} intro-screen-exit-${exitDirection}`}
      aria-hidden="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleClick}
    >
      <div className="intro-screen-bg" aria-hidden="true">
        <div className="intro-screen-blob intro-screen-blob-violet" />
        <div className="intro-screen-blob intro-screen-blob-cyan" />
        <div className="intro-screen-blob intro-screen-blob-orange" />
      </div>
      <div className="intro-screen-copy">
        <p className="intro-screen-line intro-screen-line-1">Capture first.</p>
        <p className="intro-screen-line intro-screen-line-2">Understand later.</p>
        <span
          className={`intro-screen-cursor ${exiting ? "intro-screen-cursor-to-editor" : ""}`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
