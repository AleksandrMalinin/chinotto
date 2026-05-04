import { describe, expect, it, vi } from "vitest";
import {
  parseFirebaseAuthError,
  userMessageFromCredentialApplyError,
  userMessageFromFirebasePopupOrRedirect,
  userMessageTauriOAuthPopupOnly,
} from "./oauthDiagnostics";

describe("userMessageTauriOAuthPopupOnly", () => {
  it("explains redirect is unavailable and points to popup retry", () => {
    const msg = userMessageTauriOAuthPopupOnly();
    expect(msg).toContain("redirect");
    expect(msg).toContain("Continue with Apple");
  });
});

describe("userMessageFromFirebasePopupOrRedirect", () => {
  it("maps auth/unauthorized-domain to Firebase authorized-domains hint", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const msg = userMessageFromFirebasePopupOrRedirect({
        code: "auth/unauthorized-domain",
        message: "x",
      });
      expect(msg).toContain("Firebase Hosting");
      expect(msg).toContain("web.app");
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("parseFirebaseAuthError", () => {
  it("normalizes failed-precondition without auth/ prefix", () => {
    const p = parseFirebaseAuthError({ code: "failed-precondition", message: "x" });
    expect(p.code).toBe("auth/failed-precondition");
  });
});

describe("userMessageFromCredentialApplyError", () => {
  it("maps auth/failed-precondition to session recovery copy", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const msg = userMessageFromCredentialApplyError({ code: "auth/failed-precondition", message: "x" });
      expect(msg).toContain("unexpected state");
      expect(msg).toContain("Quit Chinotto");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("maps bare failed-precondition to the same recovery copy", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const msg = userMessageFromCredentialApplyError({ code: "failed-precondition", message: "x" });
      expect(msg).toContain("unexpected state");
    } finally {
      vi.restoreAllMocks();
    }
  });
});
