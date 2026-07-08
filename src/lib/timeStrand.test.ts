import { describe, it, expect } from "vitest";
import { buildTimeStrand, timeStrandHasDepth } from "./timeStrand";
import type { Entry } from "../types/entry";

const now = new Date("2026-07-08T12:00:00Z");

function entry(id: string, created_at: string): Entry {
  return { id, text: `t ${id}`, created_at };
}

describe("buildTimeStrand", () => {
  it("returns no weeks when there are no entries", () => {
    expect(buildTimeStrand([], { now })).toEqual([]);
  });

  it("spans from the earliest entry week through this week", () => {
    const strand = buildTimeStrand(
      [
        entry("old", "2026-01-15T12:00:00"),
        entry("new", "2026-07-07T12:00:00"),
      ],
      { now }
    );
    expect(strand.length).toBeGreaterThan(20);
    expect(strand[strand.length - 1].label).toBe("This week");
    expect(strand.reduce((n, w) => n + w.count, 0)).toBe(2);
  });

  it("honours an explicit fixed week window", () => {
    expect(
      buildTimeStrand([entry("a", "2026-07-08T10:00:00Z")], { now, weeks: 12 })
    ).toHaveLength(12);
  });

  it("counts entries in the correct week bucket", () => {
    const strand = buildTimeStrand(
      [
        entry("a", "2026-07-08T10:00:00Z"),
        entry("b", "2026-07-07T10:00:00Z"),
      ],
      { now }
    );
    const thisWeek = strand[strand.length - 1];
    expect(thisWeek.count).toBe(2);
    expect(thisWeek.label).toBe("This week");
  });

  it("uses newest entry day in week as jump anchor", () => {
    const strand = buildTimeStrand(
      [
        entry("old", "2026-07-01T10:00:00Z"),
        entry("new", "2026-07-03T10:00:00Z"),
      ],
      { now }
    );
    const week = strand.find((w) => w.count === 2);
    expect(week?.jumpYmd).toBe("2026-07-03");
  });
});

describe("timeStrandHasDepth", () => {
  it("is false when strand is empty activity", () => {
    expect(timeStrandHasDepth([])).toBe(false);
  });

  it("is true when any week has entries", () => {
    const strand = buildTimeStrand([entry("a", "2026-06-01T10:00:00Z")], {
      now,
    });
    expect(timeStrandHasDepth(strand)).toBe(true);
  });
});
