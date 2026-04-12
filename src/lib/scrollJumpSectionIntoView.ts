/**
 * Target distance from viewport top to the section when jumping to a date (sticky chip + small gap).
 * Smaller value → scrolls farther down → previous section scrolls off the top.
 * Keep roughly in line with `.stream-section { scroll-margin-top }` in index.css.
 */
const STREAM_SECTION_TOP_OFFSET_REM = 1.3;

/**
 * Scrolls the stream section that contains the entry (date heading + list) into view
 * so the previous calendar section does not remain visible above it.
 */
export function scrollJumpSectionIntoView(entryId: string): void {
  const entryEl = document.getElementById(`entry-${entryId}`);
  if (!entryEl) return;

  const section = entryEl.closest(".stream-section");
  const target: Element = section ?? entryEl;

  const scroller = document.scrollingElement ?? document.documentElement;
  const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const paddingTop = STREAM_SECTION_TOP_OFFSET_REM * rootFontPx;

  const rect = target.getBoundingClientRect();
  const y = scroller.scrollTop + rect.top - paddingTop;
  const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const top = Math.min(maxScroll, Math.max(0, Math.ceil(y)));

  scroller.scrollTo({ top, behavior: "smooth" });
  window.scrollTo({ top, behavior: "smooth" });
}
