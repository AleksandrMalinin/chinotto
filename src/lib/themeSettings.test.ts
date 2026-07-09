import { describe, it, expect } from "vitest";
import {
  isShowLinkIndicator,
  isThemesEnabled,
  setShowLinkIndicator,
  setThemesEnabled,
  THEMES_ENABLED_KEY,
} from "./themeSettings";

describe("themeSettings", () => {
  it("defaults themes and link indicator to on", () => {
    localStorage.removeItem(THEMES_ENABLED_KEY);
    expect(isThemesEnabled()).toBe(true);
    expect(isShowLinkIndicator()).toBe(true);
  });

  it("persists themes disabled", () => {
    setThemesEnabled(false);
    expect(isThemesEnabled()).toBe(false);
    setThemesEnabled(true);
  });

  it("persists link indicator disabled", () => {
    setShowLinkIndicator(false);
    expect(isShowLinkIndicator()).toBe(false);
    setShowLinkIndicator(true);
  });
});
