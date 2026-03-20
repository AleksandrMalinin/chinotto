# Chinotto design system reference

Extracted from the desktop app for reuse as a reference when building the marketing site. This document describes the **existing** visual language; it does not prescribe new design.

---

## 1. Visual identity summary

Chinotto presents a **calm, dark thinking space**: deep charcoal background with subtle radial gradient glow and optional soft grain overlay. Typography is editorial (large input, readable body) with restrained letter-spacing. UI uses thin borders, low-contrast surfaces, and cool blue–grey accents. Motion is minimal in the main shell: soft entry animations, gentle hover states, and a slow ambient glow. The first-run empty stream uses **`StreamFlowPanel`** (glass, inner blobs, gradient strokes) in a two-column layout with staggered copy and keyboard hints. The welcome intro stays copy + ambient blobs + logo transition only. The feel is desktop-native and minimal—no productivity-dashboard chrome. (Source: comment block and implementation in `src/index.css`.)

---

## 2. Design tokens

**Source:** `src/index.css` `:root` and recurring values.

### Colors

| Token | Value | Usage |
|-------|--------|--------|
| `--bg` | `#0a0a0e` | Page/app background |
| `--bg-elevated` | `#0f0f14` | Elevated surfaces (defined, rarely used in current UI) |
| `--fg` | `#e4e4e9` | Primary text |
| `--fg-dim` | `#9b9fa9` | Secondary text, dimmed UI |
| `--muted` | `#5d6068` | Placeholder, tertiary text |
| `--section-fg` | `rgba(255,255,255,0.32)` | Section labels, very subtle |
| `--meta-fg` | `rgba(255,255,255,0.55)` | Timestamps, metadata, labels |
| `--border` | `rgba(255,255,255,0.07)` | Default borders |
| `--border-focus` | `rgba(138,148,200,0.36)` | Focus rings, active input underline |
| `--accent-subtle` | `rgba(128,138,188,0.08)` | Hover backgrounds, highlight bg |
| `--atmosphere-soft` | `rgba(72,88,132,0.14)` | Ambient tint (defined) |
| `--glow` | `rgba(90,108,156,0.16)` | Glow (defined) |

Recurring ad-hoc values (not tokens but consistent):  
`rgba(255,255,255,0.9)` / `0.88` body text; `rgba(255,255,255,0.92)` intro/hero; `rgba(255,255,255,0.06)`–`0.12` borders/hover; `rgba(128,138,188,0.06)` hover tint.

### Gradients and neon/glow effects (for chinotto-site)

Use these in the marketing site so it matches the app’s atmosphere. All values are taken from `src/index.css`.

**CSS custom properties for glow (add to `:root` if needed):**

```css
--chinotto-glow-violet: rgba(100, 110, 180, 0.22);
--chinotto-glow-blue: rgba(70, 100, 180, 0.14);
--chinotto-border: rgba(120, 130, 200, 0.12);
```

**1. Ambient background (cosmic gradient glow)**  
Main app background: two radial gradients, then blurred. Use on the site hero or full-page background.

```css
background:
  radial-gradient(ellipse 70vmax 45vmax at 15% 20%, rgba(100, 120, 180, 0.22) 0%, transparent 48%),
  radial-gradient(ellipse 60vmax 50vmax at 88% 82%, rgba(80, 100, 150, 0.18) 0%, transparent 48%);
filter: blur(80px);
```

Optional animation (subtle pulse): `opacity` 0.92↔1, `transform: scale(1)`↔`scale(1.03)`, ~20s ease-in-out infinite.

**2. Intro/welcome blobs (colored orbs)**  
Large, blurred circles with `mix-blend-mode: screen` for a soft neon look. Suited to hero or welcome sections.

```css
/* Violet */
background: rgba(124, 58, 237, 0.22);
filter: blur(180px);
mix-blend-mode: screen;

/* Cyan */
background: rgba(6, 182, 212, 0.2);

/* Orange */
background: rgba(249, 115, 22, 0.18);
```

