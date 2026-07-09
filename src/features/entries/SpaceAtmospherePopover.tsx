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
  roomToneSwatchBackground,
  ROOM_TONE_PRESETS,
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

const PANEL_WIDTH = 268;
const PANEL_ANCHOR_PAD = 8;

function computePanelPosition(
  anchor: HTMLElement,
  panelWidth: number
): { top: number; left: number } {
  const rect = anchor.getBoundingClientRect();
  let left = rect.left + (rect.width - panelWidth) / 2;
  left = Math.max(
    PANEL_ANCHOR_PAD,
    Math.min(left, window.innerWidth - panelWidth - PANEL_ANCHOR_PAD)
  );
  return { top: rect.bottom + PANEL_ANCHOR_PAD, left };
}

function nearestPresetId(level: SpaceAmbienceLevel): string {
  let best: (typeof ROOM_TONE_PRESETS)[number] = ROOM_TONE_PRESETS[0];
  let bestDist = Math.abs(level - best.level);
  for (const preset of ROOM_TONE_PRESETS) {
    const dist = Math.abs(level - preset.level);
    if (dist < bestDist) {
      best = preset;
      bestDist = dist;
    }
  }
  return bestDist <= 8 ? best.id : "";
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
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
  const activePreset = nearestPresetId(value);

  const applyLevel = useCallback(
    (level: SpaceAmbienceLevel) => {
      applyAmbienceToDocument(scope, level);
      onChange(level);
    },
    [onChange, scope]
  );

  const resetToDefault = useCallback(() => {
    applyLevel(AMBIENCE_CENTER);
  }, [applyLevel]);

  useEffect(() => {
    if (!open) {
      setFineTuneOpen(false);
      return;
    }
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
    const pw = popoverRef.current?.offsetWidth ?? PANEL_WIDTH;
    setPos(computePanelPosition(anchor, pw));
  }, [open, anchor]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, scope, fineTuneOpen]);

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
      className="room-tone-panel"
      style={{ top: pos.top, left: pos.left }}
      data-open={entered || undefined}
      role="dialog"
      aria-labelledby={labelId}
      aria-modal="false"
    >
      <div className="room-tone-panel-inner">
        <p id={labelId} className="room-tone-panel__title">
          {SCOPE_LABEL[scope]} tone
        </p>
        <div
          className="room-tone-swatches"
          role="group"
          aria-label="Room tone"
        >
          {ROOM_TONE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={[
                "room-tone-swatch",
                activePreset === preset.id ? "room-tone-swatch--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={activePreset === preset.id}
              aria-label={`${preset.label} tone`}
              onClick={() => applyLevel(preset.level)}
            >
              <span
                className="room-tone-swatch__preview"
                style={{
                  background: roomToneSwatchBackground(scope, preset.level),
                }}
                aria-hidden="true"
              />
              <span className="room-tone-swatch__label">{preset.label}</span>
            </button>
          ))}
        </div>
        <div className="room-tone-fine-tune">
          <button
            type="button"
            className="room-tone-fine-tune__toggle"
            aria-expanded={fineTuneOpen}
            onClick={() => setFineTuneOpen((open) => !open)}
          >
            Fine tune
            <span
              className="room-tone-fine-tune__chevron"
              data-open={fineTuneOpen || undefined}
              aria-hidden="true"
            />
          </button>
          {fineTuneOpen ? (
            <div className="room-tone-fine-tune__track">
              <div className="space-ambience-rail-row">
                <span className="space-ambience-end space-ambience-end--cool">
                  cool
                </span>
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
                    aria-label={`Fine tune ${SCOPE_LABEL[scope]} tone`}
                    title="Double-click to reset to neutral"
                    onChange={(e) => {
                      applyLevel(Number(e.target.value));
                    }}
                    onDoubleClick={resetToDefault}
                  />
                </div>
                <span className="space-ambience-end space-ambience-end--warm">
                  warm
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
