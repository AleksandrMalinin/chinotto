import { useEffect, useId, useRef } from "react";
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

export function SpaceAtmospherePopover({
  open,
  anchor,
  scope,
  value,
  onChange,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

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
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [open, anchor, onClose]);

  useEffect(() => {
    if (!open || !anchor || !panelRef.current) return;
    const panel = panelRef.current;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const panelRect = panel.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - panelRect.width / 2;
      left = Math.max(
        margin,
        Math.min(left, window.innerWidth - panelRect.width - margin)
      );
      panel.style.left = `${left}px`;
      panel.style.top = `${rect.bottom + margin}px`;
    };
    place();
    requestAnimationFrame(place);
  }, [open, anchor, scope, value]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="space-atmosphere-popover"
      role="dialog"
      aria-labelledby={labelId}
      aria-modal="false"
    >
      <p id={labelId} className="space-atmosphere-popover__label">
        Ambience · {SCOPE_LABEL[scope]}
      </p>
      <div className="space-ambience-rail">
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
          onDoubleClick={() => {
            applyAmbienceToDocument(scope, AMBIENCE_CENTER);
            onChange(AMBIENCE_CENTER);
          }}
        />
      </div>
    </div>
  );
}
