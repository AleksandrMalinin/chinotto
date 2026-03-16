# DMG Bundling Fix

## Issue

Tauri's bundler generates a `bundle_dmg.sh` script but calls it without the required arguments, causing the build to fail with:

```
failed to bundle project error running bundle_dmg.sh: `failed to run .../bundle_dmg.sh`
```

The generated script expects two arguments: `<output_name.dmg>` and `<source_folder>`, but Tauri v2 invokes it with no arguments.

## Root Cause

The `bundle_dmg.sh` script (lines 286-289 in the generated version) checks for arguments and exits if they're missing. This appears to be a bug or incompatibility in Tauri 2's DMG bundler.

## Solution

The fix modifies `bundle_dmg.sh` to detect when it's called without arguments and automatically set defaults for Tauri builds:

- DMG output path: same directory as the script
- Source folder: `../macos` (where `Chinotto.app` is located)
- Enables `SKIP_JENKINS=1` and `SANDBOX_SAFE=1` for non-GUI build environments

## Current Status

The `target/release/bundle/dmg/bundle_dmg.sh` script has been manually patched and should work for subsequent builds **as long as the target directory isn't cleaned**.

## If the Build Fails Again

If you run `cargo clean` or the script gets regenerated, you'll need to re-apply the fix:

1. Run `npm run tauri build` and let it fail (this generates the script)
2. Run `./src-tauri/fix-dmg-bundler.sh` to patch the script
3. Run `npm run tauri build` again - it should now succeed

## Automatic Fix (Alternative)

Add this to package.json scripts to automatically fix on build failures:

```json
"tauri:build": "npm run tauri build || (cd src-tauri && ./fix-dmg-bundler.sh && cd .. && npm run tauri build)"
```

## Long-term Solution

This is a Tauri bundler issue. Possible permanent fixes:

1. Report the bug to Tauri and wait for a fix
2. Use a different bundler target (app bundle only, skip DMG)
3. Implement a pre-build hook that patches the script automatically

For now, the manual patched script works and will persist across builds unless the target directory is cleaned.
