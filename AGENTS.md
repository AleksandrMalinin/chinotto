# AGENTS.md — Contract for coding agents

This file defines how agents must behave when working in the Chinotto repository. Deviations are bugs.

---

## What Chinotto is

- **Desktop-first personal thinking tool.** Fast capture, context return, personal knowledge grounding.
- **Place to offload:** thoughts, notes, plans, fragments, work context. One stream, one entity (Entry), no upfront structure.
- **Philosophy:** capture first, structure later. No workspace overhead, no document mindset, no manual organization at write time.
- **Stack:** Tauri 2 (desktop shell), React + TypeScript (UI), SQLite + FTS5 (local storage and full-text search). See `docs/architecture.md`.
- **MVP scope:** Capture (type → Enter → entry), stream (reverse chronological), search (FTS over entries). Desktop only, local-first, single-user.

---

## What Chinotto is not

- A productivity suite, task manager, or project tool.
- A notes app with folders, pages, or documents.
- A markdown editor, kanban, or template system.
- A sync/collab/cloud product as the default (optional Firebase pull sync may be configured; core capture/search stay local-first).
- An AI-first product. AI may be used where it helps; the app must remain useful and understandable without it. No gimmicky or vague AI features that obscure core behavior.

Do not propose or implement features that contradict the above. When in doubt, prefer the minimal interpretation.

---

## Engineering principles

1. **Simplicity and debuggability.** Code and architecture stay simple. A human must be able to reason about data flow and state without tracing through layers of indirection. Prefer explicit over clever.
2. **Local-first.** Data lives in SQLite on the user’s machine. No network for core flows. No dependency on external services for capture or search.
3. **Minimal UI.** UI supports capture and search. No chrome that doesn’t serve those. No “nice to have” UI without a clear product justification.
4. **Boring tech.** Use the stack that’s already there. New dependencies and new patterns need justification; default is “no.”
5. **One logical change per unit of work.** Commits and PRs follow `docs/commit-convention.md`. One feature slice, one fix, one refactor—no bundling unrelated changes.

---

## Behavior expectations for agents

- **Read before changing.** Use the codebase and `docs/` to understand current behavior and constraints. Do not assume; verify paths, APIs, and data shapes.
- **Preserve existing contracts.** Frontend invokes Tauri commands (`create_entry`, `list_entries`, `search_entries`). Entry has `id`, `text`, `created_at`. Do not change these without explicit requirement and approval.
- **Follow the commit convention.** All suggested commit messages must conform to `docs/commit-convention.md`: type(scope): imperative subject, one logical change, no vague or emotional wording.
- **Do not invent product scope.** Do not add features (e.g. tags, folders, AI chat, sync) unless the user explicitly asks. If the user’s request conflicts with product constraints, state the conflict and ask.
- **Prefer the smallest change.** Fix or add what’s asked. Avoid “while I’m here” refactors or scope creep. Refactors are separate from feature work unless the user asks for both.
- **Leave the codebase buildable and runnable.** Do not leave broken imports, commented-out code that should be removed, or half-finished work. If something is intentionally incomplete (e.g. stub), say so in the change or a short comment.

---

## How agents should make decisions

1. **Product and scope:** Resolve against `docs/product-spec.md` and `docs/architecture.md`. If the request is ambiguous, choose the option that fits MVP and local-first; ask only when the choice materially affects outcome.
2. **Implementation:** Prefer existing patterns (e.g. how entries are created, how search is invoked). New patterns require a reason (e.g. “current approach doesn’t support X”).
3. **Dependencies:** See “Dependencies and abstractions” below. Default is no new dependency. If a new dep is needed, name it and state why the current stack is insufficient.
4. **Naming and structure:** Follow existing layout (`src/features/entries`, `src-tauri`, `docs/`). New modules go in a logical place; do not proliferate top-level folders or generic names (“utils”, “helpers”) without clear boundaries.
5. **Errors and edge cases:** Handle errors in a way that keeps the app usable (e.g. surface a clear state or message). Do not silently swallow failures that the user should notice. Do not add speculative edge-case handling that isn’t required by the current feature or a known bug.

---

## What agents must avoid

- **Scope creep.** No “and we could also…” unless the user asked for it. No adding docs, tests, or refactors “for completeness” unless that was the task.
- **Vague or gimmicky AI.** No placeholders like “AI-powered search” or “smart suggestions” without a concrete design and acceptance that the app stays useful without them. No wording that sounds like marketing.
- **Over-engineering.** No premature abstractions, no “framework” patterns, no layers that don’t yet have a concrete use. No generic “service” or “manager” classes unless they consolidate real duplication.
- **Ignoring constraints.** No mandatory cloud, no Chinotto accounts, no collaboration. Optional Firestore ingest when env is set (`docs/firestore-sync.md`). No pages, folders, documents, tasks, kanban, or templates in MVP. No new runtimes or targets (e.g. mobile shell) unless explicitly requested.
- **Breaking the contract.** Do not change Tauri command names, Entry shape, or frontend–backend invocation pattern without explicit requirement. Do not suggest commits that violate `docs/commit-convention.md`.
- **Motivational or filler language.** In code comments, commits, and docs: no “awesome,” “nice,” “simple but powerful,” or similar. Be factual.

---

## Documentation expectations

- **In-code:** Comment only when the “why” or contract is not obvious from the code. No comments that restate what the code does. No TODOs without an owner or next step if they are long-lived.
- **Repo docs:** `docs/` holds product and architecture. Update `docs/architecture.md` when the stack or high-level design changes; update `docs/product-spec.md` when scope or constraints change. Keep README aligned with run instructions and MVP scope.
- **AGENTS.md and commit-convention:** Treat these as binding. Do not water them down or add generic “best practices” that duplicate them. When changing them, preserve strictness and practicality.

---

## Dependencies, abstractions, and architecture changes

**Dependencies**

- Adding a dependency (npm or Cargo) requires justification: what problem it solves and why the current stack cannot. Prefer standard library or existing deps. Avoid heavy or opinionated frameworks. Check license and maintenance status.
- Do not add dependencies “for future use.” Add when a concrete feature or fix needs them.

**Abstractions**

- Introduce an abstraction when there is repeated logic or a clear boundary (e.g. API layer, DB layer). Do not abstract “in case we need it later.” Name abstractions by what they do, not by pattern (“EntryRepository” over “DataAccessLayer” if it’s entry-specific).
- Prefer functions and small modules over deep class hierarchies. React components stay focused; shared logic can live in `lib/` or feature-local modules.

**Architecture changes**

- Structural changes (new layers, new runtimes, splitting the backend, changing data model) are out of scope unless the user explicitly requests them. If a task implies such a change, describe the implication and confirm before proceeding.
- When changing architecture, update `docs/architecture.md` and any affected product or commit conventions in the same pass. Do not leave the docs out of date.

---

## Summary

Agents work in Chinotto under a strict, product-aligned contract: minimal scope, local-first, debuggable code, no fluff. Follow the docs, the commit convention, and the “what is / what is not” boundaries. Prefer the smallest change; avoid new deps and abstractions unless justified. Documentation stays accurate and minimal. This file is the source of truth for agent behavior in this repo.
