/**
 * Renders the Chinotto logo (variant style) to PNG bytes for use as a window/dock icon.
 * Used only when running in Tauri; no-op in browser.
 */

import type { IconVariant } from "./iconVariants";

const LOGO_SIZE = 256;
/** Same as bundle icon.svg: transparent bg, logo ~55% of canvas (44/80) so macOS can apply rounded mask. */
const VIEWBOX = "0 0 80 80";

function chinottoLogoSvg(foreground: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${esc(VIEWBOX)}" fill="none">
  <circle cx="40" cy="40" r="22" stroke="${esc(foreground)}" stroke-width="2" fill="none"/>
  <circle cx="40" cy="31" r="5" fill="${esc(foreground)}"/>
  <circle cx="32" cy="42" r="4" fill="${esc(foreground)}"/>
  <circle cx="48" cy="42" r="4" fill="${esc(foreground)}"/>
  <circle cx="40" cy="49" r="3" fill="${esc(foreground)}"/>
</svg>`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("toBlob failed"));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          const buf = reader.result as ArrayBuffer;
          resolve(new Uint8Array(buf));
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      },
      "image/png",
      1
    );
  });
}

/** Corner radius for the icon shape (~22% of size) so corners stay transparent and macOS shows rounding. */
const CORNER_RADIUS = 56;

/**
 * Renders the given variant to a 256×256 PNG: rounded-rect background (transparent corners) + logo ~55% centered.
 * Corners are transparent so the image isn’t a full square; dock shows the rounded shape. Used for the dock icon in Tauri.
 */
export async function variantToPngBytes(variant: IconVariant): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = LOGO_SIZE;
  canvas.height = LOGO_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d not available");

  ctx.beginPath();
  ctx.roundRect(0, 0, LOGO_SIZE, LOGO_SIZE, CORNER_RADIUS);
  if (variant.id === "gradient") {
    const g = ctx.createLinearGradient(0, 0, LOGO_SIZE, LOGO_SIZE);
    g.addColorStop(0, "rgba(100,120,180,0.35)");
    g.addColorStop(1, "rgba(80,100,150,0.3)");
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = variant.background;
  }
  ctx.fill();

  const svg = chinottoLogoSvg(variant.foreground);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    ctx.drawImage(img, 0, 0, LOGO_SIZE, LOGO_SIZE);
    return canvasToPngBytes(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
