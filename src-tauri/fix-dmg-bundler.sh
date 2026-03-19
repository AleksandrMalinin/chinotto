#!/usr/bin/env bash
# Fixes the Tauri-generated bundle_dmg.sh to accept no arguments.
# Run from src-tauri/ after a failed build (script already generated).
# Then run: ./target/release/bundle/dmg/bundle_dmg.sh
# to create the DMG without re-running the full build.

set -e

SCRIPT_PATH="target/release/bundle/dmg/bundle_dmg.sh"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "Error: $SCRIPT_PATH not found"
  echo "Run 'tauri build' first (it will fail at DMG); then run this fix from src-tauri/"
  exit 1
fi

echo "Fixing $SCRIPT_PATH..."
export FIX_DMG_SCRIPT_PATH="$DIR/$SCRIPT_PATH"
python3 "$DIR/fix-dmg-bundler.py" || {
  echo "Error: block not found (script may already be patched or format changed)"
  exit 1
}

echo "✓ Fixed. Create the DMG with:"
echo "  ./target/release/bundle/dmg/bundle_dmg.sh"
echo ""
echo "If you get 'hdiutil: convert failed - File exists', remove the existing DMG first:"
echo "  rm -f target/release/bundle/dmg/Chinotto_0.2.0_aarch64.dmg"
echo "  ./target/release/bundle/dmg/bundle_dmg.sh"
