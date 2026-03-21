/**
 * Catalog presence: full-list load, post-delete reconcile, search shortcut visibility.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import {
  hasEntriesAfterFullListLoad,
  resolveHasEntriesInDbAfterDeletion,
  shouldShowSearchTrigger,
} from "./entryCatalogPresence";
import type { Entry } from "@/types/entry";

const e = (id: string): Entry => ({
  id,
  text: "t",
  created_at: "2025-01-01T00:00:00.000Z",
});

describe("hasEntriesAfterFullListLoad", () => {
  it("false when full list is empty", () => {
    expect(hasEntriesAfterFullListLoad(0)).toBe(false);
  });

  it("true when full list has rows", () => {
    expect(hasEntriesAfterFullListLoad(1)).toBe(true);
  });
});

describe("resolveHasEntriesInDbAfterDeletion", () => {
  it("returns true when something remains in the current slice (any query mode)", async () => {
    const listEntries = vi.fn<() => Promise<Entry[]>>();
    await expect(
      resolveHasEntriesInDbAfterDeletion({
        remainingInCurrentView: 1,
        isDevSimulateNewUser: false,
        listEntries,
      })
    ).resolves.toBe(true);
    expect(listEntries).not.toHaveBeenCalled();
  });

  it("returns false in dev new-user simulation without calling listEntries", async () => {
    const listEntries = vi.fn<() => Promise<Entry[]>>();
    await expect(
      resolveHasEntriesInDbAfterDeletion({
        remainingInCurrentView: 0,
        isDevSimulateNewUser: true,
        listEntries,
      })
    ).resolves.toBe(false);
    expect(listEntries).not.toHaveBeenCalled();
  });

  it("when slice is empty, uses full list: empty DB → false", async () => {
    const listEntries = vi.fn(() => Promise.resolve([] as Entry[]));
    await expect(
      resolveHasEntriesInDbAfterDeletion({
        remainingInCurrentView: 0,
        isDevSimulateNewUser: false,
        listEntries,
      })
    ).resolves.toBe(false);
    expect(listEntries).toHaveBeenCalledOnce();
  });

  it("when slice is empty but DB still has rows (e.g. last FTS match deleted) → true", async () => {
    const listEntries = vi.fn(() => Promise.resolve([e("a"), e("b")]));
    await expect(
      resolveHasEntriesInDbAfterDeletion({
        remainingInCurrentView: 0,
        isDevSimulateNewUser: false,
        listEntries,
      })
    ).resolves.toBe(true);
  });
});

describe("shouldShowSearchTrigger", () => {
  it("hides when no active query and full stream slice is empty", () => {
    expect(
      shouldShowSearchTrigger({
        searchQueryActive: false,
        entriesLength: 0,
        hasEntriesInDb: false,
      })
    ).toBe(false);
  });

  it("shows when no active query and stream has entries", () => {
    expect(
      shouldShowSearchTrigger({
        searchQueryActive: false,
        entriesLength: 2,
        hasEntriesInDb: false,
      })
    ).toBe(true);
  });

  it("with empty full list, hides even if hasEntriesInDb is stale", () => {
    expect(
      shouldShowSearchTrigger({
        searchQueryActive: false,
        entriesLength: 0,
        hasEntriesInDb: true,
      })
    ).toBe(false);
  });

  it("active query + zero FTS hits + DB non-empty: still show (avoid hiding on no matches)", () => {
    expect(
      shouldShowSearchTrigger({
        searchQueryActive: true,
        entriesLength: 0,
        hasEntriesInDb: true,
      })
    ).toBe(true);
  });

  it("active query + empty DB: hide", () => {
    expect(
      shouldShowSearchTrigger({
        searchQueryActive: true,
        entriesLength: 0,
        hasEntriesInDb: false,
      })
    ).toBe(false);
  });
});
