# Chinotto desktop → mobile companion design system

Design system extracted from the Chinotto desktop app (`src/index.css`, `src/App.tsx`, `src/features/entries/*`, `src/components/ChinottoLogo.tsx`) for building a **capture-first** React Native (Expo) companion. The mobile app should feel consistent with desktop but simpler, calmer, and faster.

---

## 1. Visual language

### What the app actually does

- **Background:** Near-black charcoal `#0a0a0e` with a **fixed, blurred dual radial** “cosmic” glow (cool blue–violet tones), a **20s** opacity/scale pulse (`ambient-glow`), and a **very light noise overlay** (SVG fractal noise at ~4% opacity, `mix-blend-mode: overlay`). Documented intent: *“calm thinking space, not a productivity dashboard”* (`src/index.css` header comment).
- **Foreground:** Primary text `#e4e4e9` (`--fg`); stepped-down grays `--fg-dim`, `--muted`, `--meta-fg`, `--section-fg`.
- **Accent:** Cool lavender `rgba(160, 170, 255, 0.88)` (`--accent`), with hover, soft fill (`--accent-subtle`), and focus ring color `--border-focus` `rgba(138, 148, 200, 0.36)`.
- **Surfaces:** Almost no solid “cards” in the main stream—mostly **1px hairline borders** (`--border` at 7% white) and transparent fields.
- **Contrast:** Overall **soft, muted**; sharpness comes from **focus** (underline + cool glow) and **white body text at ~90%** on entries—not from high-chrome widgets.
- **Tone:** Quiet, editorial, slightly **cosmic / studio** (gradients, blobs, grain)—but the **daily shell** stays minimal: one capture line + list.

### Mobile translation

- **Keep:** Same **hue family** (charcoal base + cool violet accent + blue-gray metadata). That is the recognizable “Chinotto” signature.
- **Soften on phone:** Full **fixed blur + 20s ambient animation + heavy grain** can feel busy or costly on device. Prefer **one subtle gradient** or static tint behind the capture area; skip infinite motion unless reduced-motion is off and you profile battery.
- **Emphasize:** **Capture field + primary action**; **de-emphasize** decorative onboarding (`StreamFlowPanel`), multi-layer modals, and footer chrome (“Bogart Labs”, feedback link opacity ~0.46).
- **Stronger on mobile where needed:** Slightly **higher touch target contrast** for the primary send/control than desktop’s whisper-quiet links—still **no** bright saturated fills; use `--border-focus` and `--accent` sparingly.

### Token starter (Expo-friendly, no `color-mix`)

```ts
// theme/colors.ts — mirrors :root; accentSoft ≈ desktop color-mix feel
export const colors = {
  bg: "#0a0a0e",
  bgElevated: "#0f0f14",
  fg: "#e4e4e9",
  fgDim: "#9b9fa9",
  muted: "#5d6068",
  metaFg: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.07)",
  borderFocus: "rgba(138,148,200,0.36)",
  accent: "rgba(160,170,255,0.88)",
  accentSubtle: "rgba(128,138,188,0.08)",
  accentSoft: "rgba(160,170,255,0.63)", // link-like; tune visually
  bodyOnDark: "rgba(255,255,255,0.9)",
};
```

---

## 2. Typography

### Desktop implementation

- **Body / UI:** `"Open Sauce One"` with **400 + 500** from `@fontsource/open-sauce-one` (`src/main.tsx`). Base **16px**, `line-height: 1.5`, antialiased (`body` in `index.css`).
- **Intro headline only:** `"Inter"` weight **300** (`index.css` `.intro-screen-copy`)—loaded via Google Fonts in `index.html` (bundle also pulls several families; **runtime UI is Open Sauce One**).
- **Capture input (`EntryInput` → `.entry-input`):** **18px**, **weight 500**, **letter-spacing 0.01em**, **line-height 1**, **bottom border only** (not a boxed field). Placeholder: **15px**, **weight 400**, color `--fg-dim`.
- **Stream entry text (`.entry-row-text`):** **16px**, **400**, **line-height 1.5**, color `rgba(255,255,255,0.9)`.
- **Timestamps (`.entry-row-time`):** **13px**, `--meta-fg`.
- **Section titles (`.stream-section-title`):** **13px**, `--meta-fg`.
- **Search overlay field (`.search-center input`):** **18px**, **500**, rounded **12px**, bordered—more “hero” than the inline capture line.
- **Marketing-style gradient titles** use `--chinotto-headline-text-gradient` (empty onboarding / stream showcase)—not used for core list typography.

