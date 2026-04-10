import { describe, expect, it } from "vitest";
import { getDesktopSyncHeaderCtaCopy } from "./useDesktopSyncHeaderCta";

describe("getDesktopSyncHeaderCtaCopy", () => {
  it("shows Enable sync when Firebase sync is not configured", () => {
    const c = getDesktopSyncHeaderCtaCopy({
      firebaseConfigured: false,
      authReady: true,
      signedInNonAnonymous: false,
      profileLoading: false,
      profileActive: false,
    });
    expect(c.label).toBe("Enable sync");
    expect(c.showDot).toBe(false);
  });

  it("shows Checking sync until auth is ready", () => {
    const c = getDesktopSyncHeaderCtaCopy({
      firebaseConfigured: true,
      authReady: false,
      signedInNonAnonymous: false,
      profileLoading: false,
      profileActive: false,
    });
    expect(c.label).toBe("Checking sync");
    expect(c.showDot).toBe(true);
  });

  it("shows Sync on when signed in and profile reports active", () => {
    const c = getDesktopSyncHeaderCtaCopy({
      firebaseConfigured: true,
      authReady: true,
      signedInNonAnonymous: true,
      profileLoading: false,
      profileActive: true,
    });
    expect(c.label).toBe("Sync on");
    expect(c.showDot).toBe(true);
  });

  it("shows Enable sync when signed in but sync not active yet", () => {
    const c = getDesktopSyncHeaderCtaCopy({
      firebaseConfigured: true,
      authReady: true,
      signedInNonAnonymous: true,
      profileLoading: false,
      profileActive: false,
    });
    expect(c.label).toBe("Enable sync");
    expect(c.showDot).toBe(true);
  });

  it("hides dot when signed out with Firebase configured", () => {
    const c = getDesktopSyncHeaderCtaCopy({
      firebaseConfigured: true,
      authReady: true,
      signedInNonAnonymous: false,
      profileLoading: false,
      profileActive: false,
    });
    expect(c.showDot).toBe(false);
  });
});
