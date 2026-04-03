import { describe, expect, it } from "vitest";
import { userMessageTauriOAuthPopupOnly } from "./oauthDiagnostics";

describe("userMessageTauriOAuthPopupOnly", () => {
  it("explains redirect is unavailable and points to popup retry", () => {
    const msg = userMessageTauriOAuthPopupOnly();
    expect(msg).toContain("redirect");
    expect(msg).toContain("Continue with Apple");
  });
});
