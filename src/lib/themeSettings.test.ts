import { describe, it, expect } from "vitest";
import {
  isThemesEnabled,
  setThemesEnabled,
  THEMES_ENABLED_KEY,
} from "./themeSettings";

describe("themeSettings", () => {
  it("defaults themes to on", () => {
    localStorage.removeItem(THEMES_ENABLED_KEY);
    expect(isThemesEnabled()).toBe(true);
  });

  it("persists themes disabled", () => {
    setThemesEnabled(false);
    expect(isThemesEnabled()).toBe(false);
    setThemesEnabled(true);
  });
});