Sizes in app: 48–55vmax; positions vary (e.g. 10% 20%, 50% 50%, right 15% top 60%). Optional slow drift via `transform: translate(...)` keyframes (45–55s).

**3. Card/panel neon (glass + glow)**  
For modals, feature cards, or CTAs. Violet/blue soft glow around the surface.

```css
box-shadow:
  0 0 0 1px rgba(255, 255, 255, 0.03) inset,
  0 0 48px -8px rgba(100, 110, 180, 0.22),
  0 0 80px -24px rgba(70, 100, 180, 0.14),
  0 24px 48px -16px rgba(0, 0, 0, 0.45);
```

Softer variant (e.g. initial state or smaller panels):

```css
box-shadow:
  0 0 0 1px rgba(255, 255, 255, 0.03) inset,
  0 0 24px -12px rgba(100, 110, 180, 0.1),
  0 0 40px -20px rgba(70, 100, 180, 0.06),
  0 24px 48px -16px rgba(0, 0, 0, 0.3);
```

**4. Linear gradient (cool tint surface)**  
Used for “pinned” or highlighted surfaces. Reuse for highlighted blocks or section backgrounds.

```css
background: linear-gradient(
  135deg,
  rgba(72, 88, 132, 0.07) 0%,
  rgba(90, 108, 156, 0.05) 50%,
  rgba(72, 88, 132, 0.06) 100%
);
box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.02);
```

Stronger on hover:

```css
background: linear-gradient(
  135deg,
  rgba(72, 88, 132, 0.1) 0%,
  rgba(90, 108, 156, 0.07) 50%,
  rgba(72, 88, 132, 0.08) 100%
);
box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.03);
```

**5. Text glow (headlines / hero)**  
Soft neon-style glow behind white text.

```css
text-shadow:
  0 0 24px rgba(255, 255, 255, 0.12),
  0 0 48px rgba(160, 180, 240, 0.08);
```

**6. Logo / icon glow**  
Very subtle warm glow (e.g. near logo).

```css
filter: drop-shadow(0 0 20px rgba(180, 170, 150, 0.06));
```

**7. Breathing glow (idle state)**  
Subtle pulse for a focal element (e.g. logo).

```css
/* Keyframes */
@keyframes chinotto-breathe {
  0%, 100% { opacity: 1; filter: drop-shadow(0 0 0 transparent); }
  50% { opacity: 0.97; filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.06)); }
}
```

**8. Glass overlay background**  
For modals or overlays.

```css
background: rgba(6, 6, 12, 0.62);
backdrop-filter: blur(14px);
-webkit-backdrop-filter: blur(14px);
```

**Summary for chinotto-site:**  
Reuse the **ambient radial gradients** (1) for full-page or hero background; **blobs** (2) for welcome/hero atmosphere; **card neon** (3) for feature cards or CTAs; **linear gradient** (4) for highlighted sections; **text glow** (5) for main headlines; **logo glow** (6) and **breathing** (7) for the mark/icon; **glass overlay** (8) for any modal or overlay.

### Typography

- **Body / UI:** `font-family: "Open Sauce One", system-ui, -apple-system, sans-serif`; `font-size: 16px`; `line-height: 1.5`. (Set on `body` in `src/index.css`.)
- **Intro / marketing copy:** `font-family: "Plus Jakarta Sans", system-ui, sans-serif` (`.intro-screen-copy`); loaded in `index.html` with Nunito/Plus Jakarta Sans.
- **Scale in use:** 11px (uppercase labels), 12–13px (meta, timestamps, small UI), 14–15px (secondary, triggers), 16px (body, entry text), 18px (primary input, search modal input), 20px (intro lines), 1.5rem (card title).
- **Weights:** 400 (body, meta), 500 (titles, buttons, input placeholder weight variance).
- **Letter-spacing:** `0.01em`–`0.02em` body/headings; `0.06em` + `text-transform: uppercase` for small labels (e.g. `.stream-section-title`, `.chinotto-card-section-title`).

