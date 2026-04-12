import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { jumpDateDaysAgoMetric } from "./analytics";

describe("jumpDateDaysAgoMetric", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 27, 15, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 for today’s local calendar date", () => {
    expect(jumpDateDaysAgoMetric("2025-03-27")).toBe(0);
  });

  it("returns 1 for yesterday", () => {
    expect(jumpDateDaysAgoMetric("2025-03-26")).toBe(1);
  });

  it("returns 0 for unparseable input", () => {
    expect(jumpDateDaysAgoMetric("")).toBe(0);
    expect(jumpDateDaysAgoMetric("not-a-date")).toBe(0);
  });
});