### Mobile (React Native) mapping

| Role | Suggested | Notes |
|------|-----------|--------|
| **Capture** | 17–18px, `fontWeight: "500"` | Match desktop weight hierarchy; RN often uses 17 for body—pick one and stay consistent. |
| **Entry body** | 16px, `fontWeight: "400"`, lineHeight ~24 | Primary reading on companion. |
| **Metadata / time** | 12–13px, color `metaFg` | Keep quieter than body. |
| **Section label** | 13px, `metaFg` | Optional on mobile if you collapse sections. |
| **Placeholder** | One step lighter weight (400) vs capture text | Same as desktop. |

**Font loading:** Use `expo-font` + same family if license allows (Open Sauce One). If you skip loading, fallback `System` / **SF Pro** on iOS still fits the “clean editorial” brief if weights match (400/500).

**Simplify on mobile:** Drop **Inter** for onboarding copy unless you replicate the full intro. **Gradient headlines** are optional for a capture-first app; a single line of `--fg-dim` copy is enough.

---

## 3. Layout and spacing

### Desktop patterns

- **App column:** `max-width: 1100px`, padding **`36px 32px`** bottom-heavy (`4.5rem`) for breathing room above bottom links (`index.css` `.app`).
- **Capture row:** `margin-bottom: 32px`; flex gap **`0.75rem`** between capture and ⌘K aside.
- **Stream:** `margin-top: 32px`; section spacing **`1.5rem`**; entry rows use **`0.5rem`** vertical padding (expanding on hover for clickable rows).
- **Density:** Medium—list is not ultra-tight; **hover** grows horizontal padding (`0.75rem` → `1.25rem`) for a calm, spacious feel.

### Mobile-first scale (suggested)

Use an **8px grid**; common steps: **8, 12, 16, 24, 32**.

- **Screen horizontal padding:** **16–20** (safe area + Chinotto’s calm margins).
- **Capture block:** **16–24** below status bar / header; **24–32** above the list if you want the same “air” as desktop’s 32px rhythm.
- **List row vertical padding:** **12–14** minimum touch; you lose desktop hover expansion—use **consistent** padding instead of animating width.
- **Remove:** Wide max-width centering math; **bottom studio signature** and **corner feedback link** as fixed chrome—or move feedback into settings.

---

## 4. Core interaction patterns (implemented)

| Pattern | Behavior |
|---------|----------|
| **Capture** | `textarea`, **Enter submits**, **Shift+Enter** newline (`EntryInput.tsx`). **Escape** blurs. Auto-focus on mount and after intro (`App.tsx`). Placeholder: *“Capture a thought…”*. |
| **Search** | **⌘K** opens **full-screen overlay** with blurred dim backdrop; focus moves to search; **Escape** closes and refocuses capture. Debounced query **120ms** refresh. Arrow keys move selection; **Enter** opens selected result. |
| **Stream row** | **Click** (with ~**180ms** delay to distinguish from double-click) opens detail. **Double-click** starts late edit. **⌘E** edit hovered row; **⌘⌫** delete hovered; **⌘P** pin hovered. **Enter/Space** on focused row opens. |
| **New entry** | Framer Motion: slight **y** offset and **0.26–0.32s** easeOut fade-in. |
| **Ephemeral edit** | New entries editable ~**15s** with glow; then “settle” **200ms** animation. |
| **Delete** | Row collapses **~150ms** height/opacity. |

### Mobile translation

- **Must keep:** **Single prominent capture**, **submit without friction** (toolbar button or Return—many users expect a **send** control on mobile because Enter is ambiguous in multiline). **List → detail** for recall.
- **Simplify:** **Double-click to edit** → **explicit Edit** or long-press. **Hover-only** delete/pin → **swipe actions**, overflow menu, or detail screen.
- **Search:** Keep **one search entry point** (header icon); avoid **⌘K** metaphor—use **icon + “Search”** label for discoverability.
- **Remove or defer:** Global keyboard chords, **hover-dependent opacity** (delete button `opacity: 0` until hover), **stream showcase** / **logo fly** transitions, **resurfaced overlay** complexity unless product requires parity.

