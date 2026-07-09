import { describe, it, expect, beforeEach } from "vitest";
import {
  AMBIENCE_CENTER,
  AMBIENCE_NEUTRAL_PLATEAU_MAX,
  AMBIENCE_NEUTRAL_PLATEAU_MIN,
  ROOM_TONE_PRESETS,
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

  it("ROOM_TONE_PRESETS cover cool neutral warm", () => {
    expect(ROOM_TONE_PRESETS.map((p) => p.level)).toEqual([10, 50, 90]);
  });

  it("clampAmbienceLevel keeps 0–100", () => {
    expect(clampAmbienceLevel(-1)).toBe(0);
    expect(clampAmbienceLevel(120)).toBe(100);
    expect(clampAmbienceLevel(44.6)).toBe(45);
  });

  it("center and neutral plateau use brand tokens for every space", () => {
    for (const scope of SPACE_SCOPES_WITH_AMBIENCE) {
      for (const level of [
        AMBIENCE_CENTER,
        AMBIENCE_NEUTRAL_PLATEAU_MIN,
        AMBIENCE_NEUTRAL_PLATEAU_MAX,
      ]) {
        expect(interpolateAmbienceTokens(scope, level)).toEqual(
          NEUTRAL_AMBIENCE_CENTER
        );
      }
    }
  });

  it("deriveRoomToneAnchors uses one neutral default for all scopes", () => {
    const work = deriveRoomToneAnchors("work");
    const personal = deriveRoomToneAnchors("personal");
    expect(work.default).toEqual(personal.default);
    expect(work.default.bg).toBe(NEUTRAL_AMBIENCE_CENTER.bg);
  });

  it("interpolateAmbienceTokens reaches full cool and warm poles", () => {
    const cool = interpolateAmbienceTokens("personal", 0);
    const warm = interpolateAmbienceTokens("personal", 100);
    expect(cool.spaceAmbientPrimary).toBe("rgba(55, 95, 175, 0.17)");
    expect(warm.spaceAmbientPrimary).toBe("rgba(255, 252, 248, 0.09)");
    expect(interpolateAmbienceTokens("personal", 80).spaceAmbientPrimary).not.toBe(
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
    expect(interpolateAmbienceTokens("work", stored.work).spaceAmbientPrimary).not.toBe(
      interpolateAmbienceTokens("personal", stored.personal).spaceAmbientPrimary
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
