import { useCallback } from "react";
import type { Entry } from "../../types/entry";

const HIGHLIGHT_START = "\u0001";
const HIGHLIGHT_END = "\u0002";
const PREVIEW_MAX_LEN = 140;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toHighlightHtml(highlighted: string): string {
  const escaped = escapeHtml(highlighted);
  return escaped
    .replace(new RegExp(HIGHLIGHT_START, "g"), "<mark>")
    .replace(new RegExp(HIGHLIGHT_END, "g"), "</mark>");
}

function truncateWithHighlights(s: string, maxLen: number): string {
  if (s.length <= maxLen) {
    let open = 0;
    for (const c of s) {
      if (c === HIGHLIGHT_START) open++;
      else if (c === HIGHLIGHT_END) open--;
    }
    return open > 0 ? s + HIGHLIGHT_END.repeat(open) : s;
  }
  let out = s.slice(0, maxLen);
  let open = 0;
  for (const c of out) {
    if (c === HIGHLIGHT_START) open++;
    else if (c === HIGHLIGHT_END) open--;
  }
  if (open > 0) out += HIGHLIGHT_END.repeat(open);
  return out + "…";
}

type Props = {
  entries: Entry[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onSelectEntry: (entry: Entry) => void;
};

export function SearchResultsList({
  entries,
  selectedIndex,
  onSelectIndex,
  onSelectEntry,
}: Props) {
  const renderPreview = useCallback((entry: Entry): string => {
    const raw = entry.highlighted ?? entry.text;
    const truncated = truncateWithHighlights(raw, PREVIEW_MAX_LEN);
    return toHighlightHtml(truncated);
  }, []);

  if (entries.length === 0) return null;

  return (
    <ul
      className="search-results-list"
      role="listbox"
      aria-label="Search results"
    >
      {entries.map((entry, i) => {
        const isSelected = i === selectedIndex;
        return (
          <li
            key={entry.id}
            role="option"
            aria-selected={isSelected}
            className={`search-results-item ${isSelected ? "search-results-item-selected" : ""}`}
            onClick={() => onSelectEntry(entry)}
            onMouseEnter={() => onSelectIndex(i)}
          >
            <span
              className="search-results-item-text"
              dangerouslySetInnerHTML={{ __html: renderPreview(entry) }}
            />
          </li>
        );
      })}
    </ul>
  );
}
