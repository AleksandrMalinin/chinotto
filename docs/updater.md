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

| Secret | Required | Purpose |
|--------|----------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Yes | Private key (same pair as `pubkey` in config) so CI can sign update artifacts |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | If key has password | Optional |

`GITHUB_TOKEN` is provided automatically for uploading the release.

**Optional (local-style macOS signing/notarization in CI):** not configured in the default workflow; add certificate import + Apple API key steps if you want signed/notarized CI builds.

## CI artifacts

On push of tag `v*`, the workflow builds `--target aarch64-apple-darwin`, uploads bundles, signatures, and **`latest.json`** (via `tauri-action`, `uploadUpdaterJson` default).

## Users on older builds

**v0.2.0 and earlier** do not include the updater. Users must install **v0.2.1+** once from GitHub Releases (or another channel). After that, newer versions can be applied from the in-app nudge when a release is published.

## Windows / Intel macOS later

Add matrix rows in the workflow and ensure `latest.json` from the action includes the corresponding `platforms.*` entries. The static JSON must list only complete platform blocks Tauri validates.
