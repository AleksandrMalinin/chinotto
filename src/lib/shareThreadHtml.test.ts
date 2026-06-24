import { describe, it, expect } from "vitest";
import { buildShareThreadHtml } from "./shareThreadHtml";

describe("buildShareThreadHtml", () => {
  it("escapes HTML in thought text", () => {
    const html = buildShareThreadHtml({
      expiresAt: "2025-12-01T12:00:00Z",
      entries: [
        {
          id: "e1",
          text: "<script>alert(1)</script>",
          created_at: "2025-01-01T12:00:00Z",
        },
      ],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes continuation block when marked", () => {
    const html = buildShareThreadHtml({
      expiresAt: "2025-12-01T12:00:00Z",
      entries: [
        {
          id: "e1",
          text: "Original\nContinued",
          created_at: "2025-01-01T12:00:00Z",
          continuation_from: 9,
          continuation_at: "2025-01-05T08:00:00Z",
        },
      ],
    });
    expect(html).toContain('class="continuation"');
    expect(html).toContain("Added");
    expect(html).toContain("Continued");
  });

  it("orders entries oldest first", () => {
    const html = buildShareThreadHtml({
      expiresAt: "2025-12-01T12:00:00Z",
      entries: [
        { id: "b", text: "Second", created_at: "2025-01-02T12:00:00Z" },
        { id: "a", text: "First", created_at: "2025-01-01T12:00:00Z" },
      ],
    });
    expect(html.indexOf("First")).toBeLessThan(html.indexOf("Second"));
  });
});
