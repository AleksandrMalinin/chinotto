/** Require scrolling past this before “near top” can dismiss jump context. */
export const JUMP_CONTEXT_SCROLL_AWAY_MIN_PX = 120;

export const JUMP_CONTEXT_SCROLL_TOP_CLEAR_PX = 48;

/**
 * One scroll-tick update for “user scrolled away, then back near top” dismissal.
 * Caller keeps `hadScrolledAway` in a ref; reset when jump context starts or clears.
 */
export function jumpScrollDismissStep(
  scrollTop: number,
  hadScrolledAway: boolean
): { hadScrolledAway: boolean; shouldDismiss: boolean } {
  const nextHad =
    hadScrolledAway || scrollTop > JUMP_CONTEXT_SCROLL_AWAY_MIN_PX;
  const shouldDismiss =
    scrollTop <= JUMP_CONTEXT_SCROLL_TOP_CLEAR_PX && nextHad;
  return { hadScrolledAway: nextHad, shouldDismiss };
}

/** Hysteresis for showing “Back to now” when the user scrolls the stream (not only calendar jump). */
export function streamBackToNowVisibleStep(
  scrollTop: number,
  wasVisible: boolean
): boolean {
  if (scrollTop > JUMP_CONTEXT_SCROLL_AWAY_MIN_PX) return true;
  if (scrollTop <= JUMP_CONTEXT_SCROLL_TOP_CLEAR_PX) return false;
  return wasVisible;
}

/** Whether the stream is far enough below “now” to show Back to now (scroll or calendar jump). */
export function streamIsScrolledAwayFromTop(scrollTop: number): boolean {
  return scrollTop > JUMP_CONTEXT_SCROLL_AWAY_MIN_PX;
}