---

## 5. Motion and animation

### Types

- **CSS:** Global **`--transition: 180ms ease-out`**; ambient background **20s**; intro blobs **45–55s** drift; logo stroke/dots intro; card/modal **0.28–0.5s** ease / cubic-bezier `(0.22, 1, 0.36, 1)`.
- **Framer Motion:** Empty onboarding stagger (**0.62s** item, **0.12** stagger); entry list item motion; exit **0.2s** for onboarding.
- **`prefers-reduced-motion`:** Honored for onboarding hint and stream panel (`index.css`).

### Mobile guidance

- **Keep:** Short transitions **150–250ms**, **ease-out**, focus/opacity/translate **4–8px** (matches `search-reveal`, `resurfaced-card-in`).
- **Reduce:** **20s** ambient loops, **multi-second** intro sequences, **blur-heavy** full-screen stacks (GPU + battery on mid devices).
- **Avoid:** Parallax-heavy onboarding, continuous **breathing** on logos, long **stroke-dash** draws unless onboarding-only.

Use **`AccessibilityInfo.isReduceMotionEnabled`** (or `expo-reduce-motion`) and mirror desktop’s reduced-motion branches.

---

## 6. Icons and visual elements

### Primary mark (`ChinottoLogo`)

Stroke circle **r=22**, **strokeWidth 2**, four filled dots (radii 5, 4, 4, 3); `currentColor` so it inherits `--fg-dim` / header.

```tsx
// Simplified for react-native-svg — same viewBox 0 0 64 64
import Svg, { Circle } from "react-native-svg";

export function ChinottoLogo({ size = 32, color = "#9b9fa9" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Circle cx="32" cy="32" r="22" stroke={color} strokeWidth="2" />
      <Circle cx="32" cy="23" r="5" fill={color} />
      <Circle cx="24" cy="34" r="4" fill={color} />
      <Circle cx="40" cy="34" r="4" fill={color} />
      <Circle cx="32" cy="41" r="3" fill={color} />
    </Svg>
  );
}
```

### Other

- **`StreamFlowPanel`:** Rounded glass panel, **three** blurred blobs (violet / cyan / ember), **three** gradient strokes (widths **1.35 / 1.1 / 0.9**, round caps). Full animation spec: [`stream-flow-panel-animation.md`](stream-flow-panel-animation.md).
- **List actions (`EntryStream`):** **Lucide** `Pin` and `X`, **14px**, **strokeWidth 2** (2.5 when pinned).

### Mobile

- **Need:** Logo (app bar / splash), **search** (magnifying glass), optional **pin** if you keep pinning.
- **Parity:** Reuse timings and layer order from [`stream-flow-panel-animation.md`](stream-flow-panel-animation.md); simplify only where RN cannot match `mix-blend-mode` / heavy blur.
- **SVG → RN:** `react-native-svg`; for Lucide use **`lucide-react-native`** or copy paths; keep **stroke width 2** for consistency.

---

## 7. Component patterns

### Desktop

| Component | Implementation notes |
|-----------|----------------------|
| **Capture input** | `Textarea` + `.entry-input`: **underline-only**, focus **1px** `--border-focus`, **no** filled box. |
| **Entry row** | Hairline **border-bottom**; optional **pinned** gradient panel + thin ring; **clickable** rows get **8px** radius and hover background `--accent-subtle`-like. |
| **Stream** | **`role="feed"`**, sections **Today / Yesterday / Earlier** or **Pinned**. |
| **Search** | Modal overlay **72%** dark + **8px** blur; centered field; results **rounded** list with **mark** highlights for FTS. |
| **Panels** | **ChinottoCard**, **StreamShowcaseModal**, **ResurfacedOverlay**, **Analytics**—glass + **14px** blur + violet/blue shadow language. |

### Mobile mapping

