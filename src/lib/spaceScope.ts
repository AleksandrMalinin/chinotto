export type SpaceScope = "all" | "inbox" | "work" | "personal";

export const SPACE_SCOPE_STORAGE_KEY = "chinotto.spaceScope";

const VALID: readonly SpaceScope[] = ["all", "inbox", "work", "personal"];

export function parseStoredSpaceScope(raw: string | null): SpaceScope {
  if (raw && (VALID as readonly string[]).includes(raw)) {
    return raw as SpaceScope;
  }
  return "all";
}

/** Maps to backend `spaceFilter`: omit/`undefined` = all stream; `"inbox"` = NULL only */
export function toApiSpaceFilter(scope: SpaceScope): string | undefined {
  if (scope === "all") return undefined;
  if (scope === "inbox") return "inbox";
  return scope;
}

/** Where new entries land: Inbox unless Work or Personal is active */
export function captureSpaceId(scope: SpaceScope): string | undefined {
  if (scope === "work" || scope === "personal") return scope;
  return undefined;
}

/** Stream lens to select after assigning an entry (never switches to “All”). */
export function spaceScopeFromDestination(spaceId: string | null): SpaceScope {
  if (spaceId === "work" || spaceId === "personal") return spaceId;
  return "inbox";
}
