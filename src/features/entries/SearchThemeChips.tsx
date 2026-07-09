import {
  ENTRY_THEMES,
  THEME_CHIP_MIN_COUNT,
  themeLabel,
} from "@/lib/entryThemes";

export type ThemeCount = {
  themeId: string;
  count: number;
};

type Props = {
  counts: ThemeCount[];
  selectedThemeId: string | null;
  onSelectTheme: (themeId: string | null) => void;
};

export function SearchThemeChips({
  counts,
  selectedThemeId,
  onSelectTheme,
}: Props) {
  const visible = ENTRY_THEMES.map((theme) => {
    const row = counts.find((c) => c.themeId === theme.id);
    const count = row?.count ?? 0;
    return { ...theme, count };
  }).filter((t) => t.count >= THEME_CHIP_MIN_COUNT);

  if (visible.length === 0) return null;

  return (
    <div className="search-theme-chips" role="group" aria-label="Filter by theme">
      {visible.map((theme) => {
        const active = selectedThemeId === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            className={
              active
                ? "search-theme-chip search-theme-chip--active"
                : "search-theme-chip"
            }
            aria-pressed={active}
            onClick={() => onSelectTheme(active ? null : theme.id)}
          >
            {themeLabel(theme.id)}
            <span className="search-theme-chip-count" aria-hidden>
              {theme.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
