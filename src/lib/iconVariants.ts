/**
 * Icon variant system for Chinotto logo / app icon.
 * Used for the icon variant showcase and a future desktop icon switcher.
 * Variants are color and style only; logo shape and size are unchanged.
 */

export type IconVariant = {
  id: string;
  name: string;
  /** CSS color for the logo (stroke + fill via currentColor) */
  foreground: string;
  /** CSS background for the icon container */
  background: string;
  /** Optional container border (e.g. "1px solid rgba(...)") */
  border?: string;
  /** Optional container glow (box-shadow) */
  boxShadow?: string;
};

/** Chinotto-aligned icon variants: dark, minimal, atmospheric. All suitable for app icon tiles. */
export const ICON_VARIANTS: IconVariant[] = [
  {
    id: "default",
    name: "Default",
    foreground: "#8a94c8",
    background: "#0a0a0e",
  },
  {
    id: "light",
    name: "Light",
    foreground: "#e4e4e9",
    background: "#0f0f14",
  },
  {
    id: "muted",
    name: "Muted",
    foreground: "#5d6068",
    background: "#0a0a0e",
  },
  {
    id: "violet",
    name: "Violet",
    foreground: "#e4e4e9",
    background: "#7C3AED",
  },
  {
    id: "cyan",
    name: "Cyan",
    foreground: "#0a0a0e",
    background: "#06B6D4",
  },
  {
    id: "orange",
    name: "Orange",
    foreground: "#0a0a0e",
    background: "#F97316",
  },
  {
    id: "gradient",
    name: "Gradient",
    foreground: "#e4e4e9",
    background: "linear-gradient(135deg, rgba(100,120,180,0.35), rgba(80,100,150,0.3))",
  },
  {
    id: "border-glow",
    name: "Border + glow",
    foreground: "#a0aaff",
    background: "#0a0a0e",
    border: "1px solid rgba(120, 130, 200, 0.25)",
    boxShadow: "0 0 24px rgba(90, 108, 156, 0.2)",
  },
  {
    id: "glass",
    name: "Glass",
    foreground: "#e4e4e9",
    background: "rgba(15, 15, 20, 0.85)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  {
    id: "accent",
    name: "Accent",
    foreground: "#c8d0f0",
    background: "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(128,138,188,0.2), #0f0f14)",
  },
];

/** Variant ids offered in the in-app icon switcher (ChinottoCard). */
export const SELECTABLE_ICON_VARIANT_IDS = [
  "default",
  "light",
  "violet",
  "cyan",
  "orange",
  "gradient",
] as const;

export type SelectableIconVariantId = (typeof SELECTABLE_ICON_VARIANT_IDS)[number];

const variantById = new Map(ICON_VARIANTS.map((v) => [v.id, v]));

export function getIconVariant(id: string | null | undefined): IconVariant {
  if (!id) return ICON_VARIANTS[0];
  return variantById.get(id) ?? ICON_VARIANTS[0];
}

const STORAGE_KEY = "chinotto-icon-variant";

export function getStoredIconVariantId(): string {
  if (typeof window === "undefined") return "default";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && typeof raw === "string" && variantById.has(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "default";
}

export function setStoredIconVariantId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
