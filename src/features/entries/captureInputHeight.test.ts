import { describe, expect, it } from "vitest";
import {
  COMPOSE_AUTO_EXPAND_CHARS,
  shouldAutoExpandCapture,
} from "./captureInputHeight";

describe("shouldAutoExpandCapture", () => {
  it("returns false for empty draft", () => {
    expect(shouldAutoExpandCapture(null, "")).toBe(false);
    expect(shouldAutoExpandCapture(null, "   ")).toBe(false);
  });

  it("returns true when draft has an explicit line break", () => {
    expect(shouldAutoExpandCapture(null, "line one\nline two")).toBe(true);
  });

  it("expands when draft exceeds inline char cap", () => {
    expect(shouldAutoExpandCapture(null, "a".repeat(COMPOSE_AUTO_EXPAND_CHARS))).toBe(
      false
    );
    expect(
      shouldAutoExpandCapture(null, "a".repeat(COMPOSE_AUTO_EXPAND_CHARS + 1))
    ).toBe(true);
  });
});
