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

## Notarization rejected: "Archive contains critical validation errors"

If Apple notarization fails and the log shows **invalid signature** / **no secure timestamp** / **hardened runtime** on paths like `Chinotto_0.1.0_aarch64.dmg/rw.XXXXX.Chinotto_0.1.0_aarch64.dmg/Chinotto.app`, the DMG was built from a dirty state: temp `rw.*.dmg` files were included in the volume, and the binary inside them is not the one Tauri signed.

**Fix: clean everything, then create the DMG again.**

From **src-tauri/**:

```bash
# 1. Remove all DMG artifacts (final + temp rw.*.dmg)
rm -f target/release/bundle/dmg/Chinotto_0.1.0_aarch64.dmg
rm -f target/release/bundle/dmg/rw.*.Chinotto_0.1.0_aarch64.dmg

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
