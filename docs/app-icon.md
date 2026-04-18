# App icon (Apple platforms)

Chinotto’s **bundle** icon (Dock, Launchpad, Finder, `.app`) comes from `src-tauri/icons/` (see `tauri.conf.json` → `bundle.icon`). The **canonical vector** is `src-tauri/icons/icon.svg`: artwork is clipped to an **outer rounded plate** (`clipPath` + `rx=22` in the 80×80 viewBox) so opaque pixels follow that curve—not a sharp square filled edge-to-edge. Nested inside is the usual ~82% scaled group (inner card + motif).

`qlmanage` renders SVG onto **white**, so corners become opaque white unless post-processed. **`scripts/flatten_icon_png.py`** applies the same outer radius as geometry (`rx = 22/80` of the raster edge) as an alpha mask, then mats only **semi-transparent** edge pixels onto `#0a0a0e`; corner pixels outside the plate stay **transparent** (RGBA). Dock and Finder still apply the system **squircle** on top.

The **DMG** window uses `dmg-background.png` (`tauri.conf.json` → `bundle.macOS.dmg.background`). Use a **light** surface so captions stay readable. Regenerate with `python3 scripts/generate-dmg-background.py`. After **any** `icon.svg` edit, run `./scripts/generate-macos-app-icons.sh` so `icon_1024.png`, `icon.icns`, and app set rasters stay in sync.

## Authoritative sources

1. **[App icons — Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)** — behavior and visual expectations.
2. **[Apple Design Resources](https://developer.apple.com/design/resources/)** — macOS **Production Templates** for grid and safe area when doing larger redesigns.

## macOS asset layout

| Path | Role |
|------|------|
| `src-tauri/icons/icon_1024.png` | **Master raster** (1024×1024), rendered from `icon.svg`. All smaller PNGs are **downscaled** from this file only (no upscaling). |
| `src-tauri/icons/macos/AppIcon.appiconset/` | Xcode-style catalog: `Contents.json` plus 16→1024 px slots (including `@2x` layers). **64×64** is `icon_32x32@2x.png`. |
| `src-tauri/icons/icon.icns` | Built with **`iconutil`** from a **copy** of the app icon set renamed to a directory ending in **`.iconset`** (see script below). `iconutil` does not accept the `.appiconset` extension. |

## Regenerate macOS icons (after editing `icon.svg`)

On macOS, from the repo root:

```bash
chmod +x scripts/generate-macos-app-icons.sh   # once
./scripts/generate-macos-app-icons.sh
```

This runs `qlmanage` (1024×1024 PNG from SVG), `sips` for every size in `AppIcon.appiconset`, copies the set to a temp `*.iconset` for `iconutil`, writes `icon.icns`, and refreshes Tauri’s flat PNGs (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`, etc.).

For **Windows / iOS / Android** variants from the same SVG, use [Tauri — icons](https://v2.tauri.app/develop/icons/) (`npx tauri icon …`). Re-run **`generate-macos-app-icons.sh` afterward** so `icon.icns` and the `AppIcon.appiconset` rasters stay aligned with `icon_1024.png` (Tauri’s CLI does not maintain the full macOS `iconutil` set in this repo layout).

## Dock icon at runtime

`src/lib/iconToPng.ts` renders a **1024×1024** PNG for the user-selected variant (`setDesktopIcon`), with the same **~82%** inset as `icon.svg`.

`set_macos_dock_icon` in `src-tauri/src/lib.rs` loads that bitmap into `NSImage` and sets **`setSize` to 512×512 pt** so 1024 px maps to a standard @2x app icon in the Dock.
