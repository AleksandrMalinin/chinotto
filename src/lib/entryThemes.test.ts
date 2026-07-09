import { describe, it, expect } from "vitest";
import {
  shouldShowThemeInMeta,
  THEME_META_THRESHOLD,
  themeLabel,
} from "./entryThemes";

describe("entryThemes", () => {
  it("shows meta at or above threshold", () => {
    expect(shouldShowThemeInMeta(THEME_META_THRESHOLD, false)).toBe(true);
    expect(shouldShowThemeInMeta(THEME_META_THRESHOLD - 0.01, false)).toBe(false);
  });

  it("shows meta when locked regardless of confidence", () => {
    expect(shouldShowThemeInMeta(0.1, true)).toBe(true);
  });

  it("resolves user theme labels", () => {
    const themes = [{ id: "book", label: "Book", sort_order: 1 }];
    expect(themeLabel("book", themes)).toBe("Book");
    expect(themeLabel("links", themes)).toBe("Links");
    expect(themeLabel("unknown", themes)).toBe("unknown");
  });
});
