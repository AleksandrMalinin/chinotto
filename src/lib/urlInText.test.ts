/**
 * Unit tests for URL parsing in entry text (display text, hostname, domain badge).
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseTextWithUrls } from "./urlInText";

describe("urlInText", () => {
  it("detects https:// URLs", () => {
    const r = parseTextWithUrls("Check https://linear.app/blog");
    assert.strictEqual(r.segments.length, 2);
    assert.strictEqual(r.segments[0].type, "text");
    assert.strictEqual((r.segments[0] as { type: "text"; value: string }).value, "Check ");
    assert.strictEqual(r.segments[1].type, "url");
    const url = r.segments[1] as { type: "url"; value: string; href: string; hostname: string };
    assert.strictEqual(url.value, "linear.app/blog");
    assert.strictEqual(url.href, "https://linear.app/blog");
    assert.strictEqual(url.hostname, "linear.app");
  });

  it("detects http:// URLs", () => {
    const r = parseTextWithUrls("See http://example.com/path");
    assert.strictEqual(r.segments[1].type, "url");
    const url = r.segments[1] as { type: "url"; value: string; href: string; hostname: string };
    assert.strictEqual(url.value, "example.com/path");
    assert.strictEqual(url.hostname, "example.com");
  });

  it("detects www. URLs", () => {
    const r = parseTextWithUrls("Visit www.openai.com");
    assert.strictEqual(r.segments[1].type, "url");
    const url = r.segments[1] as { type: "url"; value: string; href: string; hostname: string };
    assert.strictEqual(url.value, "openai.com");
    assert.strictEqual(url.hostname, "openai.com");
  });

  it("strips scheme and leading www. in display text", () => {
    const r = parseTextWithUrls("https://linear.app/blog");
    const url = r.segments[0] as { type: "url"; value: string };
    assert.strictEqual(url.value, "linear.app/blog");

    const r2 = parseTextWithUrls("www.openai.com/docs");
    const url2 = r2.segments[0] as { type: "url"; value: string };
    assert.strictEqual(url2.value, "openai.com/docs");
  });

  it("excludes trailing punctuation from the URL", () => {
    const r = parseTextWithUrls("See www.openai.com.");
    assert.strictEqual(r.segments[1].type, "url");
    const url = r.segments[1] as { type: "url"; value: string; href: string };
    assert.strictEqual(url.value, "openai.com");
    assert.strictEqual(url.href, "https://www.openai.com");
  });

  it("returns correct hostname for domain badge when exactly one URL and other text", () => {
    const r = parseTextWithUrls("Read this https://linear.app/blog");
    assert.strictEqual(r.singleHostname, "linear.app");
  });

  it("does not return domain badge when there are zero URLs", () => {
    const r = parseTextWithUrls("No links here");
    assert.strictEqual(r.singleHostname, null);
  });

  it("does not return domain badge when there is more than one URL", () => {
    const r = parseTextWithUrls("https://a.com and https://b.com");
    assert.strictEqual(r.singleHostname, null);
  });

  it("does not return domain badge when entry is only the URL", () => {
    const r = parseTextWithUrls("https://linear.app/blog");
    assert.strictEqual(r.singleHostname, null);
  });

  it("example: https://linear.app/blog → display linear.app/blog, hostname linear.app", () => {
    const r = parseTextWithUrls("https://linear.app/blog");
    const url = r.segments[0] as { type: "url"; value: string; hostname: string };
    assert.strictEqual(url.value, "linear.app/blog");
    assert.strictEqual(url.hostname, "linear.app");
  });

  it("example: www.openai.com. → display openai.com without trailing dot", () => {
    const r = parseTextWithUrls("www.openai.com.");
    const url = r.segments[0] as { type: "url"; value: string };
    assert.strictEqual(url.value, "openai.com");
  });

  it("empty or whitespace-only text returns no segments and no hostname", () => {
    assert.deepStrictEqual(parseTextWithUrls(""), { segments: [], singleHostname: null });
    assert.deepStrictEqual(parseTextWithUrls("   "), { segments: [], singleHostname: null });
  });
});