### Spacing scale

Not a formal scale; recurring values:  
`0.2rem`–`0.4rem` (tight), `0.5rem`–`0.75rem` (compact), `1rem`–`1.5rem` (section), `1.75rem`–`2rem` (block), `2.5rem` (bottom padding), `32px` (vertical rhythm: input→stream, logo→text), `36px` / `32px` (app padding), `48px` (max-width container padding in some layouts). Gap: `0.75rem` (inline), `2rem` (intro), `1.5rem` (stream sections).

### Radius scale

- **0** – Entry input underline, resurfaced card, some dividers.
- **3px** – Inline highlight (e.g. search `mark`).
- **4px** – Buttons (focus ring), small controls.
- **6px** – Buttons, search trigger, list items, kbd, focus rings.
- **8px** – Entry row clickable, pinned row, related items.
- **12px** – Search modal input.
- **16px** – Resurfaced overlay card.
- **22px** – Chinotto “glass” identity card (logo/about modal).
- **50%** – Blobs, wordmark accent dot.

### Border styles

- **Default:** `1px solid var(--border)`.
- **Focus:** `1px solid var(--border-focus)`; often with `box-shadow: 0 1px 0 0 var(--border-focus)` for underline inputs.
- **Softer:** `rgba(255,255,255,0.07)`–`0.12` for hovers and modals.
- **Left accent:** Resurfaced card uses `border-left: 1px solid var(--border)` (no top/right/bottom).

### Shadows / glow effects

- **Focus (underline):** `box-shadow: 0 1px 0 0 var(--border-focus)`.
- **Focus (ring):** `outline: 1px solid var(--border-focus); outline-offset: 2px` (sometimes 4px).
- **Search modal input focus:** `box-shadow: 0 0 0 1px var(--border-focus)`.
- **Ambient background:** Radial gradients in `.app-bg`; `filter: blur(80px)`; `animation: ambient-glow` (opacity 0.92↔1, scale 1↔1.03).
- **Intro blobs:** Large blurred circles, `mix-blend-mode: screen`, violet/cyan/orange at ~0.18–0.22 opacity.
- **Chinotto card (modal):** Inset `0 0 0 1px rgba(255,255,255,0.03)`, violet/blue soft glows, `0 24px 48px -16px rgba(0,0,0,0.45)`.
- **Logo breathing:** `drop-shadow(0 0 8px rgba(255,255,255,0.06))`.
- **Text glow (intro):** `0 0 24px rgba(255,255,255,0.12)`, `0 0 48px rgba(160,180,240,0.08)`.

### Opacity

Used for hierarchy and states: 0.04–0.06 (grain, overlays), 0.08–0.12 (borders/hover), 0.5–0.55 (meta), 0.65 (pin icon), 0.88–0.92 (body/hero text), disabled 0.5.

### Transition style

- **Standard:** `--transition: 180ms ease-out` (often `220ms ease-out` for row/hover).
- **Intro/overlay:** `0.35s`–`0.5s ease-out` for fades and screen transitions.
- **Card enter:** `0.4s`–`0.5s` with cubic-bezier for modal scale/translate.

---

## 3. Component style patterns

**Files:** `src/index.css`, `src/components/ui/button.tsx`, `ui/input.tsx`, `ui/textarea.tsx`, `ui/card.tsx`; feature classes in `index.css`.

### Buttons

- **Primitive:** `src/components/ui/button.tsx` (CVA). Variants: `default` (filled dim), `ghost`, `outline`, `link`. Sizes: `default`, `sm`, `lg`, `icon`.
- **Tokens:** `rounded-md`, `text-sm`, `font-medium`; focus `ring-2 ring-[var(--border-focus)] ring-offset-2 ring-offset-[var(--bg)]`; disabled `opacity-50`.
- **Inline usage:** `.search-trigger-inline`, `.search-trigger` use ghost-like treatment: muted color, hover to `--fg-dim` or `--accent-subtle`. Back/dismiss links: no border, meta-fg, hover to fg-dim; focus ring `var(--border-focus)`, offset 2px, radius 4px.

