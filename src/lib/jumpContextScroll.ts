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
