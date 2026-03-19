# macOS distribution: signing and notarization

Steps for a **Developer ID** build suitable for distribution outside the App Store (not ad-hoc `codesign -`). Aligns with [Tauri 2 — macOS code signing](https://v2.tauri.app/distribute/sign/macos/).

## Prerequisites

- Paid [Apple Developer Program](https://developer.apple.com/programs/) membership (distribution signing).
- Mac with the signing certificate installed in Keychain, or a `.p12` + password for CI (see Tauri doc).
- **Developer ID Application** certificate (not only Apple Development).

List signing identities:

```bash
security find-identity -v -p codesigning
```

Use the full string of the **Developer ID Application** line as `APPLE_SIGNING_IDENTITY`.

## Notarization credentials (App Store Connect API key)

Tauri can notarize using an API key (recommended over Apple ID password):

1. [App Store Connect](https://appstoreconnect.apple.com/) → **Users and Access** → **Integrations** → **App Store Connect API** → generate a key with **Developer** access.
2. Download the `.p8` private key once; store it outside the repo (e.g. `~/.appstoreconnect/AuthKey_XXX.p8`).
3. Set:

| Variable | Value |
| -------- | ----- |
| `APPLE_API_KEY` | Key ID from the table |
| `APPLE_API_ISSUER` | Issuer ID above the keys table |
| `APPLE_API_KEY_PATH` | Absolute path to the `.p8` file |

Never commit `.p8` files or real values. `*.p8` and `scripts/apple-release-env.sh` are gitignored.

## Local env file (optional)

Copy the example and fill in values:

```bash
cp scripts/apple-release-env.example.sh scripts/apple-release-env.sh
# edit scripts/apple-release-env.sh
source scripts/apple-release-env.sh
```

## Build

From the repository root, with the variables above exported (and signing identity set):

```bash
./scripts/build-release-macos.sh
```

This runs `npm run build` and `tauri build`. Tauri reads `APPLE_SIGNING_IDENTITY` and the `APPLE_API_*` variables during the macOS bundle step.

## Outputs

- App bundle: `src-tauri/target/release/bundle/macos/Chinotto.app`
- Disk image: `src-tauri/target/release/bundle/dmg/` (name includes version, e.g. `Chinotto_0.2.0_aarch64.dmg`)

If DMG creation fails, see `src-tauri/DMG_BUNDLING_FIX.md`.

## After notarization

If Apple approves but Gatekeeper still complains, staple the notarization ticket to the shipping artifact you distribute (often the DMG):

```bash
xcrun stapler staple "src-tauri/target/release/bundle/dmg/Chinotto_<version>_<arch>.dmg"
```

Use the exact filename from your `bundle/dmg` directory.

## Ad-hoc / dev only

For local testing only, `scripts/sign-macos.sh` signs with identity `-` (ad-hoc). That is **not** sufficient for downloads from the web; use Developer ID + notarization for public releases.

## CI

For GitHub Actions or other CI, use exported `.p12` with `APPLE_CERTIFICATE` (base64) and `APPLE_CERTIFICATE_PASSWORD`, or import into a temporary keychain as in the [Tauri macOS signing doc](https://v2.tauri.app/distribute/sign/macos/).