### Inputs

- **Entry input (main):** Borderless, bottom border only `1px solid var(--border)`; `font-size: 18px`, `font-weight: 500`; placeholder `--muted`, 15px. Hover border lightens slightly; focus: `border-color: var(--border-focus)`, `box-shadow: 0 1px 0 0 var(--border-focus)`.
- **Shared input/textarea:** `src/components/ui/input.tsx`, `ui/textarea.tsx`: `border` or `border-b` `var(--border)`, `bg-transparent`, focus ring/underline, `transition` 180ms.
- **Search modal input:** `.search-center input`: rounded 12px, `0.5px solid rgba(255,255,255,0.12)`, transparent bg; focus `0 0 0 1px var(--border-focus)`.
- **Search inline:** `.search-input`: underline only, 13px, same focus underline pattern.

### Cards / panels

- **Resurfaced card (in-stream):** No full card; left border accent only, padding `0.75rem 0`, `border-left: 1px solid var(--border)`; hover border lightens.
- **Resurfaced overlay card:** `.resurfaced-overlay-card`: `rgba(255,255,255,0.04)` bg, `1px solid rgba(255,255,255,0.08)`, radius 16px, soft shadow; hover bg/border slightly stronger.
- **Chinotto card (identity modal):** `.chinotto-card`: glass `rgba(12,12,20,0.82)`, blur 20px, border with violet tint, radius 22px, violet/blue glow shadows; inner content typography uses `--fg`, `--muted`, `--meta-fg`.
- **Generic Card (ui/card.tsx):** `rounded-lg`, `border-l-2 border-[var(--border)]`, hover `border-white/10`; CardTitle: small uppercase `section-fg`.

### Lists / streams

- **Stream:** `.entry-stream`, `.stream-section`, `.stream-section-list`; section titles 13px `--meta-fg`; list unstyled.
- **Entry row:** Bottom border `var(--border)`, padding via `--row-padding-y` / `--row-padding-x`; last row no border.
- **Clickable row:** `.entry-row-clickable`: radius 8px; hover background `rgba(128,138,188,0.06)`, padding expands slightly; focus outline `var(--border-focus)`, offset 2px.
- **Pinned row:** `.entry-row-pinned`: soft gradient bg (blue-grey), radius 8px, `box-shadow: 0 0 0 1px rgba(255,255,255,0.02)`.
- **Body text:** `.entry-row-text` 16px, `rgba(255,255,255,0.9)`; `.entry-row-time` 13px `--meta-fg`. Search highlight: `mark` with `--accent-subtle`, radius 3px.

### Modals

- **Search overlay:** `.search-overlay`: fixed inset, `rgba(10,10,14,0.72)`, `backdrop-filter: blur(8px)`; content centered, max-width 420px; `.search-reveal` animation (opacity + scale 0.98 + translateY -4px).
- **Chinotto card overlay:** `.chinotto-card-overlay`: darker overlay, blur 14px; card animates in (scale + translateY).
- **Resurfaced overlay:** Lighter overlay, blur 12px; card animates translateY + scale.

---

## 4. Interaction patterns

- **Hover:** Slight border lighten; background `var(--accent-subtle)` or `rgba(128,138,188,0.06)`; text to `--fg` or `--fg-dim`. Buttons use variant-specific hovers (see button.tsx).
- **Active:** Entry row clickable: `rgba(128,138,188,0.04)`.
- **Focus:** Consistently `outline: 1px solid var(--border-focus)` with `outline-offset: 2px` (sometimes 4px); `border-radius: 4px` or `6px` on focus. Inputs often use bottom-border + box-shadow instead of ring.
- **Empty states:** `.stream-empty`, `.stream-loading`: 13px, `--meta-fg`. Search-empty stays minimal. First-run onboarding (`.stream-empty-onboarding`) uses a two-column layout, `StreamFlowPanel`, staggered motion, and keyboard hints; respects `prefers-reduced-motion`.
- **Motion:** No bounce/spring. Ease-out 180–220ms for UI; 0.25s–0.5s for overlays/entrance; ambient glow ~20s; intro blobs 45–55s drift. Entry list uses Framer Motion for list items (see `EntryStream.tsx`).

