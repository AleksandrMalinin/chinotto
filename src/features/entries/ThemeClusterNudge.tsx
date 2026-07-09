import { SYSTEM_THEME_LINKS, themeLabel, type UserTheme } from "@/lib/entryThemes";

function nudgeMessage(
  themeId: string,
  count: number,
  userThemes: UserTheme[]
): string {
  const thoughtWord = count === 1 ? "thought" : "thoughts";
  if (themeId === SYSTEM_THEME_LINKS) {
    return `You saved ${count} link${count === 1 ? "" : "s"} this week.`;
  }
  return `You wrote ${count} ${thoughtWord} about ${themeLabel(themeId, userThemes).toLowerCase()} this week.`;
}

type Props = {
  themeId: string;
  count: number;
  userThemes: UserTheme[];
  onBrowse: () => void;
  onDismiss: () => void;
};

export function ThemeClusterNudge({
  themeId,
  count,
  userThemes,
  onBrowse,
  onDismiss,
}: Props) {
  return (
    <section className="theme-cluster-nudge" aria-label="Theme cluster">
      <p className="theme-cluster-nudge-copy">
        {nudgeMessage(themeId, count, userThemes)}
      </p>
      <div className="theme-cluster-nudge-actions">
        <button type="button" className="theme-cluster-nudge-browse" onClick={onBrowse}>
          Browse
        </button>
        <button
          type="button"
          className="theme-cluster-nudge-dismiss"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
