import type { SpaceScope } from "@/lib/spaceScope";
import {
  NEUTRAL_AMBIENCE_CENTER,
  type AmbienceCenterTokens,
} from "@/lib/spaceThemeTokens";

/** 0 = cool … 50 = neutral … 100 = warm. Saved per space in localStorage. */
export type SpaceAmbienceLevel = number;

export const AMBIENCE_MIN = 0;
export const AMBIENCE_MAX = 100;
export const AMBIENCE_CENTER = 50;

export const SPACE_AMBIENCE_STORAGE_KEY = "chinotto.spaceAmbience";

/** Slider range that keeps exact brand neutral (no RGB drift). */
export const AMBIENCE_NEUTRAL_PLATEAU_MIN = 42;
export const AMBIENCE_NEUTRAL_PLATEAU_MAX = 58;

const COOL_BG_BLEND = 0.16;
const COOL_BG_BIAS = "#070c18";
const COOL_AMBIENT_PRIMARY_AT = "10% 12%";
const COOL_AMBIENT_SECONDARY_AT = "92% 88%";
/** Warm pole: bright clean highlights (set directly, not lerped from blue neutral). */
const WARM_BG_BIAS = "#0d0d11";
const WARM_BG_BLEND = 0.06;
const COOL_SURFACE_TINT = "rgba(72, 108, 175, 0.055)";
const WARM_SURFACE_TINT = "rgba(255, 255, 252, 0.022)";
const COOL_AMBIENT_PRIMARY = "rgba(55, 95, 175, 0.17)";
const WARM_AMBIENT_PRIMARY = "rgba(255, 252, 248, 0.09)";
const COOL_AMBIENT_SECONDARY = "rgba(45, 75, 140, 0.13)";
const WARM_AMBIENT_SECONDARY = "rgba(255, 255, 252, 0.065)";
const WARM_AMBIENT_PRIMARY_AT = "18% 22%";
const WARM_AMBIENT_SECONDARY_AT = "84% 76%";
const COOL_ACCENT = "rgba(140, 168, 225, 0.94)";
const WARM_ACCENT = "rgba(248, 246, 255, 0.9)";
const COOL_ACCENT_HOVER = "rgba(175, 198, 240, 0.98)";
const WARM_ACCENT_HOVER = "rgba(255, 252, 255, 0.98)";
const COOL_ACCENT_SUBTLE = "rgba(90, 118, 165, 0.12)";
const WARM_ACCENT_SUBTLE = "rgba(255, 255, 255, 0.08)";
const COOL_BORDER_FOCUS = "rgba(125, 155, 210, 0.5)";
const WARM_BORDER_FOCUS = "rgba(235, 232, 245, 0.42)";
const COOL_CARET = "rgba(150, 180, 225, 0.92)";
const WARM_CARET = "rgba(255, 252, 255, 0.88)";

export const DEFAULT_SPACE_AMBIENCE_BY_SCOPE: Record<
  SpaceScope,
  SpaceAmbienceLevel
> = {
  all: AMBIENCE_CENTER,
  inbox: AMBIENCE_CENTER,
  work: AMBIENCE_CENTER,
  personal: AMBIENCE_CENTER,
};

export type AmbienceAnchorTokens = AmbienceCenterTokens;

type ScopeAnchors = {
  cool: AmbienceAnchorTokens;
  default: AmbienceAnchorTokens;
  warm: AmbienceAnchorTokens;
};

