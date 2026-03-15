# Chinotto – Testing strategy

Minimal testing for a local-first desktop tool. Focus: **correctness of core algorithms** and **deterministic recall behaviour**, with an **extremely lightweight** stack.

---

## 1. Minimal testing stack

| Layer | Tool | New dependencies |
|-------|------|------------------|
| **Rust (backend)** | `cargo test` (built-in) | **None** |
| **TypeScript (frontend)** | Node.js `node:test` + `node:assert` (built-in from Node 18+) | **None** |

**No Jest, no Playwright, no Cypress, no heavy mocking.** The backend holds the important logic (temporal recall, thought trail ranking, importance); the frontend is mostly Tauri invoke and React. Test the backend in Rust; add a few TS tests only for pure helpers if desired.

**Optional:** If you prefer a single test runner for TS with `describe`/`it` and one-liner setup, add **Vitest** as one devDependency (Vite-native, runs in Node, no browser). Still minimal; the strategy below works with or without it.

---

## 2. Why this fits a local-first desktop tool

- **No network or infra:** Nothing to mock for “real” behaviour; no API contracts or auth. Logic is either pure (keywords, scoring) or DB-backed (SQLite). Test pure functions with fixed inputs; test DB paths with an in-memory SQLite DB.
- **Algorithmic core:** Temporal anchors, thought trail similarity, importance scoring are pure or depend only on structured data. They are easy to test with deterministic fixtures and no framework.
- **Determinism:** Resurfacing uses randomness (e.g. weighted choice). Tests can use a **seeded RNG** or test the **scoring/selection logic** with a fixed candidate set and assert which entry would be chosen (or that the result is in an allowed set). That keeps behaviour verifiable without flakiness.
- **Single binary, single user:** No distributed behaviour, no browser matrix. Rust unit tests plus optional TS unit tests cover what matters; no need for E2E or browser automation for “correctness of core algorithms.”

---

## 3. Test folder structure

```
src-tauri/
  src/
    lib.rs           # #[cfg(test)] mod tests { ... }  (format_ago, importance_*, temporal_reason_anchor)
    keywords.rs      # #[cfg(test)] mod tests { ... }  (extract_keywords, keyword_overlap, thought_trail_similarity)
    db/
      mod.rs         # optional: #[cfg(test)] mod tests for time window query
  tests/             # optional: integration tests with in-memory DB (resurface, thought_trail)
    recall_integration.rs   # if you add integration tests later

src/                 # optional: only if you add TS tests
  lib/               
    __tests__/       # or *.test.ts next to source
      getIdsInCooldown.test.ts
  features/
    entries/
      __tests__/
        relativeToCurrent.test.ts
```

**Convention:**

- **Rust:** Prefer **inline `#[cfg(test)] mod tests`** next to the code under test. Pure functions stay in the same file; tests see private helpers. No extra test-only crates.
- **Integration:** Optional `src-tauri/tests/*.rs` for commands that need a real DB. Resurface integration tests live in `lib.rs` as `#[cfg(test)] mod resurface_integration` and use an in-memory DB (`:memory:`) plus `get_resurfaced_entry_impl` with a seeded RNG. They verify at most one entry per call, excluded ids never returned, and cooldown behaviour.
- **TypeScript:** Colocate under `*.test.ts` next to the module. `src/lib/resurfaceSession.test.ts` tests session/cooldown guards and pure helpers (getIdsInCooldown, markAsShown, mayAttemptResurface, shouldInvokeBackend) with a mock storage. Run with `npm run test:ts` (Node + tsx). Do not test React components or Tauri invoke.

---

## 4. Coverage targets

Keep targets **low and meaningful** so tests stay cheap and focused:

