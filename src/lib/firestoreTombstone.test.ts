import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { isFirestoreDocumentTombstoned } from "./firestoreTombstone";

describe("isFirestoreDocumentTombstoned", () => {
  it("treats missing deletedAt as active (legacy doc)", () => {
    expect(
      isFirestoreDocumentTombstoned({
        text: "hello",
        createdAt: "2025-01-01T00:00:00.000Z",
      })
    ).toBe(false);
  });

  it("treats null deletedAt as active", () => {
    expect(isFirestoreDocumentTombstoned({ deletedAt: null })).toBe(false);
  });

  it("detects Timestamp-like object with toDate", () => {
    expect(
      isFirestoreDocumentTombstoned({
        deletedAt: { toDate: () => new Date("2025-03-01T12:00:00.000Z") },
      })
    ).toBe(true);
  });

  it("detects plain seconds shape", () => {
    expect(isFirestoreDocumentTombstoned({ deletedAt: { seconds: 1740000000 } })).toBe(
      true
    );
  });

  it("detects bigint seconds shape", () => {
    expect(isFirestoreDocumentTombstoned({ deletedAt: { seconds: 1740000000n } })).toBe(true);
  });

  it("detects Firestore Timestamp instance", () => {
    expect(
      isFirestoreDocumentTombstoned({
        deletedAt: Timestamp.fromMillis(1_740_000_000_000),
      })
    ).toBe(true);
  });

  it("detects non-empty string deletedAt", () => {
    expect(
      isFirestoreDocumentTombstoned({ deletedAt: "2025-03-01T12:00:00.000Z" })
    ).toBe(true);
  });
});
