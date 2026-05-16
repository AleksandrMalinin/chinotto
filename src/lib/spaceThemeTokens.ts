import type { SpaceScope } from "@/lib/spaceScope";

/**
 * Readability tokens per space — must stay in sync with:
 * - `:root` in `src/index.css` (All / Inbox text defaults)
 * - `:root[data-space-scope="…"]` in `src/styles/spaceThemes.css`
 *
 * Ambient-only tokens (glow, surface-tint, etc.) are not listed here.
 * Do not set `--muted` per space without re-running `spaceThemeContrast.test.ts`.
 */
export type SpaceReadabilityTokens = {
  bg: string;
  fg: string;
  fgDim: string;
  metaFg: string;
  /** Shared across spaces; only defined on All for contrast checks. */
  muted: string;
};

export const SPACE_READABILITY_TOKENS: Record<SpaceScope, SpaceReadabilityTokens> =
  {
    all: {
      bg: "#0a0a0e",
      fg: "#e4e4e9",
      fgDim: "#9b9fa9",
      metaFg: "rgba(255, 255, 255, 0.55)",
      muted: "#5d6068",
    },
    inbox: {
      bg: "#0a0a0e",
      fg: "#e4e4e9",
      fgDim: "#9b9fa9",
      metaFg: "rgba(255, 255, 255, 0.55)",
      muted: "#5d6068",
    },
    work: {
      bg: "#08090d",
      fg: "#e3e6ec",
      fgDim: "#9198a4",
      metaFg: "rgba(255, 255, 255, 0.6)",
      muted: "#5d6068",
    },
    personal: {
      bg: "#0c0a0d",
      fg: "#ebe6e3",
      fgDim: "#a89f99",
      metaFg: "rgba(255, 255, 255, 0.56)",
      muted: "#5d6068",
    },
  };
