function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Highlight shared trail keywords in preview text (case-insensitive word boundaries). */
export function highlightTrailSharedTerms(text: string, terms: string[]): string {
  if (terms.length === 0) return escapeHtml(text);
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  let html = escapeHtml(text);
  for (const term of sorted) {
    if (!term) continue;
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=[^\\p{L}\\p{N}]|$)`,
      "giu"
    );
    html = html.replace(pattern, (_m, before: string, word: string) => {
      return `${before}<mark class="trail-shared-mark">${word}</mark>`;
    });
  }
  return html;
}