- **`CaptureInput`:** One **multiline** field, **underline** or **1px bottom border**; **large** type (17–18, semibold); **primary CTA** (Send) visible if you don’t rely on keyboard Return; respect safe area.
- **`EntryItem`:** **Body** + **time** on one or two lines; **tap** → detail. **Pin/delete** in detail or swipe—avoid cramming four affordances like desktop hover.
- **`RecentList`:** **FlatList**, section headers optional; **reduce** section taxonomy to **“Recent”** if simpler fits “capture-first.”

**Remove:** Hover-only controls, **180ms** click delay logic, **pinned** visual complexity if mobile scope is minimal (or keep one **star** affordance).

---

## 8. Design principles (from implementation)

1. **Capture is the default focus** — After intro, `entryInputRef.focus()` runs; shortcuts refocus capture when closing search/detail (`App.tsx`).
2. **Understated chrome** — Primary work is **text**, not panels; borders at **~7% white**.
3. **One stream, one entity** — Same row component for pinned vs dated sections; detail is a **drill-in**, not a separate document type.
4. **Soft motion signals state** — New row ease-in, delete collapse, settle animation after edit—not flashy transitions.
5. **Keyboard-forward on desktop** — ⌘K, ⌘N, ⌘E, etc.; product is **not** touch-first today.
6. **Trust / calm over “dashboard”** — Explicit comment rejecting productivity-dashboard patterns (`index.css`).

---

## 9. What not to port to mobile

- **Intro sequence:** Logo fly (`LogoTransition`), multi-phase blob intro, **Inter** headline choreography.
- **`StreamFlowPanel` empty state** with staggered blur-in and typing pulse—replace with **one line** of copy or skip.
- **Hover-dependent UI** (delete visibility, row padding expansion, ⌘K label).
- **Desktop modals:** Stream showcase, analytics opt-in, **ChinottoCard** icon grid / keyboard shortcut encyclopedia—replace with **native settings** if needed.
- **Fixed “Bogart Labs” / feedback** corner pattern.
- **Backdrop-filter stacks** everywhere—use **one** level or solid elevated `#0f0f14` cards.
- **`color-mix`** in RN—precompute **rgba** tokens.

---

## 10. Expo / React Native notes

### Theme structure

```ts
// theme/index.ts
export const theme = {
  colors, // see section 1
  spacing: { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 12 }, // search field 12; cards 16 in overlays
  duration: { fast: 150, normal: 180, slow: 250 },
  typography: {
    capture: { fontSize: 17, fontWeight: "500", letterSpacing: 0.15 },
    body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
    meta: { fontSize: 12, color: "rgba(255,255,255,0.55)" },
  },
};
```

### Practical constraints

- **Icons:** `react-native-svg` for the logo; **Lucide** RN port for pin/close/search if you want parity.
- No `backdrop-filter` on Android the same as web—**test** `expo-blur` or solid **semi-transparent** overlays (`rgba(10,10,14,0.92)`).
- **Hairline borders:** `StyleSheet.hairlineWidth` or 1px with opacity—matches desktop hairlines.
- **Gradients:** `expo-linear-gradient` for background glows; keep **stop colors** aligned with `StreamFlowPanel` gradient stops if you reuse the motif.
- **Text:** Avoid web-only tricks (`background-clip: text`) for core UI; use **solid** `--fg` / `--accent` on mobile.

---

## Related docs

- [`design-system.md`](design-system.md) — Desktop tokens and marketing-site alignment (web-oriented).
- [`stream-flow-panel-animation.md`](stream-flow-panel-animation.md) — **StreamFlowPanel** layer stack, path/blob timings, props (`calm`, `deferMotion`, `typingAccent`), and React Native notes.
- [`architecture.md`](architecture.md) — Stack and frontend–backend contract.
- [`product-spec.md`](product-spec.md) — Product scope.

---

## Companion success criteria

The mobile app should read as Chinotto if it keeps: **charcoal + cool violet focus**, **Open Sauce (or close system analog)**, **underline-forward capture**, **quiet metadata**, and **short ease-out motion**. It should feel **more** focused than desktop by **dropping** intro theater, hover-only tools, and multi-modal chrome—while preserving the **same emotional temperature**: calm, text-first, not a productivity suite.
