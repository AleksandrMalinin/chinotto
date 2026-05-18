import type { SpaceScope } from "@/lib/spaceScope";

/** One-line empty copy for a scoped lens or All after the user has saved before. */
export function quietEmptyStreamMessage(
  scope: SpaceScope,
  hasEverSaved: boolean
): string | null {
  if (scope === "work") return "Nothing in Work yet.";
  if (scope === "personal") return "Nothing in Personal yet.";
  if (scope === "inbox") return "Inbox is empty.";
  if (scope === "all" && hasEverSaved) return "Your stream is empty.";
  return null;
}

export function shouldShowFullEmptyOnboarding(
  scope: SpaceScope,
  hasEverSaved: boolean
): boolean {
  return scope === "all" && !hasEverSaved;
}
