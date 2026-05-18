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

  it("quietEmptyStreamMessage for scoped lenses and All after save", () => {
    expect(quietEmptyStreamMessage("work", true)).toBe("Nothing in Work yet.");
    expect(quietEmptyStreamMessage("personal", false)).toBe(
      "Nothing in Personal yet."
    );
    expect(quietEmptyStreamMessage("inbox", true)).toBe("Inbox is empty.");
    expect(quietEmptyStreamMessage("all", true)).toBe("Your stream is empty.");
    expect(quietEmptyStreamMessage("all", false)).toBe(null);
  });
});
