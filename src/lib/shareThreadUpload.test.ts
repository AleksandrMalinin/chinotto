import { describe, it, expect } from "vitest";
import { shareThreadCreateMessage } from "./shareThreadUpload";

describe("shareThreadCreateMessage", () => {
  const url = "https://share.chinotto.app/t/abc";

  it("reports live link when hosted and html saved", () => {
    const msg = shareThreadCreateMessage({ url, savedHtml: true, hosted: true });
    expect(msg).toContain("live");
    expect(msg).toContain(url);
  });

  it("falls back to html file when hosting unavailable", () => {
    const msg = shareThreadCreateMessage({ url, savedHtml: true, hosted: false });
    expect(msg).toContain("HTML file");
    expect(msg).toContain(url);
  });
});
