import type { SpaceScope } from "@/lib/spaceScope";

/**
 * Readability + UI tokens — sync with `:root` in `src/index.css`.
 * Same text colors in every space; canvas and accents follow fixed per-scope tokens in `scopeCanvas.ts`.
 */
export type SpaceReadabilityTokens = {
  bg: string;
  fg: string;
  fgDim: string;
  metaFg: string;
  muted: string;
  uiDim: string;
};

/** All scope: brand charcoal, cosmic wash, violet focus. */
export type AmbienceCenterTokens = {
  bg: string;
  bgElevated: string;
  surfaceTint: string;
  spaceAmbientPrimary: string;
  spaceAmbientSecondary: string;
  spaceAmbientPrimaryAt: string;
  spaceAmbientSecondaryAt: string;
  accent: string;
  accentHover: string;
  accentSubtle: string;
  borderFocus: string;
  caretAccent: string;
};

export const NEUTRAL_AMBIENCE_CENTER: AmbienceCenterTokens = {
  bg: "#0a0a0e",
  bgElevated: "#0f0f14",
  surfaceTint: "transparent",
  spaceAmbientPrimary: "rgba(100, 120, 180, 0.14)",
  spaceAmbientSecondary: "rgba(80, 100, 150, 0.11)",
  spaceAmbientPrimaryAt: "15% 20%",
  spaceAmbientSecondaryAt: "88% 82%",
  accent: "rgba(160, 170, 255, 0.88)",
  accentHover: "rgba(188, 196, 255, 0.98)",
  accentSubtle: "rgba(128, 138, 188, 0.08)",
  borderFocus: "rgba(138, 148, 200, 0.36)",
  caretAccent: "rgba(168, 178, 228, 0.82)",
};

const SHARED_READABILITY: Omit<SpaceReadabilityTokens, "bg"> = {
  fg: "#e4e4e9",
  fgDim: "#9b9fa9",
  metaFg: "rgba(255, 255, 255, 0.55)",
  muted: "#5d6068",
  uiDim: "#9b9fa9",
};

/** Canvas bases — keep in sync with SCOPE_ROOM_CANVAS in scopeCanvas.ts */
const SCOPE_CANVAS_BG: Record<SpaceScope, string> = {
  all: NEUTRAL_AMBIENCE_CENTER.bg,
  inbox: "#090a0f",
  work: "#070a12",
  personal: "#0c0a13",
};

export const SPACE_READABILITY_TOKENS: Record<SpaceScope, SpaceReadabilityTokens> =
  {
    all: { bg: SCOPE_CANVAS_BG.all, ...SHARED_READABILITY },
    inbox: { bg: SCOPE_CANVAS_BG.inbox, ...SHARED_READABILITY },
    work: { bg: SCOPE_CANVAS_BG.work, ...SHARED_READABILITY },
    personal: { bg: SCOPE_CANVAS_BG.personal, ...SHARED_READABILITY },
  };

/** @deprecated Use NEUTRAL_AMBIENCE_CENTER */
export type SpaceRoomTokens = Pick<
  AmbienceCenterTokens,
  "bg" | "bgElevated" | "surfaceTint"
>;

const ROOM_FROM_NEUTRAL = (t: AmbienceCenterTokens): SpaceRoomTokens => ({
  bg: t.bg,
  bgElevated: t.bgElevated,
  surfaceTint: t.surfaceTint,
});

export const SPACE_ROOM_TOKENS: Record<SpaceScope, SpaceRoomTokens> = {
  all: ROOM_FROM_NEUTRAL(NEUTRAL_AMBIENCE_CENTER),
  inbox: {
    bg: SCOPE_CANVAS_BG.inbox,
    bgElevated: "#0d0e14",
    surfaceTint: "rgba(50, 85, 155, 0.09)",
  },
  work: {
    bg: SCOPE_CANVAS_BG.work,
    bgElevated: "#0a0e18",
    surfaceTint: "rgba(45, 95, 175, 0.15)",
  },
  personal: {
    bg: SCOPE_CANVAS_BG.personal,
    bgElevated: "#100e17",
    surfaceTint: "rgba(140, 105, 200, 0.14)",
  },
};
