import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AMBIENCE_CENTER,
  AMBIENCE_MAX,
  AMBIENCE_MIN,
  applyAmbienceToDocument,
  type SpaceAmbienceLevel,
} from "@/lib/spaceAmbience";
import type { SpaceScope } from "@/lib/spaceScope";

type Props = {
  open: boolean;
  anchor: HTMLElement | null;
  scope: SpaceScope;
  value: SpaceAmbienceLevel;
  onChange: (level: SpaceAmbienceLevel) => void;
  onClose: () => void;
};

const SCOPE_LABEL: Record<SpaceScope, string> = {
  all: "All",
  inbox: "Inbox",
  work: "Work",
  personal: "Personal",
};

const POPOVER_ESTIMATE_WIDTH = 168;
const POPOVER_ANCHOR_PAD = 6;

function computePopoverPosition(
  anchor: HTMLElement,
  popoverWidth: number
): { top: number; left: number } {
  const rect = anchor.getBoundingClientRect();
  let left = rect.right - popoverWidth;
  left = Math.max(
    POPOVER_ANCHOR_PAD,
    Math.min(left, window.innerWidth - popoverWidth - POPOVER_ANCHOR_PAD)
  );
  return { top: rect.bottom + POPOVER_ANCHOR_PAD, left };
}

export function SpaceAtmospherePopover({
  open,
  anchor,
  scope,
  value,
  onChange,
  onClose,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [entered, setEntered] = useState(false);

  const resetToDefault = useCallback(() => {
    applyAmbienceToDocument(scope, AMBIENCE_CENTER);
    onChange(AMBIENCE_CENTER);
  }, [onChange, scope]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, anchor, onClose]);

  const updatePosition = useCallback(() => {
    if (!open || !anchor) return;
    const pw = popoverRef.current?.offsetWidth ?? POPOVER_ESTIMATE_WIDTH;
    setPos(computePopoverPosition(anchor, pw));
  }, [open, anchor]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, scope]);

  useEffect(() => {
    if (!open || !anchor) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const ro = new ResizeObserver(updatePosition);
    ro.observe(anchor);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      ro.disconnect();
    };
  }, [open, anchor, updatePosition]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const railStyle = {
    "--ambience-fill": `${value}%`,
  } as CSSProperties;

  return (
    <div
      ref={popoverRef}
      className="space-atmosphere-popover"
      style={{ top: pos.top, left: pos.left }}
      data-open={entered || undefined}
      role="dialog"
      aria-labelledby={labelId}
      aria-modal="false"
    >
      <div className="space-atmosphere-popover-inner">
        <p id={labelId} className="space-atmosphere-popover__title">
          Ambience · {SCOPE_LABEL[scope]}
        </p>
        <div className="space-ambience-track">
          <div className="space-ambience-rail-row">
            <span className="space-ambience-end space-ambience-end--cool">cool</span>
            <div
              className="space-ambience-rail"
              style={railStyle}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <input
                type="range"
                className="space-ambience-slider"
                min={AMBIENCE_MIN}
                max={AMBIENCE_MAX}
                step={1}
                value={value}
                aria-label={`Ambience for ${SCOPE_LABEL[scope]}, cool to warm`}
                aria-valuetext="Adjusted"
                title="Double-click to reset to default ambience"
                onInput={(e) => {
                  const level = Number((e.target as HTMLInputElement).value);
                  applyAmbienceToDocument(scope, level);
                  onChange(level);
                }}
                onDoubleClick={resetToDefault}
              />
            </div>
            <span className="space-ambience-end space-ambience-end--warm">warm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
