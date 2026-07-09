import { describe, it, expect } from "vitest";
import {
  isThemeNudgeInCooldown,
  markThemeNudgeDismissed,
  mayAttemptThemeNudge,
  pickThemeNudgeCandidate,
  THEME_NUDGE_MIN_CLUSTER,
} from "./themeNudge";

const baseGuards = {
  themesEnabled: true,
  triedResurface: true,
  memoryEcho: false,
  introDismissed: true,
  selectedEntry: null,
  loading: false,
  searchTrimmed: true,
  isSearchOpen: false,
  composeExpanded: false,
  editingEntryId: null,
  triedThemeNudge: false,
};

describe("themeNudge", () => {
  it("mayAttemptThemeNudge requires resurface attempt first", () => {
    expect(mayAttemptThemeNudge({ ...baseGuards, triedResurface: false })).toBe(
      false
    );
    expect(mayAttemptThemeNudge(baseGuards)).toBe(true);
  });

  it("pickThemeNudgeCandidate ignores small clusters and cooldown themes", () => {
    const storage = {
      items: {} as Record<string, string>,
      getItem(key: string) {
        return this.items[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.items[key] = value;
      },
    };
    markThemeNudgeDismissed("book", storage);
    const picked = pickThemeNudgeCandidate(
      [
        { themeId: "book", count: THEME_NUDGE_MIN_CLUSTER },
        { themeId: "therapy", count: THEME_NUDGE_MIN_CLUSTER + 2 },
      ],
      storage
    );
    expect(picked?.themeId).toBe("therapy");
  });

  it("isThemeNudgeInCooldown is true after dismiss", () => {
    const storage = {
      items: {} as Record<string, string>,
      getItem(key: string) {
        return this.items[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.items[key] = value;
      },
    };
    markThemeNudgeDismissed("links", storage);
    expect(isThemeNudgeInCooldown("links", storage)).toBe(true);
  });
});
