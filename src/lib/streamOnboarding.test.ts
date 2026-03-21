/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, beforeEach } from "vitest";
import {
  hasEverSavedThought,
  setHasEverSavedThought,
} from "./streamOnboarding";

describe("streamOnboarding", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is false before first save flag", () => {
    expect(hasEverSavedThought()).toBe(false);
  });

  it("is true after setHasEverSavedThought", () => {
    setHasEverSavedThought();
    expect(hasEverSavedThought()).toBe(true);
  });

  it("ignores non-1 values in storage", () => {
    localStorage.setItem("chinotto.hasEverSavedThought", "0");
    expect(hasEverSavedThought()).toBe(false);
  });
});
