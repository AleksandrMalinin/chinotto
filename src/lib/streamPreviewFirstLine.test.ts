import { describe, it, expect } from "vitest";
import { streamPreviewFirstLine } from "./streamPreviewFirstLine";

describe("streamPreviewFirstLine", () => {
  it("returns whole string when single line", () => {
    expect(streamPreviewFirstLine("Hello")).toBe("Hello");
    expect(streamPreviewFirstLine("  spaced  ")).toBe("  spaced");
  });

  it("drops content after first newline", () => {
    expect(streamPreviewFirstLine("A\nB")).toBe("A");
    expect(streamPreviewFirstLine("First\r\nSecond")).toBe("First");
  });

  it("trims trailing whitespace only on first line end", () => {
    expect(streamPreviewFirstLine("Hello \n")).toBe("Hello");
  });
});
