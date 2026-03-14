# App icon

The app icon is built from `src-tauri/icons/icon.svg`. The canonical design (dark, minimal, one "C" for Chinotto) —same as ChinottoLogo (circle + four dots). Keep `src-tauri/icons/icon.svg` in sync with it.

**Archived (not in use):** An older icon (dark rounded square with light purple chevron) is saved as `docs/assets/icon-archived.png` for reference only. Do not use it as the app icon.

**Desktop app (window/dock icon):** The **window title bar and dock** use the raster files in `src-tauri/icons/` (32x32.png, 128x128.png, icon.icns, icon.ico). After changing `icon.svg`, regenerate them:

```bash
npm run tauri icon src-tauri/icons/icon.svg
```

Then **fully quit** the app (stop `tauri dev` or quit the built app) and start it again. On macOS, if the dock still shows the old icon, clear the icon cache and restart the Dock (see section below).

**If you still see the chevron (built app only):** The icon is embedded in the `.app` at build time. Remove the old Chinotto from Applications, then do a clean build and copy the new app:

```bash
# Quit Chinotto first, then:
rm -rf src-tauri/target/release/bundle
npm run tauri build
cp -R src-tauri/target/release/bundle/macos/Chinotto.app /Applications/
```

Then clear the icon cache and restart Dock (see section below), and open Chinotto from Applications.

**Browser tab icon (only when opening the app in a browser):** The doc uses `public/favicon.svg` and `public/favicon.ico`. If a browser tab still shows an old icon:

1. **Cursor Simple Browser:** Close the Simple Browser tab completely, then reopen the app URL (e.g. `http://localhost:5173`). Simple Browser caches favicons aggressively; closing the tab and reopening often picks up the new one. If it doesn't: right‑click the tab → "Clear Site Data" (or equivalent), then reload.
2. **Chrome/Safari:** Open `http://localhost:5173` in a normal browser. Hard refresh (Cmd+Shift+R). If still old: DevTools → Application (Chrome) or Storage (Safari) → clear storage for localhost, then reload.
3. **Confirm files:** In a new tab go to `http://localhost:5173/favicon.svg` — you should see the circle-four-dots SVG. If that's correct, the tab icon is just cache; keep closing/reopening or clearing site data until it updates.

## Canonical icon (SVG)

Same as `src/components/ChinottoLogo.tsx` (circle + four dots), with dark background and explicit colors for the bundle:

```svg
<svg width="256" height="256" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="14" fill="#0a0a0e"/>
  <circle cx="32" cy="32" r="22" stroke="#8a94c8" stroke-width="2" fill="none"/>
  <circle cx="32" cy="23" r="5" fill="#8a94c8"/>
  <circle cx="24" cy="34" r="4" fill="#8a94c8"/>
  <circle cx="40" cy="34" r="4" fill="#8a94c8"/>
  <circle cx="32" cy="41" r="3" fill="#8a94c8"/>
</svg>
```
Inner mark is scaled down (r=22, dots adjusted) so it sits with more padding from the square edges.

To regenerate all sizes:

```bash
npm run tauri icon src-tauri/icons/icon.svg
```

## Dock / panel bar not updating on macOS

macOS caches app icons. After changing the icon:

1. **Rebuild the app** so the bundle contains the new icon:
   ```bash
   npm run tauri build
   ```

2. **Quit Chinotto** completely (Cmd+Q or right‑click dock icon → Quit).

3. **Clear the icon cache and restart Dock:**
   ```bash
   rm -rf /Library/Caches/com.apple.iconservices.store 2>/dev/null
   killall Dock
   ```
   (The first line may need `sudo`; the second does not.)

4. **Open the app again** from the built bundle (e.g. `src-tauri/target/release/bundle/macos/Chinotto.app`) or run `npm run tauri dev` again.

If you run from **dev** (`tauri dev`), the dock may still show an old icon until you do a full **build** and open the built `.app` once; the dev binary can show a different icon than the release bundle.

### Still wrong? (desktop app)

1. **Regenerate icons** (if you haven't):
   ```bash
   npm run tauri icon src-tauri/icons/icon.svg
   ```

2. **Dev mode:** Force the dev binary to pick up the new icons by doing a clean Rust build, then run dev again:
   ```bash
   cd src-tauri && cargo clean && cd ..
   npm run tauri dev
   ```

3. **macOS dock/title bar:** Clear the icon cache and restart the Dock (see "Dock / panel bar not updating on macOS" above). Then quit the app fully and start it again.

4. **Built app only:** Remove the old app from `/Applications`, do a clean build, copy the new `.app`, then clear icon cache and restart Dock.
