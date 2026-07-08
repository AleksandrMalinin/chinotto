import { describe, it, expect } from "vitest";
import { shareThreadCreateMessage } from "./shareThreadUpload";

describe("shareThreadCreateMessage", () => {
  const url = "https://getchinotto.app/t/abc";

  it("reports live link when hosted and html saved", () => {
    const msg = shareThreadCreateMessage({
      url,
      savedHtml: true,
      hosted: true,
      copied: true,
    });
    expect(msg).toContain("clipboard");
    expect(msg).toContain(url);
  });

  it("shows url when copy failed", () => {
    const msg = shareThreadCreateMessage({
      url,
      savedHtml: true,
      hosted: true,
      copied: false,
    });
    expect(msg).toContain("Copy the link below");
    expect(msg).toContain(url);
  });

  it("falls back to html file when hosting unavailable", () => {
    const msg = shareThreadCreateMessage({
      url,
      savedHtml: true,
      hosted: false,
      copied: true,
    });
    expect(msg).toContain("HTML");
    expect(msg).toContain(url);
  });
});
