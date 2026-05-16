import type { SpaceScope } from "@/lib/spaceScope";

/** Set on `<html>` when the stream lens changes; drives `src/styles/spaceThemes.css`. */
export const SPACE_THEME_ATTR = "data-space-scope";

/**
 * Text/background tokens per space: `src/lib/spaceThemeTokens.ts`.
 * Contrast guardrails: `src/lib/spaceThemeContrast.test.ts`.
 */

export const SPACE_LENS_TABS: readonly (readonly [SpaceScope, string])[] = [
  ["all", "All"],
  ["inbox", "Inbox"],
  ["work", "Work"],
  ["personal", "Personal"],
] as const;
