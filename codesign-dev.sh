#!/bin/bash
# Helper script to codesign the development binary with entitlements
# This is needed for features like speech recognition to work in dev mode

BINARY_PATH="./src-tauri/target/debug/Chinotto"
ENTITLEMENTS="./src-tauri/Chinotto.entitlements"

if [ ! -f "$BINARY_PATH" ]; then
    echo "Error: Binary not found at $BINARY_PATH"
    echo "Run 'npm run tauri dev' or 'cargo build' first"
    exit 1
fi

if [ ! -f "$ENTITLEMENTS" ]; then
    echo "Error: Entitlements file not found at $ENTITLEMENTS"
    exit 1
fi

echo "Codesigning $BINARY_PATH with entitlements..."
codesign --force --sign - --entitlements "$ENTITLEMENTS" "$BINARY_PATH"

if [ $? -eq 0 ]; then
    echo "✓ Successfully codesigned the binary"
    echo "You can now run 'npm run tauri dev' and speech recognition should work"
else
    echo "✗ Codesigning failed"
    exit 1
fi
