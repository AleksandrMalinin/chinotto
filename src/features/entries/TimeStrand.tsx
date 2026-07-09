import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Entry } from "../../types/entry";
import {
  buildTimeStrand,
  timeStrandHasDepth,
  type TimeStrandWeek,
} from "@/lib/timeStrand";

type Props = {
  entries: Entry[];
  onPickWeek: (week: TimeStrandWeek) => void;
  onOpenCalendar?: () => void;
  calendarAnchorRef?: React.Ref<HTMLButtonElement>;
};

const VB_H = 88;
const MARGIN_X = 16;
const WEEK_WIDTH = 34;
const MIN_VB_W = 400;

type StrandPoint = { x: number; y: number };

function strandPoints(count: number, vbW: number): StrandPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const x = MARGIN_X + t * (vbW - 2 * MARGIN_X);
    const y = VB_H / 2 + Math.sin(t * Math.PI * 1.1) * 16;
    return { x, y };
  });
}

function riverPath(points: StrandPoint[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx.toFixed(2)} ${p0.y.toFixed(2)}, ${cx.toFixed(2)} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return d;
}

function activeSpans(strand: TimeStrandWeek[]): [number, number][] {
  const spans: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < strand.length; i++) {
    if (strand[i].count > 0) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      spans.push([start, i - 1]);
      start = -1;
    }
  }
  if (start >= 0) spans.push([start, strand.length - 1]);
  return spans;
}

type TooltipPlacement = {
  x: number;
  y: number;
  align: "center" | "start" | "end";
};

