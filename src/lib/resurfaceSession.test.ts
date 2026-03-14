/**
 * Integration-style tests for resurface session and cooldown behaviour.
 * Verifies: at most one per session, same entry not twice (cooldown), not during typing, cooldown logic.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  getIdsInCooldown,
  getResurfacedHistory,
  markAsShown,
  mayAttemptResurface,
  RESURFACED_COOLDOWN_DAYS,
  RESURFACED_HISTORY_KEY,
  RESURFACED_HISTORY_MAX,
  shouldInvokeBackend,
  type ResurfaceStorage,
} from "./resurfaceSession";

function mockStorage(): ResurfaceStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

const baseGuards = {
  introDismissed: true,
  selectedEntry: null,
  loading: false,
  searchTrimmed: true,
  isSearchOpen: false,
  editingEntryId: null as string | null,
  triedResurface: false,
};

describe("resurface session", () => {
  it("only one attempt per session: shouldInvokeBackend false after shown this session", () => {
    assert.strictEqual(shouldInvokeBackend(true, false), false);
    assert.strictEqual(shouldInvokeBackend(true, true), false);
  });

  it("only one attempt per session: shouldInvokeBackend true when not yet shown and not in flight", () => {
    assert.strictEqual(shouldInvokeBackend(false, false), true);
  });

  it("resurfacing does not trigger during active typing: mayAttemptResurface false when editing", () => {
    assert.strictEqual(
      mayAttemptResurface({ ...baseGuards, editingEntryId: "entry-1" }),
      false
    );
  });

  it("resurfacing does not trigger when search is open", () => {
    assert.strictEqual(
      mayAttemptResurface({ ...baseGuards, isSearchOpen: true }),
      false
    );
  });

  it("resurfacing does not trigger when search query non-empty", () => {
    assert.strictEqual(
      mayAttemptResurface({ ...baseGuards, searchTrimmed: false }),
      false
    );
  });

  it("resurfacing only attempted when guards pass", () => {
    assert.strictEqual(mayAttemptResurface(baseGuards), true);
  });

  it("same entry does not resurface twice: cooldown excludes recent ids", () => {
    const storage = mockStorage();
    const now = new Date();
    const recent = new Date(now);
    recent.setDate(recent.getDate() - 1);
    const history = [
      { id: "recent-id", shownAt: recent.toISOString() },
      { id: "old-id", shownAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString() },
    ];
    storage.setItem(RESURFACED_HISTORY_KEY, JSON.stringify(history));
    const ids = getIdsInCooldown(storage, RESURFACED_COOLDOWN_DAYS);
    assert.ok(ids.includes("recent-id"));
    assert.ok(!ids.includes("old-id"));
  });

  it("cooldown logic: markAsShown adds id and trims to max", () => {
    const storage = mockStorage();
    for (let i = 0; i < RESURFACED_HISTORY_MAX + 5; i++) {
      markAsShown(`id-${i}`, storage, RESURFACED_HISTORY_MAX);
    }
    const history = getResurfacedHistory(storage);
    assert.strictEqual(history.length, RESURFACED_HISTORY_MAX);
    assert.strictEqual(history[0].id, `id-${RESURFACED_HISTORY_MAX + 4}`);
  });

  it("cooldown logic: getIdsInCooldown returns only ids within window", () => {
    const storage = mockStorage();
    const now = new Date();
    const within = new Date(now);
    within.setDate(within.getDate() - 3);
    const outside = new Date(now);
    outside.setDate(outside.getDate() - (RESURFACED_COOLDOWN_DAYS + 1));
    storage.setItem(
      RESURFACED_HISTORY_KEY,
      JSON.stringify([
        { id: "within", shownAt: within.toISOString() },
        { id: "outside", shownAt: outside.toISOString() },
      ])
    );
    const ids = getIdsInCooldown(storage, RESURFACED_COOLDOWN_DAYS);
    assert.strictEqual(ids.length, 1);
    assert.strictEqual(ids[0], "within");
  });

  it("triedResurface prevents second attempt on open", () => {
    assert.strictEqual(
      mayAttemptResurface({ ...baseGuards, triedResurface: true }),
      false
    );
  });
});
