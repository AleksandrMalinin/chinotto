import { describe, it, expect } from "vitest";
import {
  quietEmptyStreamMessage,
  shouldShowFullEmptyOnboarding,
} from "./emptyStreamLensMessage";

describe("emptyStreamLensMessage", () => {
  it("shouldShowFullEmptyOnboarding only for All before first save", () => {
    expect(shouldShowFullEmptyOnboarding("all", false)).toBe(true);
    expect(shouldShowFullEmptyOnboarding("all", true)).toBe(false);
    expect(shouldShowFullEmptyOnboarding("work", false)).toBe(false);
  });

  it("quietEmptyStreamMessage for scoped lenses only", () => {
    expect(quietEmptyStreamMessage("work", true)).toBe(
      "Nothing in Work yet. Switch to All to see everything."
    );
    expect(quietEmptyStreamMessage("personal", false)).toBe(
      "Nothing in Personal yet. Switch to All to see everything."
    );
    expect(quietEmptyStreamMessage("inbox", true)).toBe(
      "Inbox is empty. Switch to All to see everything."
    );
    expect(quietEmptyStreamMessage("all", true)).toBe(null);
    expect(quietEmptyStreamMessage("all", false)).toBe(null);
  });
});
