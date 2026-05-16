import { describe, it, expect } from "vitest";
import {
  CONTRAST_AA_LARGE,
  CONTRAST_AA_NORMAL,
  contrastRatio,
} from "@/lib/colorContrast";
import { SPACE_READABILITY_TOKENS } from "@/lib/spaceThemeTokens";
import type { SpaceScope } from "@/lib/spaceScope";

const SCOPES = Object.keys(SPACE_READABILITY_TOKENS) as SpaceScope[];

describe("space theme readability contrast", () => {
  for (const scope of SCOPES) {
    const t = SPACE_READABILITY_TOKENS[scope];

    describe(scope, () => {
      it("primary text meets WCAG AA normal on bg", () => {
        expect(contrastRatio(t.fg, t.bg)).toBeGreaterThanOrEqual(CONTRAST_AA_NORMAL);
      });

      it("secondary text meets WCAG AA normal on bg", () => {
        expect(contrastRatio(t.fgDim, t.bg)).toBeGreaterThanOrEqual(
          CONTRAST_AA_NORMAL
        );
      });

      it("meta text meets WCAG AA normal on bg", () => {
        expect(contrastRatio(t.metaFg, t.bg)).toBeGreaterThanOrEqual(
          CONTRAST_AA_NORMAL
        );
      });

      it("muted meets WCAG AA large only (inactive tabs, not body)", () => {
        expect(contrastRatio(t.muted, t.bg)).toBeGreaterThanOrEqual(
          CONTRAST_AA_LARGE
        );
        expect(contrastRatio(t.muted, t.bg)).toBeLessThan(CONTRAST_AA_NORMAL);
      });
    });
  }
});
