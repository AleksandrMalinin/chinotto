import type { SpaceScope } from "@/lib/spaceScope";
import {
  NEUTRAL_AMBIENCE_CENTER,
  type AmbienceCenterTokens,
} from "@/lib/spaceThemeTokens";

export type ScopeCanvasTokens = AmbienceCenterTokens & {
  bgSurfaceTop: string;
  shellDepthRgb: string;
};

const COOL_ACCENT = "rgba(130, 175, 245, 0.94)";
const WARM_ACCENT = "rgba(230, 215, 255, 0.92)";
const COOL_ACCENT_HOVER = "rgba(165, 200, 255, 0.98)";
const WARM_ACCENT_HOVER = "rgba(242, 235, 255, 0.99)";
const COOL_ACCENT_SUBTLE = "rgba(70, 120, 200, 0.14)";
const WARM_ACCENT_SUBTLE = "rgba(180, 150, 230, 0.12)";
const COOL_BORDER_FOCUS = "rgba(110, 155, 225, 0.52)";
const WARM_BORDER_FOCUS = "rgba(205, 185, 245, 0.46)";
const COOL_CARET = "rgba(145, 185, 255, 0.92)";
const WARM_CARET = "rgba(225, 210, 255, 0.9)";

const SCOPE_ROOM_CANVAS: Record<SpaceScope, ScopeCanvasTokens> = {
  all: {
    ...NEUTRAL_AMBIENCE_CENTER,
    bgSurfaceTop: "#0e0e13",
    shellDepthRgb: "14 16 24",
  },
  inbox: {
    bg: "#090a0f",
    bgElevated: "#0d0e14",
    bgSurfaceTop: "#0e1018",
    shellDepthRgb: "18 34 68",
    surfaceTint: "rgba(50, 85, 155, 0.09)",
    spaceAmbientPrimary: "rgba(55, 95, 175, 0.12)",
    spaceAmbientSecondary: "rgba(45, 75, 140, 0.09)",
    spaceAmbientPrimaryAt: "12% 14%",
    spaceAmbientSecondaryAt: "90% 86%",
    accent: "rgba(150, 175, 240, 0.9)",
    accentHover: "rgba(178, 198, 248, 0.98)",
    accentSubtle: "rgba(80, 115, 180, 0.11)",
    borderFocus: "rgba(125, 155, 210, 0.44)",
    caretAccent: "rgba(155, 180, 235, 0.88)",
  },
  work: {
    bg: "#070a12",
    bgElevated: "#0a0e18",
    bgSurfaceTop: "#101a2a",
    shellDepthRgb: "24 54 98",
    surfaceTint: "rgba(45, 95, 175, 0.15)",
    spaceAmbientPrimary: "rgba(45, 95, 175, 0.14)",
    spaceAmbientSecondary: "rgba(35, 70, 135, 0.1)",
    spaceAmbientPrimaryAt: "8% 10%",
    spaceAmbientSecondaryAt: "94% 88%",
    accent: COOL_ACCENT,
    accentHover: COOL_ACCENT_HOVER,
    accentSubtle: COOL_ACCENT_SUBTLE,
    borderFocus: COOL_BORDER_FOCUS,
    caretAccent: COOL_CARET,
  },
  personal: {
    bg: "#0c0a13",
    bgElevated: "#100e17",
    bgSurfaceTop: "#17131f",
    shellDepthRgb: "62 40 98",
    surfaceTint: "rgba(140, 105, 200, 0.14)",
    spaceAmbientPrimary: "rgba(130, 100, 190, 0.13)",
    spaceAmbientSecondary: "rgba(200, 175, 230, 0.08)",
    spaceAmbientPrimaryAt: "16% 12%",
    spaceAmbientSecondaryAt: "88% 84%",
    accent: WARM_ACCENT,
    accentHover: WARM_ACCENT_HOVER,
    accentSubtle: WARM_ACCENT_SUBTLE,
    borderFocus: WARM_BORDER_FOCUS,
    caretAccent: WARM_CARET,
  },
};

const SCOPE_CSS_PROPERTIES = [
  "--bg",
  "--bg-elevated",
  "--bg-surface-top",
  "--shell-depth-rgb",
  "--surface-tint",
  "--space-ambient-primary",
  "--space-ambient-secondary",
  "--space-ambient-primary-at",
  "--space-ambient-secondary-at",
  "--accent",
  "--accent-hover",
  "--accent-subtle",
  "--border-focus",
  "--caret-accent",
] as const;

const TOKEN_TO_CSS: Record<
  keyof ScopeCanvasTokens,
  (typeof SCOPE_CSS_PROPERTIES)[number]
> = {
  bg: "--bg",
  bgElevated: "--bg-elevated",
  bgSurfaceTop: "--bg-surface-top",
  shellDepthRgb: "--shell-depth-rgb",
  surfaceTint: "--surface-tint",
  spaceAmbientPrimary: "--space-ambient-primary",
  spaceAmbientSecondary: "--space-ambient-secondary",
  spaceAmbientPrimaryAt: "--space-ambient-primary-at",
  spaceAmbientSecondaryAt: "--space-ambient-secondary-at",
  accent: "--accent",
  accentHover: "--accent-hover",
  accentSubtle: "--accent-subtle",
  borderFocus: "--border-focus",
  caretAccent: "--caret-accent",
};

export function scopeCanvasBg(scope: SpaceScope): string {
  return SCOPE_ROOM_CANVAS[scope].bg;
}

export function applyScopeCanvasToDocument(scope: SpaceScope): void {
  if (typeof document === "undefined") return;
  const tokens = SCOPE_ROOM_CANVAS[scope];
  const root = document.documentElement;
  for (const key of Object.keys(TOKEN_TO_CSS) as (keyof ScopeCanvasTokens)[]) {
    root.style.setProperty(TOKEN_TO_CSS[key], tokens[key]);
  }
  root.style.setProperty("--accent-base", tokens.accent);
  root.style.setProperty("--border-focus-base", tokens.borderFocus);
  root.style.setProperty("--caret-accent-base", tokens.caretAccent);
}
