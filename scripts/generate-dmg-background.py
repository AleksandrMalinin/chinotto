#!/usr/bin/env python3
"""Build src-tauri/dmg-background.png (660×400) for Tauri bundle.macOS.dmg.background."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src-tauri" / "dmg-background.png"

W, H = 660, 400
BG = (237, 237, 242)


def write_png(path: Path, width: int, height: int, rows: list[bytearray]) -> None:
    raw = b"".join(b"\x00" + bytes(r) for r in rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    comp = zlib.compress(raw, 9)
    data = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", comp)
        + chunk(b"IEND", b"")
    )
    path.write_bytes(data)


def main() -> None:
    rows = [bytearray([BG[0], BG[1], BG[2]] * W) for _ in range(H)]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    write_png(OUT, W, H, rows)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
