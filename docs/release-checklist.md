# Release checklist (1.x)

Use this before pushing a **version tag** that triggers [`.github/workflows/release.yml`](../.github/workflows/release.yml). For signing keys and CI secrets, see [`docs/updater.md`](updater.md).

---

## 1. Version numbers (must match)

| Location | Format |
|----------|--------|
| `package.json` → `version` | `X.Y.Z` (no `v`) |
| `src-tauri/tauri.conf.json` → `version` | same |
| `src-tauri/Cargo.toml` → `version` | same |

After edits: `npm install` if lockfile cares; `cargo check` in `src-tauri/` optional sanity check.

---

## 2. Technical release notes for GitHub

- Add or update **`## vX.Y.Z`** in [`docs/github-release-notes.md`](github-release-notes.md) *before* tagging.
- CI composes the GitHub Release body with [`scripts/extract-release-notes.py`](../scripts/extract-release-notes.py). Verify locally:
  ```bash
  python3 scripts/extract-release-notes.py vX.Y.Z docs/github-release-notes.md
  ```
- User-facing marketing copy belongs on the website, not in this file (see [`docs/architecture.md`](architecture.md)).

---

## 3. Updater signing (required for CI)

- [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) → `plugins.updater.pubkey` must match the **public** half of the minisign key pair.
- Repository **Actions** secret **`TAURI_SIGNING_PRIVATE_KEY`** = private key (and password secret if the key uses one). See [`docs/updater.md`](updater.md).

---

## 4. Optional: Apple codesign + notarization (CI)

If you want Developer ID + notarization on the GitHub runner, set the certificate and App Store Connect API secrets described in [`docs/updater.md`](updater.md) → *Apple code signing & notarization (CI)*. If omitted, the workflow still builds; signing behavior follows Tauri defaults for the environment.

---

## 5. Local smoke (recommended)

From repo root:

```bash
npm run build
npm run test:ts
```

Rust: `cd src-tauri && cargo test` when you changed the backend.

---

## 6. Tag and publish

- Create and push **`vX.Y.Z`** (with `v`). Example: `git tag v1.0.0 && git push origin v1.0.0`.
- If the tag already exists at the same commit (no new `push` event), run the **workflow_dispatch** “release” workflow manually in GitHub Actions (see workflow comment).

---

## 7. DMG step (local `tauri build` only)

Tauri may regenerate `bundle_dmg.sh` without arguments; if the DMG step fails, use [`src-tauri/DMG_BUNDLING_FIX.md`](../src-tauri/DMG_BUNDLING_FIX.md) and **`src-tauri/fix-dmg-bundler.sh`**. CI uses **tauri-action**; local macOS builds may still need the workaround.

---

## 8. After the workflow finishes

- Confirm the GitHub **Release** lists the **aarch64** `.app` / `.dmg` / signatures / **`latest.json`** as expected.
- Confirm the stable download asset **`Chinotto_macOS_aarch64.dmg`** exists (workflow uploads a copy for fixed URLs) — see [`docs/updater.md`](updater.md) → *Website download*.
