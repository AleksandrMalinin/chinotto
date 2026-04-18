/**
 * Main timeline shows one logical line per entry; further lines belong in detail/edit only.
 */
export function streamPreviewFirstLine(text: string): string {
  const first = text.split(/\r?\n/, 1)[0];
  return first.trimEnd();
}
