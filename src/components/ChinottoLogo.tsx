type Props = {
  size?: number;
  className?: string;
  /** When true, adds classes for intro animation (stroke-draw, dots, breathing) */
  animated?: boolean;
  /** When true, SVG fills its container (for scaling during transition) */
  fillContainer?: boolean;
};

const VIEWBOX = "0 0 64 64";

export function ChinottoLogo({ size = 64, className, animated, fillContainer }: Props) {
  const svgClass = animated ? `chinotto-logo chinotto-logo-animated ${className ?? ""}`.trim() : (className ?? "");
  return (
    <svg
      width={fillContainer ? "100%" : size}
      height={fillContainer ? "100%" : size}
      viewBox={VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={svgClass || undefined}
      aria-hidden
    >
      <circle
        className={animated ? "chinotto-logo-outer" : undefined}
        cx="32"
        cy="32"
        r="22"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <circle className={animated ? "chinotto-logo-dot chinotto-logo-dot-1" : undefined} cx="32" cy="23" r="5" fill="currentColor" />
      <circle className={animated ? "chinotto-logo-dot chinotto-logo-dot-2" : undefined} cx="24" cy="34" r="4" fill="currentColor" />
      <circle className={animated ? "chinotto-logo-dot chinotto-logo-dot-3" : undefined} cx="40" cy="34" r="4" fill="currentColor" />
      <circle className={animated ? "chinotto-logo-dot chinotto-logo-dot-4" : undefined} cx="32" cy="41" r="3" fill="currentColor" />
    </svg>
  );
}
