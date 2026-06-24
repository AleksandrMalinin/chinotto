import { describe, it, expect } from "vitest";
import { classifyPreviewLine, parseReadablePlainText } from "./readablePlainText";

describe("parseReadablePlainText", () => {
  it("returns one paragraph for plain single line", () => {
    expect(parseReadablePlainText("Hello")).toEqual([
      {
        type: "paragraph",
        lines: [{ text: "Hello", kind: "plain", isQuestion: false }],
      },
    ]);
  });

  it("groups single-newline lines into one paragraph", () => {
    expect(parseReadablePlainText("Line one\nLine two")).toEqual([
      {
        type: "paragraph",
        lines: [
          { text: "Line one", kind: "plain", isQuestion: false },
          { text: "Line two", kind: "plain", isQuestion: false },
        ],
      },
    ]);
  });

  it("splits paragraphs on blank lines", () => {
    expect(parseReadablePlainText("First block\n\nSecond block")).toEqual([
      {
        type: "paragraph",
        lines: [{ text: "First block", kind: "plain", isQuestion: false }],
      },
      {
        type: "paragraph",
        lines: [{ text: "Second block", kind: "plain", isQuestion: false }],
      },
    ]);
  });

  it("parses hyphen bullets as a flat list", () => {
    expect(parseReadablePlainText("- one\n- two")).toEqual([
      {
        type: "list",
        items: [
          { text: "one", kind: "bullet", isQuestion: false },
          { text: "two", kind: "bullet", isQuestion: false },
        ],
      },
    ]);
  });

  it("parses bullet character lists", () => {
    expect(parseReadablePlainText("• alpha\n• beta")).toEqual([
      {
        type: "list",
        items: [
          { text: "alpha", kind: "bullet", isQuestion: false },
          { text: "beta", kind: "bullet", isQuestion: false },
        ],
      },
    ]);
  });

  it("parses blockquote lines", () => {
    expect(parseReadablePlainText("> She said execute, not propose")).toEqual([
      {
        type: "blockquote",
        lines: [
          {
            text: "She said execute, not propose",
            kind: "blockquote",
            isQuestion: false,
          },
        ],
      },
    ]);
  });

  it("marks question lines", () => {
    expect(parseReadablePlainText("Why did I freeze?")).toEqual([
      {
        type: "paragraph",
        lines: [{ text: "Why did I freeze?", kind: "plain", isQuestion: true }],
      },
    ]);
  });

  it("marks bullet questions", () => {
    expect(parseReadablePlainText("- push back in writing?")).toEqual([
      {
        type: "list",
        items: [
          { text: "push back in writing?", kind: "bullet", isQuestion: true },
        ],
      },
    ]);
  });

  it("parses mixed blocks in order", () => {
    const blocks = parseReadablePlainText(
      "Intro line\n\n- option a\n- option b\n\n> context line\n\nStill open?"
    );
    expect(blocks).toEqual([
      {
        type: "paragraph",
        lines: [{ text: "Intro line", kind: "plain", isQuestion: false }],
      },
      {
        type: "list",
        items: [
          { text: "option a", kind: "bullet", isQuestion: false },
          { text: "option b", kind: "bullet", isQuestion: false },
        ],
      },
      {
        type: "blockquote",
        lines: [{ text: "context line", kind: "blockquote", isQuestion: false }],
      },
      {
        type: "paragraph",
        lines: [{ text: "Still open?", kind: "plain", isQuestion: true }],
      },
    ]);
  });

  it("classifies stream preview bullets", () => {
    expect(classifyPreviewLine("- option a")).toEqual({
      text: "option a",
      kind: "bullet",
      isQuestion: false,
    });
  });
});
