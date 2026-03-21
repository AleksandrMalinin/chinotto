/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect } from "vitest";
import { getSearchFeedback } from "./searchOverlayFeedback";
import type { Entry } from "../../types/entry";

function entry(id: string): Entry {
  return { id, text: "x", created_at: "2025-01-01T00:00:00.000Z" };
}

describe("getSearchFeedback", () => {
  it("empty list", () => {
    expect(getSearchFeedback([])).toBe("No thoughts found");
  });

  it("single result", () => {
    expect(getSearchFeedback([entry("a")])).toBe("1 result");
  });

  it("multiple results", () => {
    expect(getSearchFeedback([entry("a"), entry("b")])).toBe("2 results");
  });
});
