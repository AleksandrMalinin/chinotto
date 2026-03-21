/**
 * Renders the Chinotto logo (variant style) to PNG bytes for use as a window/dock icon.
 * Used only when running in Tauri; no-op in browser.
 *
 * Canvas size matches the 1024×1024 pt **large** app icon slot Apple uses in asset catalogs
 * (see Human Interface Guidelines → App icons; production templates on developer.apple.com/design/resources).
 * Passing a high-resolution image to `NSApplication.setApplicationIconImage` avoids a soft/upscaled Dock tile.
 */

import type { IconVariant } from "./iconVariants";

/** Large app icon dimension (pt/px @1x) used in Apple’s icon production workflow. */
const ICON_CANVAS_PX = 1024;

/**
 * Empty margin inside the canvas so the glyph does not run to the edge of the Dock tile.
 * Align with bundle `icon.svg`: ~82% visual fill (same inset as the scaled group there).
 */
const CONTENT_INSET_RATIO = (1 - 0.82) / 2;

/** Logo paths match bundle icon.svg (circles only; background is drawn on canvas). */
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

/** Corner radius scales with canvas (~22% of side) so shape matches prior 256px proportions at 1024px. */
const CORNER_RADIUS = Math.round((56 / 256) * ICON_CANVAS_PX);

/**
 * Renders the given variant to a 1024×1024 PNG: rounded-rect background (transparent corners) + logo ~55% centered.
 * Corners are transparent so the image isn’t a full square; dock shows the rounded shape. Used for the dock icon in Tauri.
 */
export async function variantToPngBytes(variant: IconVariant): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_CANVAS_PX;
  canvas.height = ICON_CANVAS_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d not available");

  const pad = ICON_CANVAS_PX * CONTENT_INSET_RATIO;
  const inner = ICON_CANVAS_PX - 2 * pad;
  const scale = inner / ICON_CANVAS_PX;

  ctx.save();
  ctx.translate(pad, pad);
  ctx.scale(scale, scale);

  ctx.beginPath();
  ctx.roundRect(0, 0, ICON_CANVAS_PX, ICON_CANVAS_PX, CORNER_RADIUS);
  if (variant.id === "gradient") {
    const g = ctx.createLinearGradient(0, 0, ICON_CANVAS_PX, ICON_CANVAS_PX);
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
    ctx.drawImage(img, 0, 0, ICON_CANVAS_PX, ICON_CANVAS_PX);
    ctx.restore();
    return canvasToPngBytes(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
