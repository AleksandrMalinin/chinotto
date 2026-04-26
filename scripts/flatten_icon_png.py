#!/usr/bin/env python3
"""Normalize qlmanage raster + matte fringe pixels onto #0a0a0e.

qlmanage composites SVG transparency onto white, so bbox corners become opaque white. We apply
the same outer rounded plate as in `icon.svg` (viewBox 80×80, rx=22) as an alpha mask, then flat
semi-transparent anti-alias onto #0a0a0e. Fully transparent corners stay transparent.

Tauri expects PNG with an alpha channel (RGBA), not RGB-only.

Usage: flatten_icon_png.py <path-to.png>

Requires Pillow.
"""
from __future__ import annotations

import sys
from pathlib import Path

BG = (10, 10, 14)  # #0a0a0e


def main() -> None:
    try:
        from PIL import Image, ImageChops, ImageDraw
    except ImportError:
        print(
            "flatten_icon_png.py: Pillow not installed; skipping. "
            "Install with: pip3 install pillow",
            file=sys.stderr,
        )
        sys.exit(0)

    path = Path(sys.argv[1]).resolve()
    im = Image.open(path).convert("RGBA")

    # Match `icon.svg`: plate clip is rect 80×80 with rx=22 (user units).
    w, h = im.size
    corner_r = round(22 * min(w, h) / 80.0)
    plate = Image.new("L", im.size, 0)
    draw = ImageDraw.Draw(plate)
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=corner_r, fill=255)

    r, g, b, a = im.split()
    a_masked = ImageChops.multiply(a, plate)
    im = Image.merge("RGBA", (r, g, b, a_masked))

    px_in = im.load()
    out = Image.new("RGBA", im.size)
    px_out = out.load()
    br, bg, bb = BG

    for y in range(im.height):
        for x in range(im.width):
            r_, g_, b_, a_ = px_in[x, y]
            if a_ == 0:
                px_out[x, y] = (0, 0, 0, 0)
            elif a_ == 255:
                px_out[x, y] = (r_, g_, b_, 255)
            else:
                nr = (r_ * a_ + br * (255 - a_)) // 255
                ng = (g_ * a_ + bg * (255 - a_)) // 255
                nb = (b_ * a_ + bb * (255 - a_)) // 255
                px_out[x, y] = (nr, ng, nb, 255)

    out.save(path, "PNG", optimize=True)
    print(f"Masked plate rx=22/80 + fringe onto #0a0a0e: {path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: flatten_icon_png.py <path-to.png>", file=sys.stderr)
        sys.exit(2)
    main()
