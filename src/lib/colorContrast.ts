/** sRGB relative luminance (WCAG 2.x). */
function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

type Rgba = [number, number, number, number];

function parseColor(input: string): Rgba {
  const hex = input.trim();
  if (hex.startsWith("#")) {
    const h = hex.slice(1);
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    const n = Number.parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = hex.match(/rgba?\(([^)]+)\)/i);
  if (!m) {
    throw new Error(`Unsupported color: ${input}`);
  }
  const parts = m[1].split(",").map((p) => Number.parseFloat(p.trim()));
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

function compositeOnBackground(fg: Rgba, bg: Rgba): [number, number, number] {
  const [r, g, b, a] = fg;
  const t = 1 - a;
  return [r * a + bg[0] * t, g * a + bg[1] * t, b * a + bg[2] * t];
}

/** WCAG contrast ratio between two colors (alpha composited on background when needed). */
export function contrastRatio(foreground: string, background: string): number {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  const fgRgb = compositeOnBackground(fg, bg);
  const l1 = relativeLuminance(...fgRgb);
  const l2 = relativeLuminance(bg[0], bg[1], bg[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.x level AA, normal text. */
export const CONTRAST_AA_NORMAL = 4.5;

/** WCAG 2.x level AA, large text or UI treated as non-essential. */
export const CONTRAST_AA_LARGE = 3;
