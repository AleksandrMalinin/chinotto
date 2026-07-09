import type { SpaceScope } from "@/lib/spaceScope";

/** Main capture placeholder — shows where the thought will land. */
export function capturePlaceholderForScope(
  scope: SpaceScope,
  compact = false
): string {
  if (compact) return "New thought…";
  switch (scope) {
    case "work":
      return "Capture to Work…";
    case "personal":
      return "Capture to Personal…";
    case "inbox":
      return "Capture to Inbox…";
    default:
      return "Capture a thought…";
  }
}
