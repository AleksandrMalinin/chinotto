#!/usr/bin/env bash
# Build .app (app bundle only), re-sign for Mac App Store (sandbox + hardened runtime), produce .pkg for Transporter.
# Not for Developer ID / outside-the-store distribution.
#
# Prereq: npm deps, Rust target, Apple certs in keychain, App ID with matching capabilities in developer.apple.com.
#   source scripts/mas-testflight-env.sh   # copy from mas-testflight-env.example.sh first
#   ./scripts/build-mas-testflight.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f "$ROOT/scripts/mas-testflight-env.sh" ]; then
  # shellcheck source=/dev/null
  source "$ROOT/scripts/mas-testflight-env.sh"
fi

: "${MAS_APP_SIGN_IDENTITY:?Set MAS_APP_SIGN_IDENTITY (see scripts/mas-testflight-env.example.sh)}"
if [ -z "${MAS_INSTALLER_SIGN_IDENTITY:-}" ]; then
  echo "MAS_INSTALLER_SIGN_IDENTITY is not set (needed for productbuild / Transporter)."
  echo "Add certificate: Xcode → Settings → Accounts → your team → Manage Certificates → + → Mac Installer Distribution."
  echo "Then run: security find-identity -v -p basic   (installer certs often omit -p codesigning)"
  echo "Uncomment and set export MAS_INSTALLER_SIGN_IDENTITY=... in scripts/mas-testflight-env.sh (exact quoted string from the list)."
  exit 1
fi

if [ -z "${MAS_PROVISIONING_PROFILE:-}" ]; then
  echo "MAS_PROVISIONING_PROFILE is not set (path to a downloaded .provisionprofile file)."
  echo "TestFlight (90889): the main app bundle must contain Contents/embedded.provisionprofile."
  echo "Create one: developer.apple.com → Profiles → + → Mac → App Store (distribution) for App ID app.chinotto → Download."
  echo "Then: export MAS_PROVISIONING_PROFILE=\"\$HOME/Downloads/Chinotto_Mac_App_Store.provisionprofile\"  (your path)"
  exit 1
fi
if [ ! -f "$MAS_PROVISIONING_PROFILE" ]; then
  echo "MAS_PROVISIONING_PROFILE is not a file: $MAS_PROVISIONING_PROFILE"
  exit 1
fi

APP_NAME="Chinotto"
BUNDLE_ID="${BUNDLE_ID:-app.chinotto}"
# productbuild --version: prefer bundle.macOS.bundleVersion (CFBundleVersion) over marketing semver from package.json
VERSION="$(
  node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));const bv=j.bundle?.macOS?.bundleVersion;console.log(bv||require('./package.json').version);"
)"
APP_PATH="$ROOT/src-tauri/target/release/bundle/macos/${APP_NAME}.app"
ENTITLEMENTS="$ROOT/src-tauri/Chinotto.mas.entitlements"
OUT_DIR="$ROOT/builds/mas"
PKG_PATH="$OUT_DIR/${APP_NAME}-${VERSION}-mas.pkg"

if [ ! -f "$ENTITLEMENTS" ]; then
  echo "Missing entitlements: $ENTITLEMENTS"
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "==> Frontend + Tauri release (bundle: app only, no updater artifacts)"
# Cursor (and some CI) set CARGO_TARGET_DIR to a shared cache; that breaks libsqlite3-sys OUT_DIR.
env -u CARGO_TARGET_DIR npm run build
(
  cd "$ROOT/src-tauri"
  env -u CARGO_TARGET_DIR CI=false npx tauri build -b app --config tauri.mas-build.json
)

if [ ! -d "$APP_PATH" ]; then
  echo "Expected app not found: $APP_PATH"
  exit 1
fi

echo "==> Embed Mac App Store provisioning profile (required for TestFlight; TN3125)"
# https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles#Profile-location
# cp -X: do not copy extended attributes (avoids com.apple.quarantine on embedded.provisionprofile → 91109).
if cp -X "$MAS_PROVISIONING_PROFILE" "$APP_PATH/Contents/embedded.provisionprofile" 2>/dev/null; then
  :
else
  cp "$MAS_PROVISIONING_PROFILE" "$APP_PATH/Contents/embedded.provisionprofile"
fi

echo "==> Strip extended attributes on .app (TestFlight 91109: no com.apple.quarantine in store packages)"
xattr -cr "$APP_PATH"

echo "==> Merge entitlements with application id + team id from profile (TestFlight 90886)"
MERGED_ENT="$(mktemp -t chinotto-mas-entitlements)"
ENT_CHECK="$(mktemp -t chinotto-mas-entcheck)"
trap 'rm -f "$MERGED_ENT" "$ENT_CHECK"' EXIT
export BUNDLE_ID
python3 "$ROOT/scripts/mas-merge-signing-entitlements.py" \
  "$ENTITLEMENTS" \
  "$MAS_PROVISIONING_PROFILE" \
  "$MERGED_ENT"

echo "==> Codesign app (Mac App Store distribution + runtime + entitlements)"
codesign --force --deep --options runtime --timestamp \
  --sign "$MAS_APP_SIGN_IDENTITY" \
  --entitlements "$MERGED_ENT" \
  "$APP_PATH"

echo "==> Verify app signature"
codesign --verify --strict --verbose=2 "$APP_PATH"
codesign -dv --verbose=4 "$APP_PATH" 2>&1 | head -40

codesign -d --entitlements "$ENT_CHECK" "$APP_PATH"
if ! plutil -extract com.apple.application-identifier raw "$ENT_CHECK" >/dev/null 2>&1 \
  && ! plutil -extract application-identifier raw "$ENT_CHECK" >/dev/null 2>&1; then
  if ! /usr/bin/grep -q "application-identifier" "$ENT_CHECK" 2>/dev/null; then
    echo "error: signed app entitlements lack application-identifier (TestFlight 90886). Check merged plist and provisioning profile App ID."
    exit 1
  fi
fi

echo "==> productbuild .pkg (for Transporter)"
rm -f "$PKG_PATH"
productbuild --component "$APP_PATH" /Applications \
  --identifier "${BUNDLE_ID}.pkg" \
  --version "$VERSION" \
  --sign "$MAS_INSTALLER_SIGN_IDENTITY" \
  "$PKG_PATH"

echo "==> Strip extended attributes on .pkg (91109)"
xattr -cr "$PKG_PATH" 2>/dev/null || true

echo "==> Verify installer signature"
pkgutil --check-signature "$PKG_PATH"

echo "Done. Upload with Transporter:"
echo "  $PKG_PATH"
