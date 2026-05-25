export const CAPTURE_INPUT_MIN_HEIGHT_PX = 32;

/**
 * Inline capture is one visual line; expand when the draft clearly outgrows it.
 * Char cap catches long unbroken strings (horizontal overflow in a fixed-height field).
 */
export const COMPOSE_AUTO_EXPAND_CHARS = 64;

const SCROLL_OVERFLOW_TOLERANCE_PX = 2;

/** Auto-grow height for compose-expand overlay only (inline capture stays one line). */
export function syncComposeExpandInputHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, CAPTURE_INPUT_MIN_HEIGHT_PX)}px`;
}

function inlineCaptureOverflows(el: HTMLTextAreaElement): boolean {
  return (
    el.scrollHeight > el.clientHeight + SCROLL_OVERFLOW_TOLERANCE_PX ||
    el.scrollWidth > el.clientWidth + SCROLL_OVERFLOW_TOLERANCE_PX
  );
}

/** True when draft outgrows the one-line inline capture field. */
export function shouldAutoExpandCapture(
  el: HTMLTextAreaElement | null,
  draft: string
): boolean {
  if (!draft.trim()) return false;
  if (draft.includes("\n")) return true;
  if (draft.length > COMPOSE_AUTO_EXPAND_CHARS) return true;
  if (!el) return false;
  return inlineCaptureOverflows(el);
}
