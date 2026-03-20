/**
 * Rules for showing the search shortcut control next to capture.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { shouldShowSearchTrigger } from "./searchTriggerVisibility";

describe("shouldShowSearchTrigger", () => {
  it("hides when there is no active query and the stream list is empty", () => {
    assert.strictEqual(
      shouldShowSearchTrigger({
        searchQueryActive: false,
        entriesLength: 0,
        hasEntriesInDb: false,
      }),
      false
    );
  });

  it("shows when there is no active query and the stream has at least one entry", () => {
    assert.strictEqual(
      shouldShowSearchTrigger({
        searchQueryActive: false,
        entriesLength: 1,
        hasEntriesInDb: false,
      }),
      true
    );
  });

  it("when the stream list is empty, hides even if hasEntriesInDb is stale true", () => {
    assert.strictEqual(
      shouldShowSearchTrigger({
        searchQueryActive: false,
        entriesLength: 0,
        hasEntriesInDb: true,
      }),
      false
    );
  });

  it("with an active search query, uses hasEntriesInDb so zero FTS hits do not hide the control", () => {
    assert.strictEqual(
      shouldShowSearchTrigger({
        searchQueryActive: true,
        entriesLength: 0,
        hasEntriesInDb: true,
      }),
      true
    );
  });

  it("with an active search query, hides when the database has no entries", () => {
    assert.strictEqual(
      shouldShowSearchTrigger({
        searchQueryActive: true,
        entriesLength: 0,
        hasEntriesInDb: false,
      }),
      false
    );
  });
});
