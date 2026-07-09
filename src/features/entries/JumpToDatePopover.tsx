import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { track } from "@/lib/analytics";
import { jumpDatesInMonth } from "./entryApi";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function toYmd(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function parseYmd(ymd: string): { y: number; m0: number } | null {
  const p = ymd.split("-");
  if (p.length !== 3) return null;
  const y = Number(p[0]);
  const m = Number(p[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return null;
  }
  return { y, m0: m - 1 };
}

export type JumpToDatePopoverProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  contextYmd: string | null;
  onClose: () => void;
  onPickDate: (ymd: string) => void;
  /** Matches list/search/jump space lens (`undefined` = all stream) */
  spaceFilter?: string;
  /** Centered sheet when opened from the bottom of the home stream */
  variant?: "popover" | "sheet";
};

export function JumpToDatePopover({
  open,
  anchorRef,
  contextYmd,
  onClose,
  onPickDate,
  spaceFilter,
  variant = "popover",
}: JumpToDatePopoverProps) {
  const isSheet = variant === "sheet";
  const popoverRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(
    () => new Set()
  );
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    track({ event: "jump_to_date_calendar_opened" });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (contextYmd) {
      const parsed = parseYmd(contextYmd);
      if (parsed) {
        setCursor(new Date(parsed.y, parsed.m0, 1));
        return;
      }
    }
    setCursor(new Date());
  }, [open, contextYmd]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    jumpDatesInMonth(year, monthIndex + 1, spaceFilter).then((list) => {
      if (cancelled) return;
      setDatesWithEntries(new Set(list));
    });
    return () => {
      cancelled = true;
    };
  }, [open, year, monthIndex, spaceFilter]);

  const updatePosition = useCallback(() => {
    if (isSheet) return;
    const el = anchorRef.current;
    if (!open || !el) return;
    const r = el.getBoundingClientRect();
    const pw = 280;
    const ph = 320;
    const pad = 8;
    let top = r.bottom + pad;
    let left = r.left;
    if (left + pw > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - pw - pad);
    }
    if (top + ph > window.innerHeight - pad) {
      const above = r.top - ph - pad;
      if (above >= pad) top = above;
    }
    setPos({ top, left });
  }, [open, anchorRef, isSheet]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, year, monthIndex]);

  useEffect(() => {
    if (!open || isSheet) return;
    const el = anchorRef.current;
    if (!el) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const ro = new ResizeObserver(updatePosition);
    ro.observe(el);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      ro.disconnect();
    };
  }, [open, anchorRef, updatePosition, isSheet]);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (!isSheet && anchorRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, onClose, anchorRef, isSheet]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const goPrevMonth = useCallback(() => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }, []);

  const goNextMonth = useCallback(() => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }, []);

  if (!open) return null;

  const today = new Date();
  const todayYmd = toYmd(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const firstDow = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const title = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const calendar = (
    <div className="jump-date-popover-inner">
      <div className="jump-date-popover-head">
        <button
          type="button"
          className="jump-date-nav"
          onClick={goPrevMonth}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <span className="jump-date-title">{title}</span>
        <button
          type="button"
          className="jump-date-nav"
          onClick={goNextMonth}
          aria-label="Next month"
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      </div>
      <div className="jump-date-weekdays" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <span key={w} className="jump-date-wd">
            {w}
          </span>
        ))}
      </div>
      <div className="jump-date-grid">
        {cells.map((day, idx) => {
          if (day == null) {
            return (
              <span
                key={`e-${idx}`}
                className="jump-date-cell jump-date-cell--empty"
              />
            );
          }
          const ymd = toYmd(year, monthIndex, day);
          const hasEntry = datesWithEntries.has(ymd);
          const isToday = ymd === todayYmd;
          const isContext = contextYmd != null && ymd === contextYmd;
          const locked = isToday && hasEntry;
          const className = [
            "jump-date-cell",
            hasEntry && "jump-date-cell--has-entry",
            isToday && "jump-date-cell--today",
            locked && "jump-date-cell--locked",
            isContext && !isToday && "jump-date-cell--context",
          ]
            .filter(Boolean)
            .join(" ");
          const body = (
            <span className="jump-date-cell-stack">
              <span className="jump-date-day-num">{day}</span>
              <span
                className={`jump-date-dot${hasEntry ? "" : " jump-date-dot--hidden"}`}
                aria-hidden="true"
              />
            </span>
          );

          if (locked) {
            return (
              <span key={ymd} className={className} aria-current="date">
                {body}
              </span>
            );
          }

          return (
            <button
              key={ymd}
              type="button"
              disabled={!hasEntry}
              className={className}
              onClick={() => hasEntry && onPickDate(ymd)}
            >
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (isSheet) {
    return createPortal(
      <div className="jump-date-sheet-overlay">
        <div
          ref={popoverRef}
          className="jump-date-sheet"
          role="dialog"
          aria-label="Jump to date"
        >
          {calendar}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div
      ref={popoverRef}
      className="jump-date-popover"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 60,
      }}
      role="dialog"
      aria-label="Jump to date"
    >
      {calendar}
    </div>
  );
}

export function JumpToDateTriggerIcon() {
  return <CalendarDays size={17} strokeWidth={1.65} aria-hidden="true" />;
}
