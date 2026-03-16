# Icon variant system

The app uses a logo/icon variant system for the Settings (Chinotto Card) app icon picker and for the dock/taskbar icon.

---

## How to use (step by step)

1. **Run the desktop app**  
   Use Tauri, not the browser: `npm run tauri dev` (or build and open the built app). The icon switcher only affects the real app window/dock icon when run as a Tauri app.

2. **Open Settings**  
   Click the **Chinotto logo** (top-left) in the main window. The Settings panel opens (icon picker, privacy, shortcuts).

3. **Change the dock/taskbar icon**  
   In Settings, find the **ICON** section (six logo tiles). Click any tile. Your choice is saved and the **dock icon (macOS)** or **taskbar icon (Windows/Linux)** updates immediately.

4. **Next time you open the app**  
   The last chosen icon is restored and applied to the dock/taskbar on launch.

**If nothing seems to happen:** Make sure you’re running `npm run tauri dev` (or the built .app/.exe), not `npm run dev` in the browser. The picker only affects the real app icon when running under Tauri.

---

## Architecture

- **Single source of shape:** `ChinottoLogo` stays the only logo component. It uses `currentColor` for stroke and fill, so variants are driven by **color + container style** only.
- **Variant = data, not components:** Each variant is a record (id, name, foreground, background, optional border/glow). The same `ChinottoLogo` is rendered inside a wrapper whose style comes from the variant.
- **One size in the showcase:** All previews use a fixed size (64px) so the demo compares style, not scale. Resizing is out of scope for this exploration.
- **No theme system:** This is an icon-style layer only. It does not introduce app-wide theming or new design tokens beyond what’s already in the design system.

---

## Data structure

Defined in `src/lib/iconVariants.ts`:

```ts
type IconVariant = {
  id: string;           // stable id for persistence / selection
  name: string;          // display label
  foreground: string;    // CSS color for the logo (currentColor)
  background: string;    // CSS background for the icon container
  border?: string;       // optional container border
  boxShadow?: string;   // optional glow
};
```

`ICON_VARIANTS` is an array of these records. Adding a variant = adding one object; no new components.

---

## Demo

- **Screen:** `IconVariantShowcase` in `src/components/IconVariantShowcase.tsx`. Renders a grid of all variants at 64px with labels.
- **Access (dev only):** Open the app with hash `#icon-variants` (e.g. `http://localhost:5173/#icon-variants`). Implemented in `main.tsx` via a small `Root` wrapper that switches between `App` and `IconVariantShowcase` when the hash matches.

---

## Variants included (10)

| Id | Name | Notes |
|----|------|--------|
| default | Default | Charcoal bg, blue-grey logo (current in-app accent) |
| light | Light on dark | Elevated surface, light logo |
| muted | Muted | Low-contrast grey on dark |
| violet | Violet | Solid violet bg, light logo (intro blob family) |
| cyan | Cyan | Solid cyan bg, dark logo |
| orange | Orange | Solid orange bg, dark logo |
| gradient | Atmospheric gradient | Soft blue gradient, light logo |
| border-glow | Border + glow | Dark bg, thin border + soft glow |
| glass | Glass | Dark translucent, subtle border |
| accent | Accent | Radial blue-grey glow |

All stay within the Chinotto palette (dark, minimal, atmospheric). No playful or off-brand colors.

---

## Selectable app icons

The Settings panel exposes six variants: **default**, **light**, **violet**, **cyan**, **orange**, **gradient**. The full variant set (including muted, border-glow, glass, accent) is defined in `src/lib/iconVariants.ts`; only these six are offered in the picker.

---

## Desktop dock / taskbar icon

The in-app icon picker (Settings → ICON section) updates the **window/dock icon** where the platform allows:

- **Implementation:** When the user picks a variant, the app renders the logo (variant foreground + background) to a 256×256 PNG via `src/lib/iconToPng.ts` (canvas + SVG logo), then calls Tauri’s `window.setIcon()` with the PNG bytes. The same icon is applied on app load from the stored preference.
- **Tauri:** `image-png` feature enabled; permission `core:window:allow-set-icon` in capabilities.
- **Windows / Linux:** The taskbar/dock icon updates when you change the variant.
- **macOS:** The dock icon is changed at runtime via `NSApplication.setApplicationIconImage:`. A Tauri command `set_app_icon` receives PNG bytes (base64), builds an `NSImage` from them, and sets it as the application icon so the dock updates immediately.
