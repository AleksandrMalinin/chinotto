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

Tauri **regenerates** `bundle_dmg.sh` on every `tauri build`, so any manual edit is overwritten. Use **`fix-dmg-bundler.sh`** after each failed DMG step (it reads `tauri.conf.json` for product name, version, and maps this machine’s CPU to the DMG filename, e.g. `Chinotto_1.0.0_aarch64.dmg`).

## If the Build Fails Again

1. Run `tauri build` (or your usual command) and let it fail at the DMG step — this generates `bundle_dmg.sh`.
2. From **`src-tauri/`** run: **`./fix-dmg-bundler.sh`** to patch the script.
3. Create the DMG: **`./target/release/bundle/dmg/bundle_dmg.sh`**.

The DMG lands next to the script under `target/release/bundle/dmg/` (name matches `tauri.conf.json` + arch). Sign and notarize as usual.

If `bundle_dmg.sh` fails with **`hdiutil: convert failed - File exists`**, remove the previous DMG and rerun:

```bash
rm -f target/release/bundle/dmg/Chinotto_*_*.dmg
./target/release/bundle/dmg/bundle_dmg.sh
```

## Notarization rejected: "Archive contains critical validation errors"

If Apple notarization fails and the log shows **invalid signature** / **no secure timestamp** / **hardened runtime** on paths like `Chinotto_1.0.0_aarch64.dmg/rw.XXXXX.Chinotto_1.0.0_aarch64.dmg/Chinotto.app`, the DMG was built from a dirty state: temp `rw.*.dmg` files were included in the volume, and the binary inside them is not the one Tauri signed.

**Fix: clean everything, then create the DMG again.**

From **src-tauri/**:

```bash
# 1. Remove all DMG artifacts (final + temp rw.*.dmg)
rm -f target/release/bundle/dmg/Chinotto_*_*.dmg
rm -f target/release/bundle/dmg/rw.*.dmg

# 2. Ensure the app bundle folder has only Chinotto.app (no stray rw.*.dmg)
rm -f target/release/bundle/macos/rw.*.dmg

# 3. Recreate the DMG (script must already be patched)
./target/release/bundle/dmg/bundle_dmg.sh
```

Then sign and submit the **new** DMG for notarization (and staple after approval). The `.app` in `target/release/bundle/macos/` is the one Tauri signed and notarized; the script uses that folder as the source, so the new DMG will contain only that valid app.

## Long-term Solution

This is a Tauri bundler issue. Possible permanent fixes:

1. Report the bug to Tauri and wait for a fix
2. Use a different bundler target (app bundle only, skip DMG)
3. Implement a pre-build hook that patches the script automatically

For now, the manual patched script works and will persist across builds unless the target directory is cleaned.
