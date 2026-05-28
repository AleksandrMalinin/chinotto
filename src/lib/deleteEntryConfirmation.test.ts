import { describe, it, expect, vi } from "vitest";
import {
  confirmDeleteThought,
  deleteConfirmSnippet,
} from "./deleteEntryConfirmation";

describe("deleteConfirmSnippet", () => {
  it("uses fallback copy for empty text", () => {
    expect(deleteConfirmSnippet("   \n  ")).toBe("this thought");
  });

  it("uses first line and wraps in quotes", () => {
    expect(deleteConfirmSnippet("First line\nSecond line")).toBe('"First line"');
  });

  it("clips long first line to 80 chars", () => {
    const longLine = "a".repeat(120);
    expect(deleteConfirmSnippet(longLine)).toBe(`"${"a".repeat(77)}..."`);
  });
});

describe("confirmDeleteThought", () => {
  it("returns false when user cancels", async () => {
    const ask = vi.fn().mockResolvedValue(false);

    const ok = await confirmDeleteThought(ask, "Roadmap draft");

    expect(ok).toBe(false);
    expect(ask).toHaveBeenCalledWith(
      'Delete "Roadmap draft"? This cannot be undone.',
      {
        title: "Delete thought",
        kind: "warning",
        okLabel: "Delete",
      }
    );
  });

  it("returns true when user confirms", async () => {
    const ask = vi.fn().mockResolvedValue(true);

    const ok = await confirmDeleteThought(ask, "Review sync notes");

    expect(ok).toBe(true);
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
