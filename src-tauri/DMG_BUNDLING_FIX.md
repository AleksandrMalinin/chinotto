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

Tauri **regenerates** `bundle_dmg.sh` on every build, so the fix is lost each time. Do **not** run `tauri build` again after fixing (that would regenerate an unpatched script). Instead:

1. Run `npm run build && CI=false npx tauri build` and let it fail at the DMG step (this generates the script).
2. From **src-tauri/** run: `./fix-dmg-bundler.sh` to patch the script.
3. Create the DMG by running the patched script: `./target/release/bundle/dmg/bundle_dmg.sh`.

The DMG will be at `src-tauri/target/release/bundle/dmg/Chinotto_0.1.0_aarch64.dmg`. You can then sign and notarize it as usual.

If `bundle_dmg.sh` fails with **`hdiutil: convert failed - File exists`**, the output DMG from a previous run is still there. Remove it and run the script again:

```bash
rm -f target/release/bundle/dmg/Chinotto_0.1.0_aarch64.dmg
./target/release/bundle/dmg/bundle_dmg.sh
```

## Long-term Solution

This is a Tauri bundler issue. Possible permanent fixes:

1. Report the bug to Tauri and wait for a fix
2. Use a different bundler target (app bundle only, skip DMG)
3. Implement a pre-build hook that patches the script automatically

For now, the manual patched script works and will persist across builds unless the target directory is cleaned.
