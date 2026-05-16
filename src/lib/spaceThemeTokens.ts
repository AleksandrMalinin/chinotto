import type { SpaceScope } from "@/lib/spaceScope";

/**
 * Readability + UI tokens — sync with `:root` in `src/index.css`.
 * Same text colors in every space; room tone and accents follow the per-space ambience rail.
 */
export type SpaceReadabilityTokens = {
  bg: string;
  fg: string;
  fgDim: string;
  metaFg: string;
  muted: string;
  uiDim: string;
};

/** Slider center (50): brand charcoal, cosmic wash, violet focus. */
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

export const SPACE_READABILITY_TOKENS: Record<SpaceScope, SpaceReadabilityTokens> =
  {
    all: { bg: NEUTRAL_AMBIENCE_CENTER.bg, ...SHARED_READABILITY },
    inbox: { bg: NEUTRAL_AMBIENCE_CENTER.bg, ...SHARED_READABILITY },
    work: { bg: NEUTRAL_AMBIENCE_CENTER.bg, ...SHARED_READABILITY },
    personal: { bg: NEUTRAL_AMBIENCE_CENTER.bg, ...SHARED_READABILITY },
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
  inbox: ROOM_FROM_NEUTRAL(NEUTRAL_AMBIENCE_CENTER),
  work: ROOM_FROM_NEUTRAL(NEUTRAL_AMBIENCE_CENTER),
  personal: ROOM_FROM_NEUTRAL(NEUTRAL_AMBIENCE_CENTER),
};
