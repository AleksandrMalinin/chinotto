# StreamFlowPanel — element stack and animation spec

Reference for reimplementing the empty-stream **trail panel** on mobile (or web). Source of truth: `src/components/StreamFlowPanel.tsx` and `src/index.css` (selectors prefixed with `stream-flow-`).

---

## Purpose

`StreamFlowPanel` is a **decorative, non-interactive** (`aria-hidden`) illustration: frosted glass card with **three soft color blobs** (screen blend) and **three gradient strokes** that **draw in** with staggered delays. Optional **slow blob drift** loops forever (alternate). A **one-shot pulse** can run on the whole SVG when the user types during progressive empty onboarding.

Wiring from the app: `src/features/entries/EntryStream.tsx` (`EmptyStreamOnboarding`) passes `calm`, `typingAccent`, and `deferMotion` based on `useReducedMotion()`, progressive onboarding, and intro handoff (`deferEmptyPanelMotion` / `revealEmptyOnboarding` from `App.tsx`).

---

## DOM / layer order (bottom → top)

| Z | Element | Class | Role |
|---|---------|-------|------|
| 0 | Container | `stream-flow-panel` + `stream-flow-panel--onboarding` | Clips stacking context; `border-radius: 22px`; `isolation: isolate`. |
| 0 | Blob field | `stream-flow-blobs` | `position: absolute; inset: -12%` — blobs extend past the card. |
| 0 | Blob ×3 | `stream-flow-blob`, modifiers `--violet`, `--cyan`, `--ember` | Ellipses, `blur(42px)`, `mix-blend-mode: screen`, `opacity: 0.85`. |
| 1 | Glass | `stream-flow-glass` | Gradient fill + inset highlight + outer glow shadows + `backdrop-filter: blur(10px)`. |
| 2 | SVG | `stream-flow-svg` | `viewBox="0 0 220 260"`, `padding: 14% 12% 16%` (of panel box). |

Paths sit inside the SVG above the glass; no extra wrapper.

---

## Layout (onboarding variant)

- **Classes:** `stream-flow-panel stream-flow-panel--onboarding`
- **Width:** `100%`, `max-width: min(340px, max(220px, 42vw))`
- **Aspect ratio:** `11 / 13`
- **Margin:** `0 auto`

On mobile, use a fixed max width in dp (e.g. 220–280) and the same **11:13** aspect ratio so the illustration matches desktop proportions.

---

## SVG: shared gradient

**Linear gradient** (`gradientUnits="userSpaceOnUse"`):

- Line from `(8, 12)` to `(212, 248)`
- **Stops:**
  - `0%`: `rgba(180, 188, 255, 0.9)`
  - `42%`: `rgba(34, 200, 220, 0.55)`
  - `100%`: `rgba(255, 150, 90, 0.5)`

All three paths use `stroke={url(#id)}`, `fill="none"`, `strokeLinecap="round"`.

### Path geometry (desktop)

| Path | class | `d` | strokeWidth | opacity |
|------|-------|-----|-------------|---------|
| A | `stream-flow-path--a` | `M 36 44 C 92 52 118 96 78 138 C 58 162 48 188 62 214` | 1.35 | 1 |
| B | `stream-flow-path--b` | `M 154 36 C 128 78 168 112 148 156 C 132 192 156 222 178 236` | 1.1 | 0.45 |
| C | `stream-flow-path--c` | `M 24 168 Q 108 148 124 208 T 196 228` | 0.9 | 0.32 |

---

## Animation 1 — path draw (`stream-flow-draw`)

**Technique:** `stroke-dasharray` equals path length; `stroke-dashoffset` animates from full length to `0`.

| Path | `stroke-dasharray` | initial `stroke-dashoffset` | Duration | Delay (CSS var) | Easing |
|------|-------------------|----------------------------|----------|-----------------|--------|
| A | 420 | 420 | **2.8s** | **0.4s** (`--stream-flow-path-delay-a`) | `cubic-bezier(0.22, 1, 0.36, 1)` |
| B | 360 | 360 | **2.5s** | **0.65s** (`--stream-flow-path-delay-b`) | same |
| C | 280 | 280 | **2.2s** | **0.85s** (`--stream-flow-path-delay-c`) | same |

**Keyframe:** single step `to { stroke-dashoffset: 0 }` with `animation-fill-mode: forwards` (forwards implied by “forwards” in desktop CSS).

**End state:** All paths fully visible; offsets stay at 0.

---

## Animation 2 — blob drift (`stream-flow-blob-drift`)

**Each blob:** `animation: stream-flow-blob-drift var(--blob-dur) ease-in-out infinite alternate`

**Keyframe:**

```text
from: transform translate(0, 0) scale(1)
to:   transform translate(6%, -5%) scale(1.06)
```

| Blob | Background | Size (w × h) | Position | `--blob-dur` | `animation-delay` |
|------|------------|--------------|----------|--------------|-------------------|
| Violet | `rgba(124, 58, 237, 0.34)` | 55% × 48% | `left: -5%; top: 8%` | **26s** | 0 |
| Cyan | `rgba(6, 182, 212, 0.28)` | 52% × 52% | `right: -8%; top: 28%` | **19s** | **-4s** |
| Ember | `rgba(249, 115, 22, 0.22)` | 48% × 44% | `left: 18%; bottom: -6%` | **24s** | **-9s** |

