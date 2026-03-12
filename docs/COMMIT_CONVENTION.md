# Chinotto – Commit message convention

Strict, conventional-style commits for a solo builder. No vague or noisy wording; history should be easy to scan.

---

## 1. Commit format

```
<type>(<scope>): <subject>

[optional body]
```

- **Subject:** One line, imperative mood, lowercase after the colon, no period at the end. Max ~72 chars.
- **Scope:** Optional; use when it clarifies *where* the change lives (e.g. `entries`, `search`, `tauri`, `db`).
- **Body:** Optional; use only when one line is not enough (e.g. breaking change, non-obvious fix).

**Subject rules:**

- Start with a verb: *add*, *fix*, *refactor*, *remove*, *upgrade*, etc.
- Be specific: what changed, not why you did it.
- No emoji, no “WIP”, no “finally”, no “hopefully”, no “small”/“minor”/“quick”.

---

## 2. Allowed types

| Type       | Use for |
|-----------|---------|
| `feat`    | New user-facing behavior or capability. |
| `fix`     | Bug fix (behavior was wrong; now correct). |
| `refactor`| Code change that doesn’t fix a bug or add a feature (reorg, rename, simplify). |
| `perf`    | Performance improvement. |
| `chore`   | Build, tooling, deps, config, scripts. No app logic. |
| `docs`    | Documentation only (README, docs/, comments that are purely docs). |
| `style`   | Formatting, whitespace, quotes. No logic or UI change. |
| `test`    | Adding or changing tests only. |

**Not used in this repo:** `ci` (use `chore`), `revert` (write a normal `fix` or `revert` message instead).

---

## 3. Rules

1. **One logical change per commit.** One feature slice, one fix, one refactor. No “and also” in the subject.
2. **Scope only when it helps.** Prefer `feat(entries): add clear-on-submit` over `feat: add clear-on-submit` when the change is clearly in the entries flow. Omit scope for app-wide or small changes.
3. **Imperative, present tense.** “add search highlight” not “added search highlight” or “adds search highlight”.
4. **No emotional or filler words.** Avoid: *finally*, *hopefully*, *quick*, *small*, *minor*, *just*, *really*, *actually*, *sorry*, *oops*, *WIP*, *wip*, *temp*, *temporary*.
5. **No vague subjects.** “fix bug” and “update code” are forbidden. Say what you fixed or what you updated.
6. **Body only when needed.** Use body for breaking changes, non-obvious rationale, or multiple concrete points. Keep it short and factual.
7. **Granularity (see below).** Prefer smaller, scannable commits over one big “stuff” commit.

---

## 4. Granularity: one commit vs several

**One commit when:**

- A single feature slice (e.g. “submit on Enter in entry input”) that touches a few files and one concern.
- One bug fix with a clear cause (e.g. “fix search not updating when query is cleared”).
- One refactor that doesn’t mix with features (e.g. “refactor entry list into EntryStream component”).
- Dependency or tooling change that’s clearly one step (e.g. “chore: upgrade Tauri to 2.x”).

**Split into several commits when:**

- You add a feature *and* fix an unrelated bug. Two commits: one `feat`, one `fix`.
- You refactor and add behavior. Prefer: refactor first (one commit), then add behavior (second commit).
- You change UI and move files. Prefer: move/refactor first, then UI change.
- Multiple unrelated files (e.g. a new component + new API + CSS). Consider one commit per “layer” (e.g. API, then component, then styles) if the change is large; otherwise one commit is fine if it’s one logical feature.

**Rule of thumb:** If the subject would need “and” or “also”, split or rephrase so one subject = one thing.

---

## 5. Good examples (Chinotto-specific)

```
feat(entries): submit new entry on Enter in input
feat(search): show empty state when no results
fix(search): refresh list when query is cleared
fix(entries): focus input after creating entry
refactor(entries): extract EntryStream from App
refactor(entries): rename entryApi to entriesApi
perf(search): debounce FTS query by 150ms
chore: add npm script for tauri dev
chore: upgrade Tauri to 2.0.1
chore: add .cursor rule for commit convention
docs: add architecture and commit convention
style: normalize quote style in TS files
```

With scope omitted where it’s obvious or app-wide:

```
feat: add full-text search over entries
fix: prevent double submit on Enter
refactor: move entry types to types/entry
```

With body (only when needed):

```
fix(tauri): allow read on app data dir

Capability was missing for SQLite path; add fs scope for app data.
```

---

## 6. Bad examples (avoid)

```
fix bug
update stuff
WIP search
fix: fix the thing
feat: added new feature
chore: small changes
refactor: refactor code
fix: hopefully this works
chore: oops fix typo
feat(entries): add search and refactor input and fix focus
docs: update readme
style: improve UI
```

**Why they’re bad:**

- “fix bug” / “update stuff” – vague; no idea what changed.
- “WIP search” – not a proper type/subject; noisy.
- “fix: fix the thing” – redundant and vague.
- “added new feature” – past tense; not imperative.
- “small changes” – emotional/filler; not specific.
- “refactor code” – says nothing about what was refactored.
- “hopefully this works” / “oops fix typo” – emotional/noisy.
- “add search and refactor input and fix focus” – multiple logical changes; split into three commits.
- “update readme” – too vague; prefer “docs: add run instructions to README” or similar.
- “style: improve UI” – “style” is for formatting (e.g. quotes); UI changes are `feat` or `fix`.

---

## Summary

- **Format:** `type(scope): imperative subject`, optional body.
- **Types:** `feat` | `fix` | `refactor` | `perf` | `chore` | `docs` | `style` | `test`.
- **Rules:** One logical change per commit; imperative; no vague or emotional wording; scope when it helps.
- **Granularity:** One commit per feature slice / fix / refactor; split when you’d need “and” in the subject.