export const AMBIENCE_CSS_PROPERTIES = [
  "--bg",
  "--bg-elevated",
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
  keyof AmbienceAnchorTokens,
  (typeof AMBIENCE_CSS_PROPERTIES)[number]
> = {
  bg: "--bg",
  bgElevated: "--bg-elevated",
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

const LEGACY_PALETTE_TO_LEVEL: Record<string, SpaceAmbienceLevel> = {
  default: 50,
  neutral: 50,
  cool: 18,
  warm: 82,
  deep: 12,
};

const POSITION_KEYS = new Set<keyof AmbienceAnchorTokens>([
  "spaceAmbientPrimaryAt",
  "spaceAmbientSecondaryAt",
]);

type Rgb = { r: number; g: number; b: number };

function parseHex(hex: string): Rgb | null {
  const h = hex.replace(/^#/, "").trim();
  if (h.length !== 6) return null;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function formatHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

type Rgba = { r: number; g: number; b: number; a: number };

function parseColor(raw: string): Rgba | null {
  const value = raw.trim();
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const m = value.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/
  );
  if (!m) return null;
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] !== undefined ? Number(m[4]) : 1,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpHex(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return t < 0.5 ? from : to;
  return formatHex({
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  });
}

function lerpRgba(from: string, to: string, t: number): string {
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return t < 0.5 ? from : to;
  if (a.a === 0 && b.a === 0) return "transparent";
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bl = Math.round(lerp(a.b, b.b, t));
  const alpha = Math.round(lerp(a.a, b.a, t) * 1000) / 1000;
  if (alpha <= 0.001) return "transparent";
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}

function parsePosition(raw: string): [number, number] {
  const [x, y] = raw.split(/\s+/);
  return [parseFloat(x), parseFloat(y)];
}

function lerpPosition(from: string, to: string, t: number): string {
  const a = parsePosition(from);
  const b = parsePosition(to);
  const x = Math.round(lerp(a[0], b[0], t) * 10) / 10;
  const y = Math.round(lerp(a[1], b[1], t) * 10) / 10;
  return `${x}% ${y}%`;
}

function elevatedForBg(
  defaultBg: string,
  defaultElevated: string,
  nextBg: string
): string {
  const d = parseHex(defaultBg);
  const e = parseHex(defaultElevated);
  const n = parseHex(nextBg);
  if (!d || !e || !n) return nextBg;
  return formatHex({
    r: Math.min(255, Math.max(0, n.r + (e.r - d.r))),
    g: Math.min(255, Math.max(0, n.g + (e.g - d.g))),
    b: Math.min(255, Math.max(0, n.b + (e.b - d.b))),
  });
}

/** Cool/warm poles from neutral center — same curve for every space. */
export function deriveRoomToneAnchors(_scope?: SpaceScope): ScopeAnchors {
  const defaultRoom: AmbienceAnchorTokens = { ...NEUTRAL_AMBIENCE_CENTER };
  const coolBg = lerpHex(defaultRoom.bg, COOL_BG_BIAS, COOL_BG_BLEND);
  const warmBg = lerpHex(defaultRoom.bg, WARM_BG_BIAS, WARM_BG_BLEND);
  return {
    default: defaultRoom,
    cool: {
      bg: coolBg,
      bgElevated: elevatedForBg(
        defaultRoom.bg,
        defaultRoom.bgElevated,
        coolBg
      ),
      surfaceTint: COOL_SURFACE_TINT,
      spaceAmbientPrimary: COOL_AMBIENT_PRIMARY,
      spaceAmbientSecondary: COOL_AMBIENT_SECONDARY,
      spaceAmbientPrimaryAt: COOL_AMBIENT_PRIMARY_AT,
      spaceAmbientSecondaryAt: COOL_AMBIENT_SECONDARY_AT,
      accent: COOL_ACCENT,
      accentHover: COOL_ACCENT_HOVER,
      accentSubtle: COOL_ACCENT_SUBTLE,
      borderFocus: COOL_BORDER_FOCUS,
      caretAccent: COOL_CARET,
    },
    warm: {
      bg: warmBg,
      bgElevated: elevatedForBg(
        defaultRoom.bg,
        defaultRoom.bgElevated,
        warmBg
      ),
      surfaceTint: WARM_SURFACE_TINT,
      spaceAmbientPrimary: WARM_AMBIENT_PRIMARY,
      spaceAmbientSecondary: WARM_AMBIENT_SECONDARY,
      spaceAmbientPrimaryAt: WARM_AMBIENT_PRIMARY_AT,
      spaceAmbientSecondaryAt: WARM_AMBIENT_SECONDARY_AT,
      accent: WARM_ACCENT,
      accentHover: WARM_ACCENT_HOVER,
      accentSubtle: WARM_ACCENT_SUBTLE,
      borderFocus: WARM_BORDER_FOCUS,
      caretAccent: WARM_CARET,
    },
  };
}

function lerpToken(
  key: keyof AmbienceAnchorTokens,
  from: string,
  to: string,
  t: number
): string {
  if (POSITION_KEYS.has(key)) return lerpPosition(from, to, t);
  if (key === "bg" || key === "bgElevated") return lerpHex(from, to, t);
  return lerpRgba(from, to, t);
}

function lerpTokens(
  from: AmbienceAnchorTokens,
  to: AmbienceAnchorTokens,
  t: number
): AmbienceAnchorTokens {
  const keys = Object.keys(from) as (keyof AmbienceAnchorTokens)[];
  const out = { ...from };
  for (const key of keys) {
    out[key] = lerpToken(key, from[key], to[key], t);
  }
  return out;
}

export function clampAmbienceLevel(raw: number): SpaceAmbienceLevel {
  if (!Number.isFinite(raw)) return AMBIENCE_CENTER;
  return Math.min(AMBIENCE_MAX, Math.max(AMBIENCE_MIN, Math.round(raw)));
}

export function interpolateAmbienceTokens(
  scope: SpaceScope,
  level: SpaceAmbienceLevel
): AmbienceAnchorTokens {
  const anchors = deriveRoomToneAnchors(scope);
  const clamped = clampAmbienceLevel(level);
  const neutral = anchors.default;

  if (
    clamped >= AMBIENCE_NEUTRAL_PLATEAU_MIN &&
    clamped <= AMBIENCE_NEUTRAL_PLATEAU_MAX
  ) {
    return { ...neutral };
  }

  if (clamped < AMBIENCE_NEUTRAL_PLATEAU_MIN) {
    const t = clamped / AMBIENCE_NEUTRAL_PLATEAU_MIN;
    return lerpTokens(anchors.cool, neutral, t);
  }

  const t =
    (clamped - AMBIENCE_NEUTRAL_PLATEAU_MAX) /
    (AMBIENCE_MAX - AMBIENCE_NEUTRAL_PLATEAU_MAX);
  return lerpTokens(neutral, anchors.warm, t);
}

export function tokensToStyleProperties(
  tokens: AmbienceAnchorTokens
): Record<(typeof AMBIENCE_CSS_PROPERTIES)[number], string> {
  const out = {} as Record<(typeof AMBIENCE_CSS_PROPERTIES)[number], string>;
  for (const key of Object.keys(TOKEN_TO_CSS) as (keyof AmbienceAnchorTokens)[]) {
    out[TOKEN_TO_CSS[key]] = tokens[key];
  }
  return out;
}

export function applyAmbienceToDocument(
  scope: SpaceScope,
  level: SpaceAmbienceLevel
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const props = tokensToStyleProperties(
    interpolateAmbienceTokens(scope, clampAmbienceLevel(level))
  );
  for (const prop of AMBIENCE_CSS_PROPERTIES) {
    root.style.setProperty(prop, props[prop]);
  }
  root.style.setProperty("--accent-base", props["--accent"]);
  root.style.setProperty("--border-focus-base", props["--border-focus"]);
  root.style.setProperty("--caret-accent-base", props["--caret-accent"]);
}

export const SPACE_SCOPES_WITH_AMBIENCE: readonly SpaceScope[] = [
  "all",
  "inbox",
  "work",
  "personal",
] as const;

function parseStoredAmbienceValue(value: unknown): SpaceAmbienceLevel | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampAmbienceLevel(value);
  }
  if (typeof value === "string") {
    if (value in LEGACY_PALETTE_TO_LEVEL) {
      return LEGACY_PALETTE_TO_LEVEL[value];
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return clampAmbienceLevel(parsed);
  }
  return undefined;
}

export function loadStoredSpaceAmbience(): Record<
  SpaceScope,
  SpaceAmbienceLevel
> {
  const merged = { ...DEFAULT_SPACE_AMBIENCE_BY_SCOPE };
  if (typeof window === "undefined") return merged;

  const read = (raw: string | null): void => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
      for (const scope of Object.keys(merged) as SpaceScope[]) {
        const level = parseStoredAmbienceValue(parsed[scope]);
        if (level !== undefined) merged[scope] = level;
      }
    } catch {
      /* ignore corrupt storage */
    }
  };

  read(localStorage.getItem(SPACE_AMBIENCE_STORAGE_KEY));
  if (!localStorage.getItem(SPACE_AMBIENCE_STORAGE_KEY)) {
    read(localStorage.getItem("chinotto.spacePalette"));
  }

  return merged;
}

export function saveSpaceAmbienceForScope(
  scope: SpaceScope,
  level: SpaceAmbienceLevel,
  all: Record<SpaceScope, SpaceAmbienceLevel>
): Record<SpaceScope, SpaceAmbienceLevel> {
  const next = { ...all, [scope]: clampAmbienceLevel(level) };
  if (typeof window !== "undefined") {
    localStorage.setItem(SPACE_AMBIENCE_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
