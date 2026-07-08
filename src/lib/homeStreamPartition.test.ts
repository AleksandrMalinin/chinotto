import { describe, it, expect } from "vitest";
import { partitionHomeStream } from "./homeStreamPartition";
import type { Entry } from "../types/entry";

function entry(
  id: string,
  created_at: string,
  extra: Partial<Entry> = {}
): Entry {
  return { id, text: `Thought ${id}`, created_at, ...extra };
}

const now = new Date("2026-07-08T12:00:00Z");

describe("partitionHomeStream", () => {
  it("returns empty sections when there are no entries", () => {
    const result = partitionHomeStream([], { pinnedIds: [], now });
    expect(result.openEntries).toEqual([]);
    expect(result.recentEntries).toEqual([]);
    expect(result.earlierEntries).toEqual([]);
  });

  it("puts pinned entries in Open first", () => {
    const entries = [
      entry("a", "2026-07-08T10:00:00Z"),
      entry("b", "2026-07-07T10:00:00Z"),
    ];
    const result = partitionHomeStream(entries, {
      pinnedIds: ["b"],
      now,
    });
    expect(result.openEntries.map((o) => o.entry.id)).toEqual(["b"]);
    expect(result.openEntries[0].label).toBe("Pinned");
    expect(result.recentEntries.map((e) => e.id)).toEqual(["a"]);
  });

  it("caps Open at three entries by priority", () => {
    const entries = [
      entry("pin", "2026-07-01T10:00:00Z"),
      entry("cont", "2026-07-02T10:00:00Z", {
        continuation_from: 5,
        continuation_at: "2026-07-07T10:00:00Z",
      }),
      entry("rev", "2026-07-06T10:00:00Z"),
      entry("extra", "2026-07-05T10:00:00Z"),
    ];
    const result = partitionHomeStream(entries, {
      pinnedIds: ["pin"],
      revisitedIds: new Set(["rev", "extra"]),
      now,
    });
    expect(result.openEntries.map((o) => o.entry.id)).toEqual([
      "pin",
      "cont",
      "rev",
    ]);
  });

  it("dedupes Open when an entry matches multiple signals", () => {
    const entries = [
      entry("both", "2026-07-01T10:00:00Z", {
        continuation_from: 4,
        continuation_at: "2026-07-07T10:00:00Z",
      }),
    ];
    const result = partitionHomeStream(entries, {
      pinnedIds: ["both"],
      revisitedIds: new Set(["both"]),
      now,
    });
    expect(result.openEntries).toHaveLength(1);
    expect(result.openEntries[0].reason).toBe("pinned");
  });

  it("keeps recent entries within 48h up to fifteen rows", () => {
    const entries = Array.from({ length: 18 }, (_, i) =>
      entry(
        `e${i}`,
        new Date(now.getTime() - i * 60 * 60 * 1000).toISOString()
      )
    );
    const result = partitionHomeStream(entries, { pinnedIds: [], now });
    expect(result.recentEntries).toHaveLength(15);
    expect(result.earlierEntries).toHaveLength(3);
  });

  it("sends entries older than 48h to Earlier", () => {
    const entries = [
      entry("old", "2026-07-01T10:00:00Z"),
      entry("new", "2026-07-08T09:00:00Z"),
    ];
    const result = partitionHomeStream(entries, { pinnedIds: [], now });
    expect(result.recentEntries.map((e) => e.id)).toEqual(["new"]);
    expect(result.earlierEntries.map((e) => e.id)).toEqual(["old"]);
  });

  it("excludes Open entries from Recent and Earlier", () => {
    const entries = [
      entry("open", "2026-07-08T11:00:00Z"),
      entry("recent", "2026-07-08T10:00:00Z"),
    ];
    const result = partitionHomeStream(entries, {
      pinnedIds: ["open"],
      now,
    });
    expect(result.recentEntries.map((e) => e.id)).toEqual(["recent"]);
    expect(result.earlierEntries).toEqual([]);
  });
});
