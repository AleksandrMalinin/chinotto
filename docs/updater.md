# In-app updates (Tauri v2)

Chinotto uses the official **Tauri updater** with **GitHub Releases**. The app fetches `latest.json` from the URL in `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`.

## Repository URL

The app uses repo **`AleksandrMalinin/chinotto`**. If you fork or rename, change the `endpoints` entry to:

`https://github.com/<owner>/<repo>/releases/latest/download/latest.json`

## Signing key pair

Updates **must** be signed. The **public** key is embedded in `tauri.conf.json` (`plugins.updater.pubkey`). The **private** key must never be committed.

1. Generate (or reuse) a key pair, for example:
   ```bash
   pnpm exec tauri signer generate -w src-tauri/updater.key
   ```
   (`src-tauri/updater.key` is gitignored.)

2. Put the **public** key string (contents of `updater.key.pub`, one line) into `tauri.conf.json` → `plugins.updater.pubkey`.

3. For **local** release builds, export the private key (see [Tauri signing](https://v2.tauri.app/plugin/updater/#signing-updates)):
   - `TAURI_SIGNING_PRIVATE_KEY` — file path or key contents  
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — if the key has a password  

## GitHub Actions secrets

For `.github/workflows/release.yml`:

### Updater (minisign) — required

| Secret | Required | Purpose |
|--------|----------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Yes | Minisign private key (same pair as `pubkey` in `tauri.conf.json`) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | If the minisign key has a password | Optional |

`GITHUB_TOKEN` is provided automatically for uploading the release.

### Apple code signing & notarization (CI) — optional

Set these **together** when you want **Developer ID**–signed and **notarized** macOS builds on the runner (same model as [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/)).

**1. Certificate (.p12)**

1. Keychain Access → My Certificates → **Developer ID Application** → export as `.p12` with a password.
2. Base64 (single line):
   ```bash
   openssl base64 -A -in DeveloperID.p12 -out cert-base64.txt
   ```
3. Repository **Actions** secrets:

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Full contents of `cert-base64.txt` |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` export password (can be empty if none) |
| `APPLE_SIGNING_IDENTITY` | Exact string from `security find-identity -v -p codesigning`, e.g. `Developer ID Application: Your Name (TEAMID)` |

**2. App Store Connect API key (notarization)**

Create an API key under App Store Connect → Users and Access → Integrations → **App Store Connect API**.

| Secret | Purpose |
|--------|---------|
| `APPLE_CONNECT_P8` | Entire `.p8` file contents (PEM text) |
| `APPLE_API_KEY` | Key ID (e.g. `ABC123DEF4`) |
| `APPLE_API_ISSUER` | Issuer ID (UUID from the keys page) |

If `APPLE_CONNECT_P8` / `APPLE_API_KEY` / `APPLE_API_ISSUER` are omitted, CI still **codesigns** when the certificate secrets are set; **notarization** runs only when all three API secrets are set.

## CI artifacts

On push of tag `v*`, the workflow builds `--target aarch64-apple-darwin`, uploads bundles, signatures, and **`latest.json`** (via `tauri-action`, `uploadUpdaterJson` default).

## Website download (direct DMG)

GitHub’s `…/releases/latest` page does not start a download by itself. The workflow also uploads a **fixed asset name** (copy of the versioned DMG) so you can link straight to the file:

`https://github.com/AleksandrMalinin/chinotto/releases/latest/download/Chinotto_macOS_aarch64.dmg`

That URL tracks **latest** and triggers a browser download. If you fork the repo, replace the owner/name segment. The first release built **after** this upload step exists will create the asset; older releases won’t have it until you re-run the workflow for that tag or ship a new version.

## Users on older builds

**v0.2.0 and earlier** do not include the updater. Users must install **v0.2.1+** once from GitHub Releases (or another channel). After that, newer versions can be applied from the in-app nudge when a release is published.

## Windows / Intel macOS later

Add matrix rows in the workflow and ensure `latest.json` from the action includes the corresponding `platforms.*` entries. The static JSON must list only complete platform blocks Tauri validates.
