import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import {
  isChinottoSyncAccessActiveInUserDoc,
  isFirestoreSessionAccessLostError,
  normalizeFirestoreCreatedAtForIngest,
} from "./desktopFirestoreSync";

describe("normalizeFirestoreCreatedAtForIngest", () => {
  it("passes through non-empty ISO strings", () => {
    expect(normalizeFirestoreCreatedAtForIngest("2025-01-15T12:00:00.000Z")).toBe(
      "2025-01-15T12:00:00.000Z"
    );
  });

  it("trims string values", () => {
    expect(normalizeFirestoreCreatedAtForIngest("  2025-01-15T12:00:00.000Z  ")).toBe(
      "2025-01-15T12:00:00.000Z"
    );
  });

  it("converts Firestore Timestamp", () => {
    const ts = Timestamp.fromMillis(Date.UTC(2025, 2, 1, 12, 0, 0));
    const out = normalizeFirestoreCreatedAtForIngest(ts);
    expect(out).toBe(ts.toDate().toISOString());
  });

  it("converts plain { seconds, nanoseconds }", () => {
    const out = normalizeFirestoreCreatedAtForIngest({
      seconds: 1740820800,
      nanoseconds: 0,
    });
    expect(out).toBe(new Date(1740820800 * 1000).toISOString());
  });

  it("converts plain { seconds } only", () => {
    const out = normalizeFirestoreCreatedAtForIngest({ seconds: 1740820800 });
    expect(out).toBe(new Date(1740820800 * 1000).toISOString());
  });

  it("returns null for empty or missing", () => {
    expect(normalizeFirestoreCreatedAtForIngest(null)).toBeNull();
    expect(normalizeFirestoreCreatedAtForIngest("")).toBeNull();
    expect(normalizeFirestoreCreatedAtForIngest("   ")).toBeNull();
    expect(normalizeFirestoreCreatedAtForIngest({})).toBeNull();
  });
});

describe("isFirestoreSessionAccessLostError", () => {
  it("is true for permission-denied and unauthenticated Firestore-style errors", () => {
    expect(isFirestoreSessionAccessLostError({ code: "permission-denied" })).toBe(true);
    expect(isFirestoreSessionAccessLostError({ code: "unauthenticated" })).toBe(true);
    expect(isFirestoreSessionAccessLostError({ code: "unavailable" })).toBe(false);
    expect(isFirestoreSessionAccessLostError(null)).toBe(false);
  });
});

describe("isChinottoSyncAccessActiveInUserDoc", () => {
  it("is true only when chinottoSyncAccess.active is strictly true", () => {
    expect(isChinottoSyncAccessActiveInUserDoc(undefined)).toBe(false);
    expect(isChinottoSyncAccessActiveInUserDoc({})).toBe(false);
    expect(isChinottoSyncAccessActiveInUserDoc({ chinottoSyncAccess: {} })).toBe(false);
    expect(isChinottoSyncAccessActiveInUserDoc({ chinottoSyncAccess: { active: false } })).toBe(false);
    expect(isChinottoSyncAccessActiveInUserDoc({ chinottoSyncAccess: { active: true } })).toBe(true);
  });
});
