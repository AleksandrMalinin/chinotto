import type { Entry } from "../types/entry";

export const HOME_OPEN_MAX = 3;
export const HOME_RECENT_MAX = 15;
export const HOME_RECENT_HOURS = 48;

export type OpenEntryReason = "pinned" | "continued" | "revisited";

export type OpenEntry = {
  entry: Entry;
  reason: OpenEntryReason;
  /** Quiet row meta in the Open section */
  label: string;
};

export type HomeStreamPartition = {
  openEntries: OpenEntry[];
  recentEntries: Entry[];
  earlierEntries: Entry[];
};

type OpenCandidate = {
  entry: Entry;
  reason: OpenEntryReason;
  label: string;
  priority: number;
  tieBreak: number;
};

function entryTieBreak(entry: Entry): number {
  const iso = entry.continuation_at ?? entry.updated_at ?? entry.created_at;
  return new Date(iso).getTime();
}

function continuedLabel(entry: Entry): string {
  if (entry.continuation_at) {
    const days = Math.floor(
      (Date.now() - new Date(entry.continuation_at).getTime()) / 86_400_000
    );
    if (days === 0) return "Continued today";
    if (days === 1) return "Continued yesterday";
    return `Continued ${days} days ago`;
  }
  return "Continued";
}

function buildOpenCandidates(
  entries: Entry[],
  pinnedIds: string[],
  revisitedIds: ReadonlySet<string>
): OpenCandidate[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const candidates: OpenCandidate[] = [];
  const seen = new Set<string>();

  const push = (candidate: OpenCandidate) => {
    if (seen.has(candidate.entry.id)) return;
    seen.add(candidate.entry.id);
    candidates.push(candidate);
  };

  pinnedIds.forEach((id, index) => {
    const entry = byId.get(id);
    if (!entry) return;
    push({
      entry,
      reason: "pinned",
      label: "Pinned",
      priority: 0,
      tieBreak: pinnedIds.length - index,
    });
  });

  for (const entry of entries) {
    if (entry.continuation_from == null) continue;
    push({
      entry,
      reason: "continued",
      label: continuedLabel(entry),
      priority: 1,
      tieBreak: entryTieBreak(entry),
    });
  }

  for (const id of revisitedIds) {
    const entry = byId.get(id);
    if (!entry) continue;
    push({
      entry,
      reason: "revisited",
      label: "Revisited",
      priority: 2,
      tieBreak: entryTieBreak(entry),
    });
  }

  return candidates;
}

function selectOpenEntries(candidates: OpenCandidate[]): OpenEntry[] {
  return [...candidates]
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.tieBreak - a.tieBreak;
    })
    .slice(0, HOME_OPEN_MAX)
    .map(({ entry, reason, label }) => ({ entry, reason, label }));
}

function isWithinRecentWindow(iso: string, nowMs: number): boolean {
  const ageMs = nowMs - new Date(iso).getTime();
  return ageMs >= 0 && ageMs <= HOME_RECENT_HOURS * 3_600_000;
}

export function partitionHomeStream(
  entries: Entry[],
  options: {
    pinnedIds: string[];
    revisitedIds?: ReadonlySet<string>;
    now?: Date;
  } = { pinnedIds: [] }
): HomeStreamPartition {
  const {
    pinnedIds,
    revisitedIds = new Set<string>(),
    now = new Date(),
  } = options;

  const openEntries = selectOpenEntries(
    buildOpenCandidates(entries, pinnedIds, revisitedIds)
  );
  const openIds = new Set(openEntries.map((o) => o.entry.id));
  const nowMs = now.getTime();

  const rest = entries.filter((e) => !openIds.has(e.id));
  const recentEntries: Entry[] = [];
  const earlierEntries: Entry[] = [];

  for (const entry of rest) {
    if (
      recentEntries.length < HOME_RECENT_MAX &&
      isWithinRecentWindow(entry.created_at, nowMs)
    ) {
      recentEntries.push(entry);
    } else {
      earlierEntries.push(entry);
    }
  }

  return { openEntries, recentEntries, earlierEntries };
}
