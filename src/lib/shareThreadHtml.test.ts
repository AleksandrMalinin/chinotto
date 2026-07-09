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
    expect(html).toContain('class="readable-continuation"');
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

  it("uses flat document layout without glow", () => {
    const html = buildShareThreadHtml({
      expiresAt: "2025-12-01T12:00:00Z",
      entries: [
        { id: "e1", text: "One line", created_at: "2025-01-01T12:00:00Z" },
      ],
    });
    expect(html).toContain("#0a0a0e");
    expect(html).toContain("getchinotto.app");
    expect(html).toContain('class="document"');
    expect(html).toContain('class="document-eyebrow"');
    expect(html).toContain("Shared thread");
    expect(html).toContain("read-only thread");
    expect(html).toContain('class="brand-logo"');
    expect(html).toContain('class="thread-meta"');
    expect(html).toContain('class="masthead-top"');
    expect(html).toContain('class="beat"');
    expect(html).not.toContain("border-radius");
    expect(html).not.toContain("block-bg");
    expect(html).toContain('class="studio-signature"');
    expect(html).toContain("Bogart Labs");
    expect(html).not.toContain("ambient");
    expect(html).not.toContain("blur(");
    expect(html).not.toContain("radial-gradient");
    expect(html).not.toContain("story-thread");
    expect(html).not.toContain("position: fixed");
    expect(html).toContain('class="document-end"');
    expect(html).toContain("margin-top: auto");
    expect(html).toContain("text-align: center");
  });

  it("renders related thoughts in a separate section", () => {
    const html = buildShareThreadHtml({
      expiresAt: "2025-12-01T12:00:00Z",
      entries: [
        { id: "a", text: "Main beat", created_at: "2025-01-01T12:00:00Z" },
      ],
      relatedEntries: [
        { id: "b", text: "Tangent", created_at: "2025-01-03T12:00:00Z" },
      ],
    });
    expect(html).toContain('class="related"');
    expect(html).toContain("Related thoughts");
    expect(html).toContain("not part of the thread above");
    expect(html).toContain('class="related-line"');
    expect(html).toContain("Tangent");
    expect(html.indexOf("Main beat")).toBeLessThan(html.indexOf("Tangent"));
  });

  it("skips related entries already in the thread", () => {
    const html = buildShareThreadHtml({
      expiresAt: "2025-12-01T12:00:00Z",
      entries: [
        { id: "a", text: "Main beat", created_at: "2025-01-01T12:00:00Z" },
      ],
      relatedEntries: [
        { id: "a", text: "Main beat", created_at: "2025-01-01T12:00:00Z" },
      ],
    });
    expect(html).not.toContain('class="related"');
  });

  it("renders context as prominent intent", () => {
    const html = buildShareThreadHtml({
      contextNote: "For the design review",
      expiresAt: "2025-12-01T12:00:00Z",
      entries: [
        { id: "e1", text: "Notes", created_at: "2025-01-01T12:00:00Z" },
      ],
    });
    expect(html).toContain('<p class="document-intent">For the design review</p>');
    expect(html).not.toContain('class="document-kicker"');
    expect(html).not.toContain("shared with you");
  });

  it("includes favicon and compact footer expiry", () => {
    const html = buildShareThreadHtml({
      expiresAt: "2025-07-23T14:45:00Z",
      entries: [
        { id: "e1", text: "One line", created_at: "2025-01-01T12:00:00Z" },
      ],
    });
    expect(html).toContain('href="https://getchinotto.app/favicon.svg"');
    expect(html).toContain("Expires");
    expect(html).not.toContain(" at ");
  });

  it("shows relative spacing between beats", () => {
    const html = buildShareThreadHtml({
      expiresAt: "2025-12-01T12:00:00Z",
      entries: [
        { id: "a", text: "First", created_at: "2025-01-01T12:00:00Z" },
        { id: "b", text: "Second", created_at: "2025-01-08T12:00:00Z" },
      ],
    });
    expect(html).toContain("days later");
  });

  it("shows hours later for beats on the same day", () => {
    const html = buildShareThreadHtml({
      expiresAt: "2025-12-01T12:00:00Z",
      entries: [
        { id: "a", text: "Morning", created_at: "2025-01-01T09:00:00Z" },
        { id: "b", text: "Afternoon", created_at: "2025-01-01T15:00:00Z" },
      ],
    });
    expect(html).toContain("hours later");
  });

  it("uses compact timestamp separator", () => {
    const html = buildShareThreadHtml({
      expiresAt: "2025-12-01T12:00:00Z",
      entries: [
        { id: "e1", text: "One line", created_at: "2025-01-01T12:00:00Z" },
      ],
    });
    expect(html).toMatch(/\d{4} · \d/);
    expect(html).not.toContain(" at ");
  });

  it("renders multiline related entries in full layout", () => {
    const html = buildShareThreadHtml({
      expiresAt: "2025-12-01T12:00:00Z",
      entries: [
        { id: "a", text: "Main", created_at: "2025-01-01T12:00:00Z" },
      ],
      relatedEntries: [
        {
          id: "b",
          text: "Line one\nLine two",
          created_at: "2025-01-03T12:00:00Z",
        },
      ],
    });
    expect(html).toContain("related-entry--full");
  });
});