Shared blob styles: `border-radius: 50%`, `filter: blur(42px)`, `mix-blend-mode: screen`, `opacity: 0.85`.

---

## Animation 3 — typing accent (`stream-flow-svg-typing-pulse`)

**Trigger:** Root has class `stream-flow-panel--typing-accent` (while user types during progressive empty onboarding exit).

**Target:** Entire `.stream-flow-svg` (not individual paths).

| Property | Duration | Iteration | Easing |
|----------|----------|-----------|--------|
| Opacity + filter brightness | **0.45s** | **1** (`animation-iteration-count: 1`) | `ease-out` |

**Keyframe:**

- `0%, 100%`: `opacity: 1`, `brightness(1)`
- `50%`: `opacity: 0.92`, `brightness(1.12)`

Re-applying the class re-triggers the animation in CSS; on mobile, mirror that (restart animation when `typingAccent` flips true).

---

## Glass layer (static, no keyframe animation)

- **Fill:** linear gradient `145deg`:  
  `rgba(18,18,28,0.55)` → `rgba(12,14,22,0.35)` at 48% → `rgba(20,22,34,0.5)`
- **Box shadow:**
  - Inset: `0 0 0 1px rgba(255,255,255,0.06)`
  - Glows: `0 0 40px -12px rgba(100,110,180,0.2)`, `0 0 72px -28px rgba(70,100,180,0.12)`
  - Depth: `0 20px 48px -20px rgba(0,0,0,0.55)`
- **Backdrop blur:** `10px` (web); on RN use `BlurView` or fallback to slightly more opaque gradient without blur on low-end devices.

---

## React props (`StreamFlowPanel.tsx`)

| Prop | Effect |
|------|--------|
| `calm={true}` | **No** blob animation; **no** path draw animation; paths shown immediately (`stroke-dashoffset: 0`). Maps to `prefers-reduced-motion` on desktop. |
| `deferMotion={true}` | **No** running animations; paths held at **hidden** dash offsets (420 / 360 / 280). When class removed, path draw + blob drift **start from the beginning** (e.g. after intro closes). |
| `typingAccent={true}` | Adds typing pulse on `.stream-flow-svg` once per activation (see above). |

**Combinations used in app:**

- Launch with intro: panel may mount with `deferMotion` so draw does not finish before intro ends; then `deferMotion` clears → draw runs.
- `calm` when `useReducedMotion()` is true.
- `typingAccent` while `typingAccent && !exiting` in `EmptyStreamOnboarding` (`EntryStream.tsx`).

---

## `prefers-reduced-motion: reduce` (desktop CSS)

- Blob: `animation: none`
- Paths: `animation: none`, `stroke-dashoffset: 0` (fully drawn)
- Typing pulse on SVG: `animation: none`

Mobile should mirror with system “reduce motion” / `AccessibilityInfo` / Reanimated’s reduced-motion hooks.

---

## Implementation notes for React Native

1. **`react-native-svg`:** Use `Path` with `strokeDasharray` and `strokeDashoffset` driven by **Reanimated** (`useAnimatedProps`) or `Animated` to replicate `stream-flow-draw`. Path lengths should match desktop dash values (420 / 360 / 280) if paths are identical; otherwise compute with `path.getTotalLength()` equivalent or hardcode after measurement.

2. **Easing:** `cubic-bezier(0.22, 1, 0.36, 1)` → Reanimated `Easing.bezier(0.22, 1, 0.36, 1)` (verify factory signature for your Reanimated version).

3. **Blobs:** Three absolutely positioned `View`s with `borderRadius` huge, solid background colors above, and **blur** via `expo-blur` masked views or `@react-native-community/blur`. `mix-blend-mode: screen` is **not** available on RN the same way; approximate with **lower alpha** overlays or a single pre-blurred asset / Skia if you need parity.

4. **Typing pulse:** Animate `opacity` on the SVG wrapper `0.92 ↔ 1` and slightly scale or use Skia brightness; 450ms, once, `ease-out`.

5. **Defer motion:** Initialize dash offsets at “hidden”; on mount or when intro completes, start staggered timers or parallel animations with delays **400 / 650 / 850 ms**.

6. **Performance:** Prefer **one** blur layer; limit simultaneous infinite animations on low-end Android; respect reduce-motion by skipping drift and showing full paths.

---

## Quick timing summary

| Layer | Animation | Duration / period |
|-------|-----------|-------------------|
| Path A | Draw | 2.8s after 0.4s delay |
| Path B | Draw | 2.5s after 0.65s delay |
| Path C | Draw | 2.2s after 0.85s delay |
| Blobs | Drift loop | 19s / 24s / 26s alternate infinite |
| SVG | Typing pulse | 0.45s × 1 |

---

## Related

- Component: `src/components/StreamFlowPanel.tsx`
- Styles: `src/index.css` (search `stream-flow-`)
- Consumer: `src/features/entries/EntryStream.tsx` (`EmptyStreamOnboarding`)
- Showcase (calm panel): `src/components/StreamShowcaseModal.tsx`
