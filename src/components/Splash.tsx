import { useEffect, useState } from "react";

const SPLASH_DURATION_MS = 1650;
const FADE_OUT_MS = 400;

type Props = {
  onComplete: () => void;
};

export function Splash({ onComplete }: Props) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const startExit = setTimeout(() => setExiting(true), SPLASH_DURATION_MS);
    const finish = setTimeout(
      () => onComplete(),
      SPLASH_DURATION_MS + FADE_OUT_MS
    );
    return () => {
      clearTimeout(startExit);
      clearTimeout(finish);
    };
  }, [onComplete]);

  return (
    <div
      className={`splash ${exiting ? "splash-out" : ""}`}
      aria-hidden="true"
    >
      <div className="splash-seed">
        <div className="splash-dot" />
        <div className="splash-circle" />
      </div>
      <p className="splash-text">Capture the seed of a thought.</p>
    </div>
  );
}
