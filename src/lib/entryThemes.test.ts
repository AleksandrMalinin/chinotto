import { describe, it, expect } from "vitest";
import { shouldShowThemeInMeta, THEME_META_THRESHOLD } from "./entryThemes";

describe("entryThemes", () => {
  it("shows meta at or above threshold", () => {
    expect(shouldShowThemeInMeta(THEME_META_THRESHOLD, false)).toBe(true);
    expect(shouldShowThemeInMeta(THEME_META_THRESHOLD - 0.01, false)).toBe(false);
  });

  it("shows meta when locked regardless of confidence", () => {
    expect(shouldShowThemeInMeta(0.1, true)).toBe(true);
  });
});
