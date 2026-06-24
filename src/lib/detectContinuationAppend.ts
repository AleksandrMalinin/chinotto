export type ContinuationAppend = {
  normalizedText: string;
  fromOffset: number;
};

/**
 * User appended text at the end of an existing thought (detail edit).
 * Inserts a newline before the suffix when missing so continuation can render.
 */
export function detectContinuationAppend(
  original: string,
  finalText: string
): ContinuationAppend | null {
  if (!original || finalText.length <= original.length) return null;
  if (!finalText.startsWith(original)) return null;

  const rawSuffix = finalText.slice(original.length);
  if (!rawSuffix.trim()) return null;

  if (rawSuffix.startsWith("\n")) {
    return { normalizedText: finalText, fromOffset: original.length + 1 };
  }

  return {
    normalizedText: `${original}\n${rawSuffix}`,
    fromOffset: original.length + 1,
  };
}