---

## 5. Screens / files that best represent the product style

- **Layout and shell:** `src/index.css` (`.app-shell`, `.app-bg`, `.app`), `src/App.tsx`.
- **Tokens and global feel:** `src/index.css` (`:root`, `body`, ambient background, grain).
- **Main capture + stream:** Entry input and stream in `index.css` (`.entry-input-row`, `.entry-input`, `.entry-stream`, `.entry-row-*`, `.stream-section-*`); `src/features/entries/EntryInput.tsx`, `EntryStream.tsx`.
- **Intro / welcome:** `src/index.css` (`.intro-screen*`, `.chinotto-logo-animated`), `src/components/IntroScreen.tsx`, `LogoTransition.tsx`, `ChinottoLogo.tsx`.
- **Search:** `src/index.css` (`.search-overlay`, `.search-center`, `.search-input`), `SearchInput.tsx`.
- **Modals / cards:** `src/index.css` (`.chinotto-card-overlay`, `.chinotto-card`, `.resurfaced-overlay`, `.resurfaced-overlay-card`); `ChinottoCard.tsx` if present.
- **Detail view:** `src/index.css` (`.entry-detail*`), `EntryDetail.tsx`.
- **Shared UI:** `src/components/ui/button.tsx`, `ui/input.tsx`, `ui/textarea.tsx`, `ui/card.tsx`.

---

## 6. Reuse guidance for the marketing site

**Reuse directly (tokens and feel):**

- `:root` color tokens (`--bg`, `--fg`, `--fg-dim`, `--muted`, `--border`, `--border-focus`, `--meta-fg`, `--accent-subtle`).
- `--transition` and the idea of 180–220ms ease-out.
- Typography: Open Sauce One for UI/headings; Syne or Plus Jakarta Sans for short marketing lines if you want parity with intro.
- Background concept: dark base + soft radial glow (values in `.app-bg` can be reused or slightly adjusted for web).
- **Gradients and neon/glow:** Use the dedicated subsection above (“Gradients and neon/glow effects (for chinotto-site)”): ambient radial gradients, intro blobs, card neon box-shadows, linear gradient surfaces, text glow, logo glow, breathing animation, glass overlays. Copy the CSS snippets from there so the site matches the app’s atmosphere.
- Focus pattern: thin outline with offset, no thick rings.

**Adapt, don’t copy literally:**

- **Layout:** App uses a single column, max-width 1100px, fixed padding; site will have different grid/sections—keep similar padding scale and max-width idea.
- **Components:** Buttons/inputs share tokens; site may need larger CTAs or different density—keep token usage, change size/weight as needed.
- **Modals/overlays:** Same overlay blur and transition style; content and layout will differ (e.g. signup vs identity card).
- **Intro blobs:** Strong for full-screen app intro; on the web, same palette and soft motion could be used more sparingly (e.g. hero only).

**Do not copy literally:**

- App-specific patterns: entry row padding expansion, pinned row gradient, stream section grouping—these are product UI, not global patterns.
- Chinotto card (logo modal) exact layout and copy—reuse glass/blur/radius/shadow style, not the content.
- Font loading: app uses Google Fonts (Nunito, Plus Jakarta Sans) and likely @fontsource for Open Sauce One; site should choose one approach and same families for consistency.
- Grain overlay and exact blur values are optional; they can be dropped or simplified on the site if performance or simplicity is a priority.

---

*Document generated from the Chinotto desktop app codebase. Update this file when the app’s visual system changes so the marketing site stays aligned.*
