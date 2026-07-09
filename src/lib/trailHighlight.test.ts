import { describe, expect, it } from "vitest";
import { highlightTrailSharedTerms } from "./trailHighlight";

describe("highlightTrailSharedTerms", () => {
  it("wraps shared terms in mark elements", () => {
    const html = highlightTrailSharedTerms("pipeline design notes", ["design", "pipeline"]);
    expect(html).toContain('<mark class="trail-shared-mark">pipeline</mark>');
    expect(html).toContain('<mark class="trail-shared-mark">design</mark>');
  });

  it("highlights only the shared term", () => {
    const html = highlightTrailSharedTerms("alpha beta gamma", ["beta"]);
    expect(html).toContain("alpha");
    expect(html).toContain('<mark class="trail-shared-mark">beta</mark>');
    expect(html).toContain("gamma");
  });
});