export function TimeStrand({
  entries,
  onPickWeek,
  onOpenCalendar,
  calendarAnchorRef,
}: Props) {
  const gradId = useId().replace(/:/g, "");
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipPlacement | null>(null);
  const [showPastCue, setShowPastCue] = useState(false);

  const strand = useMemo(() => buildTimeStrand(entries), [entries]);
  const vbW = useMemo(
    () => Math.max(MIN_VB_W, strand.length * WEEK_WIDTH + MARGIN_X * 2),
    [strand.length]
  );
  const points = useMemo(
    () => strandPoints(strand.length, vbW),
    [strand.length, vbW]
  );
  const isScrollable = vbW > MIN_VB_W;
  const densityScale = useMemo(
    () => (isScrollable ? 1 : Math.min(1, 22 / Math.max(strand.length, 1))),
    [strand.length, isScrollable]
  );
  const maxCount = useMemo(
    () => Math.max(1, ...strand.map((w) => w.count)),
    [strand]
  );
  const basePath = useMemo(() => riverPath(points), [points]);
  const litPaths = useMemo(() => {
    return activeSpans(strand).map(([from, to]) =>
      riverPath(points.slice(from, to + 1))
    );
  }, [strand, points]);

  const updatePastCue = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !isScrollable) {
      setShowPastCue(false);
      return;
    }
    setShowPastCue(el.scrollLeft > 12);
  }, [isScrollable]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !isScrollable) return;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
    updatePastCue();
  }, [strand.length, vbW, isScrollable, updatePastCue]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !isScrollable) return;
    el.addEventListener("scroll", updatePastCue, { passive: true });
    return () => el.removeEventListener("scroll", updatePastCue);
  }, [isScrollable, updatePastCue]);

  const updateTooltip = useCallback(() => {
    if (hoveredIndex === null) {
      setTooltip(null);
      return;
    }
    const week = strand[hoveredIndex];
    if (!week || week.count <= 0) {
      setTooltip(null);
      return;
    }
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const node = wrap.querySelector<HTMLElement>(
      `[data-strand-index="${hoveredIndex}"]`
    );
    if (!node) return;
    const nodeRect = node.getBoundingClientRect();
    const x = nodeRect.left + nodeRect.width / 2;
    const y = nodeRect.top;
    let align: TooltipPlacement["align"] = "center";
    if (x < 120) align = "start";
    else if (x > window.innerWidth - 120) align = "end";
    setTooltip({ x, y, align });
  }, [hoveredIndex, strand]);

  useLayoutEffect(() => {
    updateTooltip();
    if (hoveredIndex === null) return;
    const scrollEl = scrollRef.current;
    scrollEl?.addEventListener("scroll", updateTooltip, { passive: true });
    window.addEventListener("resize", updateTooltip);
    return () => {
      scrollEl?.removeEventListener("scroll", updateTooltip);
      window.removeEventListener("resize", updateTooltip);
    };
  }, [hoveredIndex, updateTooltip]);

  if (!timeStrandHasDepth(strand)) return null;

  return (
    <section
      className={`time-strand${isScrollable ? " time-strand--wide" : ""}`}
      aria-label="Thinking over time"
    >
      <div className="time-strand-horizon" aria-hidden="true">
        <span className="time-strand-horizon-line" />
        <span className="time-strand-horizon-glow" />
      </div>

      <div
        ref={scrollRef}
        className={`time-strand-scroll${isScrollable ? " time-strand-scroll--wide" : ""}`}
      >
        {showPastCue ? (
          <span className="time-strand-past-cue" aria-hidden="true">
            ‹
          </span>
        ) : null}

        <div
          ref={canvasWrapRef}
          className="time-strand-canvas-wrap"
          style={{ width: vbW }}
        >
          <div className="time-strand-stage">
            <svg
            className="time-strand-svg"
            viewBox={`0 0 ${vbW} ${VB_H}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="rgba(128, 138, 188, 0.4)" />
                <stop offset="100%" stopColor="rgba(160, 170, 255, 0.96)" />
              </linearGradient>
            </defs>

            <path
              className="time-strand-river time-strand-river--base"
              d={basePath}
              fill="none"
              stroke={`url(#${gradId})`}
            />

            {litPaths.map((d, i) => (
              <path
                key={`lit-${i}`}
                className="time-strand-river time-strand-river--lit"
                d={d}
                fill="none"
                stroke={`url(#${gradId})`}
              />
            ))}

            {strand.map((week, i) => {
              const pt = points[i];
              const active = week.count > 0;
              const isNow = i === strand.length - 1;
              const intensity = week.count / maxCount;
              const hovered = hoveredIndex === i;
              const r =
                (active ? 2.6 + intensity * 5.4 : 1.1) * densityScale;
              const showHalo =
                active && (hovered || isNow || intensity >= 0.42);
              return (
                <g key={week.weekStartYmd}>
                  {showHalo ? (
                    <circle
                      className="time-strand-halo"
                      cx={pt.x}
                      cy={pt.y}
                      r={(r + 5 + intensity * 3) * densityScale}
                      style={
                        {
                          "--strand-intensity": String(intensity),
                        } as React.CSSProperties
                      }
                    />
                  ) : null}
                  {isNow && active ? (
                    <circle
                      className="time-strand-now-ring"
                      cx={pt.x}
                      cy={pt.y}
                      r={(r + 3.8) * densityScale}
                    />
                  ) : null}
                  <circle
                    className={`time-strand-bead${active ? " time-strand-bead--active" : ""}${isNow ? " time-strand-bead--now" : ""}${hovered ? " time-strand-bead--hover" : ""}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={hovered && active ? r + 1.2 * densityScale : r}
                    style={
                      active
                        ? ({
                            "--strand-intensity": String(intensity),
                          } as React.CSSProperties)
                        : undefined
                    }
                  />
                </g>
              );
            })}
          </svg>

          <div className="time-strand-nodes" role="list">
            {strand.map((week, i) => {
              const pt = points[i];
              const active = week.count > 0;
              const leftPct = (pt.x / vbW) * 100;
              const topPct = (pt.y / VB_H) * 100;
              return (
                <button
                  key={week.weekStartYmd}
                  type="button"
                  role="listitem"
                  data-strand-index={i}
                  className={`time-strand-node${active ? " time-strand-node--active" : ""}`}
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  onClick={() => active && onPickWeek(week)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() =>
                    setHoveredIndex((prev) => (prev === i ? null : prev))
                  }
                  onFocus={() => setHoveredIndex(i)}
                  onBlur={() =>
                    setHoveredIndex((prev) => (prev === i ? null : prev))
                  }
                  disabled={!active}
                  aria-label={
                    active
                      ? `${week.label}, ${week.count} thought${week.count === 1 ? "" : "s"}`
                      : `${week.label}, no thoughts`
                  }
                >
                  <span className="time-strand-node-hit" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          </div>
        </div>
      </div>

      <div className="time-strand-axis" aria-hidden="true">
        <span>Earlier</span>
        <span>This week</span>
      </div>

      <div className="time-strand-footer">
        <p className="time-strand-caption">Tap a lit week to jump</p>
        {onOpenCalendar ? (
          <button
            ref={calendarAnchorRef}
            type="button"
            className="time-strand-calendar"
            onClick={onOpenCalendar}
          >
            Any date…
          </button>
        ) : null}
      </div>
      {hoveredIndex !== null && tooltip && strand[hoveredIndex]?.count > 0 ? (
        <div
          className={`time-strand-tooltip time-strand-tooltip--floating time-strand-tooltip--align-${tooltip.align}`}
          style={{ left: tooltip.x, top: tooltip.y }}
          role="tooltip"
        >
          {strand[hoveredIndex].label}
          <span className="time-strand-tooltip-sep" aria-hidden="true">
            ·
          </span>
          <span className="time-strand-tooltip-count">
            {strand[hoveredIndex].count}{" "}
            {strand[hoveredIndex].count === 1 ? "thought" : "thoughts"}
          </span>
        </div>
      ) : null}
    </section>
  );
}
