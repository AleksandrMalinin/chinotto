#!/usr/bin/env bash
# Regenerate macOS app icon assets from src-tauri/icons/icon.svg.
# Requires macOS (qlmanage, sips, iconutil). All rasters are downscaled from a 1024×1024 master only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$ROOT/src-tauri/icons/icon.svg"
MASTER="$ROOT/src-tauri/icons/icon_1024.png"
APPSET="$ROOT/src-tauri/icons/macos/AppIcon.appiconset"
ICONS="$ROOT/src-tauri/icons"
ICNS_OUT="$ICONS/icon.icns"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Run on macOS (qlmanage, sips, iconutil)." >&2
  exit 1
fi

qlmanage -t -s 1024 -o "$ICONS" "$SVG" >/dev/null
mv -f "$ICONS/icon.svg.png" "$MASTER"

mkdir -p "$APPSET"
sips -z 16 16 "$MASTER" --out "$APPSET/icon_16x16.png"
sips -z 32 32 "$MASTER" --out "$APPSET/icon_16x16@2x.png"
sips -z 32 32 "$MASTER" --out "$APPSET/icon_32x32.png"
sips -z 64 64 "$MASTER" --out "$APPSET/icon_32x32@2x.png"
sips -z 128 128 "$MASTER" --out "$APPSET/icon_128x128.png"
sips -z 256 256 "$MASTER" --out "$APPSET/icon_128x128@2x.png"
sips -z 256 256 "$MASTER" --out "$APPSET/icon_256x256.png"
sips -z 512 512 "$MASTER" --out "$APPSET/icon_256x256@2x.png"
sips -z 512 512 "$MASTER" --out "$APPSET/icon_512x512.png"
sips -z 1024 1024 "$MASTER" --out "$APPSET/icon_512x512@2x.png"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp -R "$APPSET" "$TMP/Chinotto.iconset"
iconutil -c icns "$TMP/Chinotto.iconset" -o "$ICNS_OUT"

sips -z 32 32 "$MASTER" --out "$ICONS/32x32.png"
sips -z 64 64 "$MASTER" --out "$ICONS/64x64.png"
sips -z 128 128 "$MASTER" --out "$ICONS/128x128.png"
sips -z 256 256 "$MASTER" --out "$ICONS/128x128@2x.png"
sips -z 512 512 "$MASTER" --out "$ICONS/icon.png"

echo "Updated: $MASTER, $APPSET, $ICNS_OUT, bundle PNGs under $ICONS"
