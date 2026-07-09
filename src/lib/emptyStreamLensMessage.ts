import type { SpaceScope } from "@/lib/spaceScope";

/** One-line empty copy for a scoped lens. All after save uses soft onboarding instead. */
export function quietEmptyStreamMessage(
  scope: SpaceScope,
  _hasEverSaved: boolean
): string | null {
  if (scope === "work") {
    return "Nothing in Work yet. Switch to All to see everything.";
  }
  if (scope === "personal") {
    return "Nothing in Personal yet. Switch to All to see everything.";
  }
  if (scope === "inbox") {
    return "Inbox is empty. Switch to All to see everything.";
  }
  return null;
}

export function shouldShowFullEmptyOnboarding(
  scope: SpaceScope,
  hasEverSaved: boolean
): boolean {
  return scope === "all" && !hasEverSaved;
}
