# Release (macOS)

## Prereqs (once per machine)

- Developer ID Application cert in Keychain.
- App Store Connect API key (`.p8`) on disk; values in `scripts/apple-release-env.sh` (copy from `scripts/apple-release-env.example.sh`). Never commit `.p8` or the filled env file.

## Ship a version

1. **Bump app version everywhere** — the same semver string must match in:
   - `package.json` → `"version"`
   - `src-tauri/tauri.conf.json` → `version`
   - `src-tauri/Cargo.toml` → `version`
   - **`src-tauri/Info.plist`** → **`CFBundleShortVersionString`** and **`CFBundleVersion`** (both; this file is often forgotten and then macOS / About shows the wrong version while JS and Tauri report the new one)
   - About / Chinotto Card if those read a hard-coded string

   **Sanity check** (repo root; replace `X.Y.Z` with the new version):

   ```bash
   rg --fixed-strings '"version": "X.Y.Z"' package.json src-tauri/tauri.conf.json &&
   rg --fixed-strings 'version = "X.Y.Z"' src-tauri/Cargo.toml &&
   rg --fixed-strings '<string>X.Y.Z</string>' src-tauri/Info.plist
   ```

   Add a **`## vX.Y.Z`** section to **`docs/github-release-notes.md`** (technical bullets for the GitHub Release body; same tag as git, e.g. `## v0.2.2` for `v0.2.2`). **User-oriented announcement copy** lives on the website, not in this file. CI appends a short fixed footer. Commit.

2. From repo root:
   ```bash
   source scripts/apple-release-env.sh
   ./scripts/build-release-macos.sh
   ```

3. **DMG step fails** (Tauri `bundle_dmg.sh` bug):
   ```bash
   cd src-tauri
   ./fix-dmg-bundler.sh
   ./target/release/bundle/dmg/bundle_dmg.sh
   ```
   Stale DMG: `rm -f target/release/bundle/dmg/Chinotto_*_aarch64.dmg target/release/bundle/dmg/rw.*.dmg`, then run `bundle_dmg.sh` again. Details: `src-tauri/DMG_BUNDLING_FIX.md`.

4. **Optional:** staple the DMG you distribute:
   ```bash
   xcrun stapler staple "src-tauri/target/release/bundle/dmg/Chinotto_<version>_<arch>.dmg"
   ```

5. **Git tag + publish (local DMG path):** `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z` → create or update the GitHub Release and attach the DMG you built above.

### CI release (alternative)

`.github/workflows/release.yml` runs on **`v*`** tag push (and can be run manually). It builds on GitHub Actions and creates/updates the release. The release body comes from **`docs/github-release-notes.md`** (technical). Heading **`## vX.Y.Z`** must match the tag. Manual runs use **`v` + `package.json` version** to pick the section. If that section is missing, the workflow logs a warning and only the fixed footer is used.

## Outputs

- `src-tauri/target/release/bundle/macos/Chinotto.app`
- `src-tauri/target/release/bundle/dmg/Chinotto_<version>_<arch>.dmg`

## Reference

- Tauri signing/notarization: https://v2.tauri.app/distribute/sign/macos/
