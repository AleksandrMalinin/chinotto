import { describe, it, expect, beforeEach } from "vitest";
import {
  AMBIENCE_CENTER,
  clampAmbienceLevel,
  deriveRoomToneAnchors,
  interpolateAmbienceTokens,
  loadStoredSpaceAmbience,
  saveSpaceAmbienceForScope,
  SPACE_AMBIENCE_STORAGE_KEY,
  SPACE_SCOPES_WITH_AMBIENCE,
} from "./spaceAmbience";
import { NEUTRAL_AMBIENCE_CENTER } from "./spaceThemeTokens";

describe("spaceAmbience", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clampAmbienceLevel keeps 0–100", () => {
    expect(clampAmbienceLevel(-1)).toBe(0);
    expect(clampAmbienceLevel(120)).toBe(100);
    expect(clampAmbienceLevel(44.6)).toBe(45);
  });

  it("center is neutral for every space", () => {
    for (const scope of SPACE_SCOPES_WITH_AMBIENCE) {
      expect(interpolateAmbienceTokens(scope, AMBIENCE_CENTER)).toEqual(
        NEUTRAL_AMBIENCE_CENTER
      );
    }
  });

  it("deriveRoomToneAnchors uses one neutral default for all scopes", () => {
    const work = deriveRoomToneAnchors("work");
    const personal = deriveRoomToneAnchors("personal");
    expect(work.default).toEqual(personal.default);
    expect(work.default.bg).toBe(NEUTRAL_AMBIENCE_CENTER.bg);
  });

  it("interpolateAmbienceTokens blends toward warm", () => {
    const mid = interpolateAmbienceTokens("personal", 75);
    expect(mid.bg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(mid.bg).not.toBe(NEUTRAL_AMBIENCE_CENTER.bg);
    expect(mid.spaceAmbientPrimary).not.toBe(
      NEUTRAL_AMBIENCE_CENTER.spaceAmbientPrimary
    );
  });

  it("saved levels are independent per space", () => {
    const stored = saveSpaceAmbienceForScope(
      "work",
      25,
      saveSpaceAmbienceForScope("personal", 80, loadStoredSpaceAmbience())
    );
    expect(stored.work).toBe(25);
    expect(stored.personal).toBe(80);
    expect(interpolateAmbienceTokens("work", stored.work).bg).not.toBe(
      interpolateAmbienceTokens("personal", stored.personal).bg
    );
  });

  it("loadStoredSpaceAmbience migrates palette strings", () => {
    localStorage.setItem(
      "chinotto.spacePalette",
      JSON.stringify({ work: "warm" })
    );
    expect(loadStoredSpaceAmbience().work).toBe(82);
  });

  it("saveSpaceAmbienceForScope persists per scope", () => {
    const next = saveSpaceAmbienceForScope("inbox", 30, loadStoredSpaceAmbience());
    expect(next.inbox).toBe(30);
    expect(localStorage.getItem(SPACE_AMBIENCE_STORAGE_KEY)).toContain('"inbox":30');
  });
});
