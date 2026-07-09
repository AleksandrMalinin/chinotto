import { describe, it, expect } from "vitest";
import { capturePlaceholderForScope } from "./capturePlaceholder";

describe("capturePlaceholderForScope", () => {
  it("reflects active lens in main capture placeholder", () => {
    expect(capturePlaceholderForScope("all")).toBe("Capture a thought…");
    expect(capturePlaceholderForScope("work")).toBe("Capture to Work…");
    expect(capturePlaceholderForScope("personal")).toBe("Capture to Personal…");
    expect(capturePlaceholderForScope("inbox")).toBe("Capture to Inbox…");
  });

  it("uses compact copy in detail focus", () => {
    expect(capturePlaceholderForScope("work", true)).toBe("New thought…");
  });
});
