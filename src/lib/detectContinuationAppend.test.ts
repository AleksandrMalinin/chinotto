import { describe, it, expect } from "vitest";
import { detectContinuationAppend } from "./detectContinuationAppend";

describe("detectContinuationAppend", () => {
  it("returns null when text unchanged", () => {
    expect(detectContinuationAppend("hello", "hello")).toBeNull();
  });

  it("detects append with newline", () => {
    expect(detectContinuationAppend("hello", "hello\nmore")).toEqual({
      normalizedText: "hello\nmore",
      fromOffset: 6,
    });
  });

  it("normalizes append without newline", () => {
    expect(detectContinuationAppend("hello", "hellomore")).toEqual({
      normalizedText: "hello\nmore",
      fromOffset: 6,
    });
  });

  it("returns null when edited in the middle", () => {
    expect(detectContinuationAppend("hello", "help")).toBeNull();
  });
});
