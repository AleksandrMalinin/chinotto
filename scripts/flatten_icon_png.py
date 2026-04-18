#!/usr/bin/env python3
"""Flatten RGBA icon PNG onto #0a0a0e and save as opaque RGBA (alpha=255 everywhere).

Tauri embed checks require RGBA PNGs for bundle icons; opaque RGB is rejected.
qlmanage can leave semi-transparent edge pixels that Finder mats to white on DMG.
Run after qlmanage in generate-macos-app-icons.sh when Pillow is installed:
  pip3 install pillow

Usage: flatten_icon_png.py <path-to.png>
"""
from __future__ import annotations

import sys
from pathlib import Path

BG = (10, 10, 14)  # #0a0a0e


def main() -> None:
    try:
        from PIL import Image
    except ImportError:
        print(
            "flatten_icon_png.py: Pillow not installed; skipping alpha flatten. "
            "Install with: pip3 install pillow",
            file=sys.stderr,
        )
        sys.exit(0)

    path = Path(sys.argv[1]).resolve()
    im = Image.open(path).convert("RGBA")
    base = Image.new("RGBA", im.size, (*BG, 255))
    out = Image.alpha_composite(base, im)
    out.save(path, "PNG", optimize=True)
    print(f"Flattened alpha → opaque RGBA: {path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: flatten_icon_png.py <path-to.png>", file=sys.stderr)
        sys.exit(2)
    main()
