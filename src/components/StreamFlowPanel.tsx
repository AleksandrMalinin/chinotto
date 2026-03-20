import { useId } from "react";

type Props = {
  className?: string;
  /** No infinite blob/path loops; drawn trails rest in final state (progressive empty onboarding). */
  calm?: boolean;
  /** One-shot emphasis on the SVG trails while the user types (optional). */
  typingAccent?: boolean;
  /**
   * When true, blob/path CSS animations do not run yet (e.g. main UI is still behind intro).
   * Clearing this on intro dismiss restarts draw + drift from the beginning.
   */
  deferMotion?: boolean;
};

/**
 * Glass panel with inner neon blobs + gradient strokes (empty-stream onboarding).
 */
export function StreamFlowPanel({
  className = "",
  calm = false,
  typingAccent = false,
  deferMotion = false,
}: Props) {
  const gradId = `stream-flow-grad-${useId().replace(/:/g, "")}`;
  const rootClass = [
    "stream-flow-panel",
    "stream-flow-panel--onboarding",
    calm && "stream-flow-panel--calm",
    typingAccent && "stream-flow-panel--typing-accent",
    deferMotion && "stream-flow-panel--motion-deferred",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} aria-hidden="true">
      <div className="stream-flow-blobs">
        <span className="stream-flow-blob stream-flow-blob--violet" />
        <span className="stream-flow-blob stream-flow-blob--cyan" />
        <span className="stream-flow-blob stream-flow-blob--ember" />
      </div>
      <div className="stream-flow-glass" />
      <svg
        className="stream-flow-svg"
        viewBox="0 0 220 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="8"
            y1="12"
            x2="212"
            y2="248"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="rgba(180, 188, 255, 0.9)" />
            <stop offset="0.42" stopColor="rgba(34, 200, 220, 0.55)" />
            <stop offset="1" stopColor="rgba(255, 150, 90, 0.5)" />
          </linearGradient>
        </defs>
        <path
          className="stream-flow-path stream-flow-path--a"
          d="M 36 44 C 92 52 118 96 78 138 C 58 162 48 188 62 214"
          stroke={`url(#${gradId})`}
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        <path
          className="stream-flow-path stream-flow-path--b"
          d="M 154 36 C 128 78 168 112 148 156 C 132 192 156 222 178 236"
          stroke={`url(#${gradId})`}
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.45"
        />
        <path
          className="stream-flow-path stream-flow-path--c"
          d="M 24 168 Q 108 148 124 208 T 196 228"
          stroke={`url(#${gradId})`}
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.32"
        />
      </svg>
    </div>
  );
}
