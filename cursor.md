# Chinotto — Cursor rules

Project-level guidance for Cursor. Stay within product boundaries and engineering constraints. See also `AGENTS.md` and `docs/`.

---

## Product summary

Chinotto is a **desktop-first personal thinking tool**. Main purpose: help a single user quickly capture information, reduce mental load, and later return to context clearly.

- **Capture first, structure later.** One stream, one entity (Entry). No workspace overhead, no document mindset, no manual organization at write time.
- **Stack:** Tauri 2, React + TypeScript, SQLite + FTS5. Local-only; no sync, auth, or cloud in MVP.
- **MVP:** Capture (type → Enter → entry), stream (newest first), full-text search. See `docs/product-spec.md` and `docs/architecture.md`.

---

## Product boundaries

Do **not** turn Chinotto into:

- A Notion clone (no blocks, pages, databases, or rich doc model).
- A collaboration tool (no multi-user, no sharing, no real-time).
- An overdesigned PKM system (no graphs, no “second brain” scaffolding, no mandatory structure).
- An abstract AI toy (no vague “AI-powered” features; app must be useful without AI).
- A feature-heavy editor platform (no markdown editor, no WYSIWYG, no plugins).

When a request pushes toward any of these, choose the minimal interpretation or flag the conflict.

---

## Engineering principles

1. **Simplicity and debuggability.** Code must be easy to reason about. Prefer explicit over clever; avoid indirection that doesn’t pay off.
2. **Local-first.** Data in SQLite on the user’s machine. No network for core capture/search. No reliance on external services for basic usefulness.
3. **Minimal UI.** Every UI element serves capture or search. No decorative chrome or “nice to have” without product justification.
4. **Boring tech.** Stick to the existing stack. New deps and new patterns need a clear reason; default is no.
5. **One logical change per commit.** Follow `docs/commit-convention.md`. No bundling unrelated edits.

---

## Preferred implementation behavior

- **Read before changing.** Check `docs/`, existing code paths, and Tauri command contracts. Verify; don’t assume.
- **Preserve contracts.** Frontend calls `create_entry`, `list_entries`, `search_entries`. Entry: `id`, `text`, `created_at`. Don’t change these without explicit requirement.
- **Smallest change that satisfies the ask.** Implement what’s requested. No “while I’m here” refactors or extra features. Refactor only when the user asks or when it’s the stated task.
- **Match existing patterns.** Use the same invocation style, component structure, and file layout. New code goes in the right feature or `lib` area; no random new top-level folders or vague “utils.”
- **Leave the tree buildable and runnable.** No broken imports, no dead commented code, no half-done work. If something is intentionally stubbed, say so briefly.

---

## Dependency policy

- **Default: no new dependency.** Prefer std lib and existing packages. Every new dependency must be justified: what problem it solves and why the current stack can’t.
- No “for future use” deps. Add only when a concrete feature or fix needs it.
- Prefer small, focused libraries over frameworks. Check license and maintenance; avoid abandoned or overly opinionated packages.
- Same rule for Cargo and npm.

---

## Web search policy

When searching for APIs, docs, or solutions:

- **Prefer official documentation** over tutorials and blog posts.
- **Prefer latest stable APIs** and current docs; don’t assume old versions.
- **Do not append years** (e.g. 2024, 2025) to search queries unless you need version-specific or time-bound info.
- **Prefer specs and source docs** (e.g. MDN, Tauri docs, SQLite docs, React docs) over third-party tutorials.
- **Avoid low-signal SEO articles:** generic listicles, “X ways to…”, Medium/Dev.to unless they’re the only source for a narrow topic. Prefer GitHub repos and official sites.

---

## Documentation policy

- **In-code:** Comment only when the “why” or contract isn’t obvious. No comments that repeat what the code does. No long-lived TODOs without a clear next step or owner.
- **Repo docs:** `docs/` is the source for product and architecture. Update `docs/architecture.md` when the stack or design changes; update `docs/product-spec.md` when scope or constraints change. Keep README in sync with how to run and MVP scope.
- **Tone:** Factual. No marketing speak, no “awesome” or “simple but powerful” in comments or docs.
- When changing `AGENTS.md`, `docs/commit-convention.md`, or this file, keep them strict and practical; don’t dilute with generic advice.

---

## Refactor policy

- Refactors are **separate from feature work** unless the user explicitly asks for both. Don’t refactor “while implementing” unless it’s required for the change.
- Refactor when there is **real duplication or a clear boundary** (e.g. repeated logic, a proper API/DB boundary). Not “in case we need it later.”
- Name by responsibility: e.g. entry-specific storage, not a generic “DataAccessLayer.” Prefer functions and small modules over deep hierarchies.
- After a refactor, the app must still build and run; behavior must be preserved unless the refactor is explicitly behavior-changing.

---

## Performance mindset

- **Don’t optimize prematurely.** Implement correctly first; optimize when there’s a measured problem or a known bottleneck (e.g. large result sets, heavy re-renders).
- **Respect the stack.** SQLite + FTS5 is fast for local search; avoid N+1 and unnecessary work. React: avoid unnecessary state or re-renders when the fix is straightforward.
- **No speculative performance work** (e.g. “this might be slow someday”). If the user reports slowness or you’re fixing a known perf issue, then address it with a concrete change.

---

## Anti-patterns to avoid

- **Scope creep.** No “and we could also…” unless requested. No extra docs, tests, or refactors “for completeness” when they weren’t part of the task.
- **Vague or gimmicky AI.** No “AI-powered” or “smart” placeholders without a concrete design and without the app remaining clearly useful without them.
- **Over-engineering.** No premature abstractions, no framework-style layers without a real use, no generic “Service”/“Manager” classes that don’t consolidate real duplication.
- **Ignoring product constraints.** No sync, auth, cloud, pages, folders, documents, tasks, kanban, templates, or new platforms (e.g. web/mobile) unless explicitly requested.
- **Breaking existing contracts.** Don’t change Tauri command names, Entry shape, or invoke pattern without an explicit requirement. Don’t suggest commit messages that violate `docs/commit-convention.md`.
- **Filler language.** No “awesome,” “nice,” “just,” “simply” in code, commits, or docs. Be precise.

---

## Summary

Build a minimal, local-first desktop thinking tool—not a Notion, not a PKM suite, not an AI toy. Prefer the smallest change, respect boundaries, follow the commit convention, and keep docs and code factual and debuggable. When in doubt, choose the option that keeps the product focused and the codebase simple.
