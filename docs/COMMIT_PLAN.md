# Atomic commit plan

Follow this order. One commit per step. Run from repo root.

---

## 1. Chore: Tailwind, path alias, and UI deps

```bash
git add package.json package-lock.json tailwind.config.js postcss.config.js tsconfig.json vite.config.ts .gitignore
git commit -m "chore: add Tailwind, PostCSS, and path alias"
```

---

## 2. Chore: Add lib/utils and UI components

```bash
git add src/lib/utils.ts src/components/ui/button.tsx src/components/ui/card.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx
git commit -m "chore: add lib/utils and shared UI components"
```

---

## 3. Docs: Commit convention and cursor rules

```bash
git add docs/COMMIT_CONVENTION.md .cursor/rules/architecture.mdc .cursor/rules/code-editing.mdc .cursor/rules/commit-messages.mdc .cursor/rules/documentation.mdc .cursor/rules/engineering.mdc .cursor/rules/product.mdc .cursor/rules/web-search.mdc AGENTS.md cursor.md
git commit -m "docs: add commit convention and cursor rules"
```

---

## 4. Feat(db): Embeddings and resurface backend

```bash
git add src-tauri/src/embeddings.rs src-tauri/src/db/mod.rs src-tauri/src/db/schema.sql src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(db): add embeddings and resurface/similar backend"
```

---

## 5. Feat(entries): Entry API and types for resurface/similar

```bash
git add src/types/entry.ts src/features/entries/entryApi.ts
git commit -m "feat(entries): add entry API and types for resurface and similar"
```

---

## 6. Feat(entries): EntryDetail and ResurfacedCard

```bash
git add src/features/entries/EntryDetail.tsx src/features/entries/ResurfacedCard.tsx
git commit -m "feat(entries): add EntryDetail view and ResurfacedCard component"
```

---

## 7. Refactor(entries): EntryStream for detail and resurface

```bash
git add src/features/entries/EntryStream.tsx
git commit -m "refactor(entries): extend EntryStream for detail and resurface"
```

---

## 8. Feat(entries): Expose focus from EntryInput

```bash
git add src/features/entries/EntryInput.tsx
git commit -m "feat(entries): expose focus from EntryInput for post-intro focus"
```

---

## 9. Feat(app): Intro screen, no header, centered search overlay

```bash
git add src/components/IntroScreen.tsx src/App.tsx src/features/entries/SearchInput.tsx src/index.css index.html
git commit -m "feat(app): add intro screen, remove main header, center search overlay"
```

---

## 10. Feat(tauri): Dark window theme on macOS

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat(tauri): set window theme to dark on macOS"
```

---

## 11. Style: Open Sauce One and app typography scale

```bash
git add src/main.tsx src/index.css index.html
git commit -m "style: add Open Sauce One and app typography scale"
```

---

## 12. Style(intro): Nunito for intro copy

```bash
git add index.html src/index.css
git commit -m "style(intro): use Nunito for intro copy"
```

---

## 13. Chore: Add unused AppBackground and Splash (optional)

If you want to keep or remove these:

- To **commit** them:  
  `git add src/components/AppBackground.tsx src/components/Splash.tsx`  
  then:  
  `git commit -m "chore: add AppBackground and Splash components"`

- To **drop** them: delete the files and do not commit.

---

## 14. Delete COMMIT_PLAN.md after use (optional)

```bash
git add docs/COMMIT_PLAN.md
git commit -m "docs: add atomic commit plan"
# Or simply: rm docs/COMMIT_PLAN.md and do not commit it.
```

---

**Note:** Steps 11 and 12 both touch `index.html` and `src/index.css`; the second commit will include the Nunito link and intro font overrides on top of the Open Sauce work. If you prefer a single typography commit, combine 11 and 12 into one:

```bash
# Single typography commit instead of 11 + 12
git add src/main.tsx src/index.css index.html
git commit -m "style: add Open Sauce One, Nunito for intro, and app type scale"
```