| Scope | Target | Rationale |
|-------|--------|-----------|
| **Rust: keywords.rs** | High (e.g. 90%+ lines) | Pure logic; no I/O. Easy to reach with a few tests. |
| **Rust: lib.rs (pure helpers)** | Cover format_ago, importance_*, temporal_reason_anchor | These drive recall wording and ranking; small surface. |
| **Rust: commands (get_resurfaced_entry, get_thought_trail)** | Optional integration tests; no strict % | Deterministic fixtures + in-memory DB; assert ordering and that result is in allowed set. |
| **TypeScript** | Optional; only pure helpers | Low or 0% is fine; most logic is in Rust. |
| **Overall** | No mandatory project-wide % | Prefer “critical paths covered” over a high number. |

**Do not:** Chase 80%+ on the whole repo, add snapshot tests for UI, or test third-party code.

---

## 5. Minimal configuration

### 5.1 Rust (no config file)

- Use default `cargo test`.
- Tests live in `src/**/*.rs` as `#[cfg(test)] mod tests`.
- Optional: `src-tauri/tests/*.rs` for integration; Cargo discovers them by convention.

Example: run only unit tests (no integration):

```bash
cd src-tauri && cargo test
```

### 5.2 TypeScript with Node built-in test runner (zero deps)

- Node 18+ required.
- No config file if you use plain `.js` tests; for `.ts` you need to run with a runner that understands TS (e.g. `node --import tsx --test` with `tsx` as devDep, or `tsc` then `node --test` on emitted JS).

**package.json** (minimal):

```json
{
  "scripts": {
    "test": "cd src-tauri && cargo test",
    "test:rs": "cd src-tauri && cargo test",
    "test:ts": "node --test src/**/*.test.js"
  }
}
```

If you introduce **Vitest** (one devDep) for TS:

```json
{
  "scripts": {
    "test": "npm run test:rs && npm run test:ts",
    "test:rs": "cd src-tauri && cargo test",
    "test:ts": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

**vitest.config.ts** (only if you add Vitest):

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- **environment: "node"** – no browser; Tauri invoke is not available, so only test pure TS.
- **globals: false** – use explicit `import { describe, it, expect } from "vitest"` (or stick with Node `node:test` and no Vitest).

---

## 6. What to test (summary)

1. **Temporal recall / resurfacing logic**  
   - Rust: Time-window selection (if you expose or test the query), and that `get_resurfaced_entry` with fixed DB + seeded RNG returns an entry from the expected temporal set or fallback.  
   - Pure helpers: `format_ago`, `temporal_reason_anchor` with fixed inputs.

2. **Thought trail ranking**  
   - Rust: `keyword_overlap`, `thought_trail_similarity` (with deterministic corpus), and that `get_thought_trail` returns order “earlier → current → later” and respects max related and scoring (similarity + time + importance).

3. **Deterministic behaviour**  
   - Use fixed fixtures (e.g. list of entries with known `created_at`, `edit_count`, `open_count`, pinned set). For any randomness (e.g. weighted choice), either seed the RNG in tests or assert that the result is one of a small allowed set.

4. **Importance score**  
   - Rust: Test `importance_score` and `importance_boost` (e.g. via `pub(crate)` or `#[cfg(test)]` visibility, or indirectly via integration tests with known entries).

5. **Related entries (embedding similarity)**  
   - Rust: `top_related_ids` is unit-tested: threshold filters before sort/limit, all-below-threshold returns empty, limit respected.  
   - Manual (when verifying “Related entries” in the UI): **Clearly related** (e.g. two notes about “Tauri” or “project X”) should both appear. **Clearly unrelated** (e.g. note about Tauri vs note about a movie title) should not appear. **Loosely related** may or may not appear depending on similarity. **Very short notes** (one or two words) can score lower; if 0.5 feels too strict for your corpus, consider lowering to 0.45. **Notes with links / product names / mixed language** – no special handling; embedding similarity applies as-is. If there are no entries above threshold, the block shows “None yet.” and the list is empty. **Normal search** (Cmd+K, FTS) is unchanged and independent.

Keep the testing stack minimal, the test count low, and the focus on **algorithms and deterministic recall** so the system stays maintainable and fast.
