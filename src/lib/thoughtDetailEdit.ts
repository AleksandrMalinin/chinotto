/**
 * Past-entry editing in EntryDetail (textarea, debounced save, continuation newlines)
 * and matching single-line stream preview. Off in release builds unless explicitly enabled.
 *
 * - Production (`tauri build`): off unless `VITE_THOUGHT_DETAIL_EDIT=true`.
 * - Dev (`tauri dev`, `vite`): on unless `VITE_THOUGHT_DETAIL_EDIT=false`.
 */
export function isThoughtDetailEditEnabled(): boolean {
  const v = import.meta.env.VITE_THOUGHT_DETAIL_EDIT;
  if (v === "false") return false;
  if (v === "true") return true;
  return import.meta.env.DEV;
}
