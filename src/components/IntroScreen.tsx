import { useEffect, useState, useCallback, useRef } from "react";

const MIN_DRAG_PX = 40;
/** Fade proceed hint to full opacity shortly after mount (starts dim in CSS). */
const PROCEED_HINT_FULL_OPACITY_MS = 1400;

type ExitDirection = "up" | "left" | "right";

type Props = {
  onDismissRequest: () => void;
};

function isModifierOnlyKey(e: KeyboardEvent): boolean {
  return (
    e.key === "Shift" ||
    e.key === "Control" ||
    e.key === "Alt" ||
    e.key === "Meta" ||
    e.key === "OS"
  );
}

export function IntroScreen({ onDismissRequest }: Props) {
  const [exiting, setExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<ExitDirection>("up");
  const [proceedHintVisible, setProceedHintVisible] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const startExit = useCallback(
    (direction: ExitDirection) => {
      if (exiting) return;
      setExiting(true);
      setExitDirection(direction);
      onDismissRequest();
    },
    [exiting, onDismissRequest]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (exiting) return;
      dragStart.current = { x: e.clientX, y: e.clientY };
    },
    [exiting]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (exiting || !dragStart.current) return;
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
    [exiting, startExit]
  );

  const handlePointerUp = useCallback(() => {
    dragStart.current = null;
  }, []);

  const handleClick = useCallback(
    () => {
      if (exiting) return;
      if (dragStart.current) return;
      startExit("up");
    },
    [exiting, startExit]
  );

  useEffect(() => {
    const id = window.setTimeout(
      () => setProceedHintVisible(true),
      PROCEED_HINT_FULL_OPACITY_MS
    );
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (exiting) return;
      if (e.repeat || isModifierOnlyKey(e)) return;
      e.preventDefault();
      startExit("up");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exiting, startExit]);

  return (
    <div
      className={`intro-screen ${exiting ? "intro-screen-exiting" : ""} intro-screen-exit-${exitDirection}`}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Chinotto"
      aria-describedby="intro-screen-tagline"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleClick}
    >
      <div className="intro-screen-bg" aria-hidden="true">
        <div className="intro-screen-wash" />
      </div>
      <div className="intro-screen-copy">
        <p className="intro-screen-line intro-screen-line-1">Capture first.</p>
        <p className="intro-screen-line intro-screen-line-2">Continue later.</p>
        <p
          className={`intro-screen-proceed-hint ${proceedHintVisible ? "intro-screen-proceed-hint-visible" : ""}`}
        >
          <span className="intro-screen-proceed-hint-text">Press any key or click</span>
        </p>
      </div>
      <p id="intro-screen-tagline" className="intro-screen-hint">
        Local-first · Offline by default
      </p>
    </div>
  );
}
