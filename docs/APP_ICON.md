# App icon

The app icon is built from `src-tauri/icons/icon.svg`. To regenerate all sizes:

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
