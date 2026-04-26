# Mac App Store — TestFlight (Tauri)

Pipeline for a **Mac App Store** build (TestFlight / App Store), **not** Developer ID and not DMG distribution.

Bundle ID must match App Store Connect and the App ID in the Apple Developer portal (this repo: `app.chinotto` in `src-tauri/tauri.conf.json`).

**arm64-only store builds:** Apple requires **macOS 12.0+** as the minimum system version (`LSMinimumSystemVersion` / Tauri `bundle.macOS.minimumSystemVersion`). Otherwise you must ship a **universal** binary (arm64 + x86_64).

## Prerequisites

1. **Mac App Store Connect** — macOS app record with the same bundle ID.
2. **Certificates** (Xcode → Settings → Accounts → Manage Certificates, or developer.apple.com). **Both** are required; having only **Apple Distribution** is not enough — without **Mac Installer Distribution**, `productbuild` cannot produce a Transporter-ready `.pkg`.
   - **Apple Distribution** (signs the `.app` for store submission).
   - **Mac Installer Distribution** (in `security find-identity` often appears as **3rd Party Mac Developer Installer: …**; signs the `.pkg`).
3. **Provisioning** — for Mac App Store, Xcode-managed signing usually creates the right provisioning profile when the App ID exists; manual re-sign still needs the **distribution** identity in the keychain.
4. **App ID capabilities** — enable only what you ship. Entitlements in this repo for store builds: `src-tauri/Chinotto.mas.entitlements` (sandbox, outbound network, user-selected files for export, microphone/audio for voice capture).
5. **Mac App Store provisioning profile** — TestFlight requires an embedded profile in the main bundle ([TN3125](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles#Profile-location): `Chinotto.app/Contents/embedded.provisionprofile`). Create one in [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/profiles/list) → **Profiles** → **+** → **Mac** → **App Store** (distribution profile for your App ID, linked to your **Apple Distribution** certificate) → **Download**. Set `MAS_PROVISIONING_PROFILE` in `scripts/mas-testflight-env.sh` to that file path; `build-mas-testflight.sh` copies it into the bundle before `codesign`.
6. **Firebase (optional sync)** — Native Sign in with Apple issues an ID token with JWT audience **`app.chinotto`**. In Firebase **Project settings → Your apps**, register an **Apple** app with that bundle ID (alongside **`com.chinotto.mobile`** for Expo). Without it, **`auth/invalid-credential`** after Touch ID. See **`docs/sync.md`** § Configuration.

## Entitlements (store build)

Use **`Chinotto.mas.entitlements`** as the **base** for store signing (sandbox, network, microphone, etc.). **`build-mas-testflight.sh`** merges it with **`com.apple.application-identifier`** and **`com.apple.developer.team-identifier`** from your **`MAS_PROVISIONING_PROFILE`** before `codesign` (TestFlight **90886**). Do not duplicate those two keys manually in the base plist unless you enjoy drift.

Day-to-day `Chinotto.entitlements` in `tauri.conf.json` is for local/ad-hoc workflows; the MAS script re-signs the built `.app` with the merged plist.

If App Review or `codesign` rejects a missing capability, add the matching entitlement **and** enable the capability on the App ID in the portal.

## Project-specific risks (review before first upload)

- **`tauri` feature `macos-private-api`** — may conflict with App Store review if private APIs are exercised. If binary analysis or review flags this, you will need a build that avoids private API (often a product/engineering tradeoff with tray / window behavior).
- **Tauri updater** — Mac App Store apps are updated by Apple; external update endpoints are a guideline risk. The MAS build script merges `tauri.mas-build.json` so **`createUpdaterArtifacts` is false** for this path. You may still want to gate or disable updater UI in store builds (separate code change if reviewers complain).

## Step-by-step

### 1. Configure signing env (local, not committed)

```bash
cp scripts/mas-testflight-env.example.sh scripts/mas-testflight-env.sh
# edit scripts/mas-testflight-env.sh — set real identity strings
```

List identities:

```bash
security find-identity -v -p codesigning
```

**Installer certificate:** `security find-identity -v -p codesigning` often lists **only** identities usable for **`codesign`** (the app). **Mac Installer / 3rd Party Mac Developer Installer** may **not** appear there even when the cert is valid in Keychain. Use:

```bash
security find-identity -v -p basic
```

Copy the full quoted string for **3rd Party Mac Developer Installer** (or equivalent) into `MAS_INSTALLER_SIGN_IDENTITY`.

### 2. Build, sign app, build signed `.pkg`

```bash
source scripts/mas-testflight-env.sh
./scripts/build-mas-testflight.sh
```

Outputs:

- App: `src-tauri/target/release/bundle/macos/Chinotto.app`
- Package: `builds/mas/Chinotto-<version>-mas.pkg`

### 3. Upload with Transporter

**Transporter accepts a `.pkg` only** for this Mac App Store path — not `Chinotto.app`, not `.dmg`, not `.tar.gz`. The file picker will grey those out or leave **Open** disabled.

Do **not** open `src-tauri/target/release/bundle/macos/` in Transporter. After `./scripts/build-mas-testflight.sh`, choose the installer from the repo:

`builds/mas/Chinotto-<version>-mas.pkg`

Open **Transporter** → **Add** → navigate to **`chinotto-app/builds/mas/`** → select the **`.pkg`** → Deliver. Processing appears in App Store Connect → TestFlight.

If **`builds/mas/` has no `.pkg`**, the `productbuild` step did not run (usually missing `MAS_INSTALLER_SIGN_IDENTITY` or the script stopped at `codesign`). Fix env and rerun the script from the repo root.

## Exact commands (reference)

Replace identity strings with yours from `security find-identity`.

**Sign the app** (after `npm run build` and `tauri build -b app`):

```bash
codesign --force --deep --options runtime --timestamp \
  --sign "Apple Distribution: Your Team (TEAMID)" \
  --entitlements src-tauri/Chinotto.mas.entitlements \
  "src-tauri/target/release/bundle/macos/Chinotto.app"
```

**Build the installer package**:

```bash
productbuild --component "src-tauri/target/release/bundle/macos/Chinotto.app" /Applications \
  --identifier "app.chinotto.pkg" \
  --version "2.0.0" \
  --sign "3rd Party Mac Developer Installer: Your Team (TEAMID)" \
  "builds/mas/Chinotto-X.Y.Z-mas.pkg"
```

Use the same **marketing / build version** as in `Info.plist` / `package.json` when you ship.

## Validate signing

**App bundle**

```bash
codesign --verify --strict --verbose=2 src-tauri/target/release/bundle/macos/Chinotto.app
codesign -dv --verbose=4 src-tauri/target/release/bundle/macos/Chinotto.app
```

**Installer**

```bash
pkgutil --check-signature builds/mas/Chinotto-X.Y.Z-mas.pkg
```

**Note:** `spctl --assess` is oriented toward **Developer ID** / Gatekeeper outside the store; a store-signed app may not assess the same way. Rely on `codesign --verify` and Transporter / App Store Connect validation.

## TestFlight / Connect checks (repo automation)

`./scripts/build-mas-testflight.sh` is intended to cover the recurring footguns in one path:

| Issue | What the script does |
|--------|-------------------------|
| **90889** — missing provisioning profile | Copies `MAS_PROVISIONING_PROFILE` → `Chinotto.app/Contents/embedded.provisionprofile` before `codesign` ([TN3125](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles#Profile-location)). |
| **90886** — profile has application identifier, signature does not | Runs `scripts/mas-merge-signing-entitlements.py` to merge `Chinotto.mas.entitlements` with **`com.apple.application-identifier`** and **`com.apple.developer.team-identifier`** from the **same** `.provisionprofile`; merged plist is **XML** (`FMT_XML`) for `codesign`. The script **fails the build** if `codesign -d --entitlements` does not show an application identifier. |
| **91109** — `com.apple.quarantine` on files inside the package | **`cp -X`** when copying the provisioning profile (no xattr copy), then **`xattr -cr`** on the `.app` before `codesign` and on the **`.pkg`** after `productbuild`. |
| **409** — arm64-only without macOS 12+ | Repo sets **`bundle.macOS.minimumSystemVersion`** `12.0`, **`LSMinimumSystemVersion`**, and **`MACOSX_DEPLOYMENT_TARGET`** (see earlier edits). |
| **87502** — bundle version not incremented | Bump **`bundle.macOS.bundleVersion`** and **`CFBundleVersion`** in `Info.plist` together; marketing semver can stay **2.0.0** (see [Version alignment](#version-alignment)). |

**You still must** keep the **App ID** on developer.apple.com aligned with **`Chinotto.mas.entitlements`** (capabilities the app claims). If Connect rejects “profile does not include entitlement X”, enable **X** on the App ID, regenerate the **Mac App Store** provisioning profile, update `MAS_PROVISIONING_PROFILE`, rebuild.

## Common errors

| Symptom | Likely cause |
|--------|----------------|
| `couldn't read .../cargo-target/.../libsqlite3-sys-.../out/bindgen.rs` | Stale or shared `CARGO_TARGET_DIR` (e.g. IDE cache). The repo script unsets it for the build; or run: `env -u CARGO_TARGET_DIR npm run build` then `env -u CARGO_TARGET_DIR` for `tauri build`. |
| `errSecInternalComponent` or keychain prompt loops | Private key not unlocked; run from Terminal session with keychain access; or import `.p12` and set partition list for `codesign`. |
| `resource fork, Finder information, or similar detritus not allowed` | Extended attributes on the bundle: `xattr -cr path/to/Chinotto.app`, then sign again. |
| `The main executable or its dependencies must be signed with Apple Distribution` | Wrong identity (e.g. Developer ID or Apple Development). Use **Apple Distribution** for the app. |
| `productbuild: error: Could not find appropriate signing identity` | Installer cert missing or wrong `MAS_INSTALLER_SIGN_IDENTITY` string. |
| Transporter: invalid signature / nested code | Sign inside-out or ensure `--deep` and consistent entitlements; remove stale signatures before re-signing; rebuild clean (`cargo clean` if needed). |
| Missing entitlement / sandbox violation at runtime | Add entitlement to `Chinotto.mas.entitlements` **and** enable matching capability on the App ID. |
| **91109** — `com.apple.quarantine` on `embedded.provisionprofile` / payload | Do not upload `.pkg` / `.app` straight from quarantined downloads without stripping xattrs; the MAS script runs `xattr -cr` (see table above). |

## Version alignment

**Marketing version** (`package.json`, root `version` in `tauri.conf.json`, `Cargo.toml`, `CFBundleShortVersionString` in `Info.plist`) can stay on one release (e.g. **2.0.0**).

**Each App Store / TestFlight upload** needs a **strictly higher** `CFBundleVersion` than any build already processed for that app. In Tauri 2 set **`bundle.macOS.bundleVersion`** (maps to `CFBundleVersion`); keep **`CFBundleVersion` in `Info.plist`** in sync with the same value so nothing drifts.

Example: `CFBundleShortVersionString` **2.0.0** + `bundleVersion` **2.0.1**, **2.0.2**, … for each new upload.

See also `docs/release-process.md` for full-repo semver bumps when you actually ship a new marketing version.

Git tags are optional until you actually ship; TestFlight still needs a **new build number** (`bundleVersion` / `CFBundleVersion`) on every upload.
