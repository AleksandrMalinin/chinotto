#!/bin/bash
set -euo pipefail
# Team-sign a release .app for local runs with native Sign in with Apple (Chinotto.entitlements).
# macOS often refuses to launch (RBS / error 163) unless the bundle contains embedded.provisionprofile
# that matches app.chinotto — same as Xcode does when you "Run".
#
# This script copies the first suitable profile from Xcode's cache automatically (searches both
# Xcode 16+ and legacy paths):
#   ~/Library/Developer/Xcode/UserData/Provisioning Profiles/
#   ~/Library/MobileDevice/Provisioning Profiles/
# If both are empty: Xcode → Settings → Accounts → your team → "Download Manual Profiles".

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDENT="${APPLE_SIGNING_IDENTITY:?Set APPLE_SIGNING_IDENTITY. List keys: security find-identity -v -p codesigning}"
APP="${1:-$ROOT/src-tauri/target/release/bundle/macos/Chinotto.app}"
OUT="${CHINOTTO_NATIVE_APP_OUT:-$ROOT/builds/Chinotto-native.app}"
PROFILE_DIRS=(
  "${HOME}/Library/Developer/Xcode/UserData/Provisioning Profiles"
  "${HOME}/Library/MobileDevice/Provisioning Profiles"
)

pick_provisioning_profile() {
  if [[ -n "${CHINOTTO_PROVISIONING_PROFILE:-}" ]]; then
    if [[ ! -f "$CHINOTTO_PROVISIONING_PROFILE" ]]; then
      echo "CHINOTTO_PROVISIONING_PROFILE is not a file: $CHINOTTO_PROVISIONING_PROFILE" >&2
      exit 1
    fi
    echo "$CHINOTTO_PROVISIONING_PROFILE"
    return 0
  fi
  shopt -s nullglob
  local d f decoded dev_match=""
  for d in "${PROFILE_DIRS[@]}"; do
    [[ -d "$d" ]] || continue
    for f in "$d"/*.mobileprovision; do
      decoded="$(security cms -D -i "$f" 2>/dev/null)" || continue
      echo "$decoded" | grep -q "app\.chinotto" || continue
      if echo "$decoded" | grep -q "<key>get-task-allow</key>"; then
        echo "$f"
        shopt -u nullglob
        return 0
      fi
      [[ -z "$dev_match" ]] && dev_match="$f"
    done
  done
  shopt -u nullglob
  [[ -n "$dev_match" ]] && echo "$dev_match" && return 0
  return 1
}

if [[ ! -d "$APP" ]]; then
  echo "Missing bundle: $APP (run tauri build -b app first)" >&2
  exit 1
fi

ENT="$ROOT/src-tauri/Chinotto.entitlements"

PLIST="$APP/Contents/Info.plist"
if /usr/libexec/PlistBuddy -c "Print :LSRequiresCarbon" "$PLIST" &>/dev/null; then
  /usr/libexec/PlistBuddy -c "Set :LSRequiresCarbon false" "$PLIST" || true
else
  /usr/libexec/PlistBuddy -c "Add :LSRequiresCarbon bool false" "$PLIST" || true
fi

if picked="$(pick_provisioning_profile)"; then
  cp "$picked" "$APP/Contents/embedded.provisionprofile"
  echo "Embedded provisioning profile: $picked"
else
  echo "" >&2
  echo "No provisioning profile for app.chinotto found (and CHINOTTO_PROVISIONING_PROFILE not set)." >&2
  echo "macOS will often fail to open the app (error 163) without one when using Sign in with Apple." >&2
  echo "Fix: Xcode → Settings → Accounts → select your Apple ID → Download Manual Profiles." >&2
  echo "Then re-run this script. It searches:" >&2
  for d in "${PROFILE_DIRS[@]}"; do echo "  $d" >&2; done
  echo "" >&2
  exit 1
fi

echo "Signing with: $IDENT"
echo "Entitlements: $ENT"
echo "Bundle: $APP"
codesign --force --deep --timestamp --sign "$IDENT" --entitlements "$ENT" "$APP"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true

rm -rf "$OUT"
cp -R "$APP" "$OUT"
xattr -dr com.apple.quarantine "$OUT" 2>/dev/null || true
echo "Copied to: $OUT"
