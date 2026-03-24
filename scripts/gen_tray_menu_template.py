#!/usr/bin/env python3
"""
Tray template PNG: ChinottoLogo geometry (64×64), scaled up slightly to fill the 18×18 pt (@2x → 36 px) slot.
Black on transparent. High-res raster then LANCZOS to 36×36.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src-tauri" / "icons" / "tray_menu_template.png"
OUT_SIZE = 36
HR = 256
# Optical scale: use more of the template square (HIG ~18×18 pt); system still normalizes to bar height.
CONTENT_SCALE = 1.32


def main() -> None:
    c = HR // 2
    factor = (HR / 64.0) * CONTENT_SCALE

    def m(coord: float) -> float:
        return c + (coord - 32.0) * factor

    im = Image.new("RGBA", (HR, HR), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    r_out = int(round(22 * factor))
    stroke = max(2, int(round(2 * factor)))
    d.ellipse(
        (c - r_out, c - r_out, c + r_out, c + r_out),
        outline=(0, 0, 0, 255),
        width=stroke,
    )

    for x, y, r in ((32, 23, 5), (24, 34, 4), (40, 34, 4), (32, 41, 3)):
        cx = int(round(m(x)))
        cy = int(round(m(y)))
        rr = int(round(r * factor))
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=(0, 0, 0, 255))

    im = im.resize((OUT_SIZE, OUT_SIZE), Image.Resampling.LANCZOS)
    im.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
