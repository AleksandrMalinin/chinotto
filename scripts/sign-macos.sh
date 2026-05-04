#!/bin/bash
set -e

# Re-sign the macOS app for local runs with ad-hoc identity (`codesign -`).
# Strips restricted entitlements (uses Chinotto.adhoc.entitlements): enough to open the .app
# from disk without a dev certificate. For native Sign in with Apple use `codesign-macos-dev.sh`
# (npm run build:macos-app:native) or a Mac App Store build (`build-mas-testflight.sh`).
#
# Usage:
#   ./scripts/sign-macos.sh
#   ./scripts/sign-macos.sh /path/to/Chinotto.app
#   APP_PATH=/path/to/Chinotto.app ./scripts/sign-macos.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENTITLEMENTS_PATH="$ROOT/src-tauri/Chinotto.adhoc.entitlements"

APP_PATH="${1:-${APP_PATH:-$ROOT/src-tauri/target/release/bundle/macos/Chinotto.app}}"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: app bundle not found: $APP_PATH" >&2
  exit 1
fi

echo "Signing $APP_PATH with entitlements (ad-hoc)..."
codesign --force --deep --sign - --entitlements "$ENTITLEMENTS_PATH" "$APP_PATH"
xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true
echo "Done."
