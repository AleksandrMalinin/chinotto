import type { Entry } from "../types/entry";

export type TimeStrandWeek = {
  weekStartYmd: string;
  label: string;
  count: number;
  jumpYmd: string;
};

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday 00:00 local for the week containing `d`. */
function weekStartMonday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function weekLabel(weekStart: Date, now: Date): string {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (todayStart.getTime() - weekStart.getTime()) / 86_400_000
  );
  if (diffDays < 7) return "This week";
  if (diffDays < 14) return "Last week";
  return weekStart.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function earliestWeekStart(entries: Entry[]): Date | null {
  if (entries.length === 0) return null;
  let earliest = new Date(entries[0].created_at);
  for (const entry of entries) {
    const created = new Date(entry.created_at);
    if (created < earliest) earliest = created;
  }
  return weekStartMonday(earliest);
}

function enumerateWeekStarts(earliestMonday: Date, currentMonday: Date): Date[] {
  const weeks: Date[] = [];
  const cursor = new Date(earliestMonday);
  while (cursor.getTime() <= currentMonday.getTime()) {
    weeks.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

/**
 * Full history in the active lens: from the earliest entry's week through this week.
 * Pass `weeks` only in tests or for a fixed window.
 */
export function buildTimeStrand(
  entries: Entry[],
  options: { weeks?: number; now?: Date } = {}
): TimeStrandWeek[] {
  const now = options.now ?? new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentWeekStart = weekStartMonday(todayStart);

  const buckets = new Map<string, { count: number; jumpYmd: string }>();

  if (options.weeks != null) {
    for (let i = options.weeks - 1; i >= 0; i--) {
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() - i * 7);
      const key = toLocalYmd(start);
      buckets.set(key, { count: 0, jumpYmd: key });
    }
  } else {
    const earliest = earliestWeekStart(entries);
    if (!earliest) return [];
    for (const start of enumerateWeekStarts(earliest, currentWeekStart)) {
      const key = toLocalYmd(start);
      buckets.set(key, { count: 0, jumpYmd: key });
    }
  }

  for (const entry of entries) {
    const created = new Date(entry.created_at);
    const key = toLocalYmd(weekStartMonday(created));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.count += 1;
    const ymd = toLocalYmd(created);
    if (ymd > bucket.jumpYmd) {
      bucket.jumpYmd = ymd;
    }
  }

  return [...buckets.entries()].map(([weekStartYmd, { count, jumpYmd }]) => {
    const [y, m, d] = weekStartYmd.split("-").map(Number);
    const weekStart = new Date(y, m - 1, d);
    return {
      weekStartYmd,
      label: weekLabel(weekStart, now),
      count,
      jumpYmd,
    };
  });
}

export function timeStrandHasDepth(strand: TimeStrandWeek[]): boolean {
  const total = strand.reduce((n, w) => n + w.count, 0);
  if (total === 0) return false;
  const activeWeeks = strand.filter((w) => w.count > 0).length;
  return activeWeeks > 0;
}
