#!/bin/bash
set -e

# Sign the macOS app bundle with entitlements
# This is needed for development builds to access privacy-sensitive APIs like speech recognition

APP_PATH="./src-tauri/target/release/bundle/macos/Chinotto.app"
ENTITLEMENTS_PATH="./src-tauri/Chinotto.entitlements"

if [ -d "$APP_PATH" ]; then
    echo "Signing $APP_PATH with entitlements..."
    codesign --force --deep --sign - --entitlements "$ENTITLEMENTS_PATH" "$APP_PATH"
    echo "✓ App signed successfully"
else
    echo "Warning: App bundle not found at $APP_PATH"
    exit 1
fi
