import { themeLabel } from "@/lib/entryThemes";

function nudgeMessage(themeId: string, count: number): string {
  const thoughtWord = count === 1 ? "thought" : "thoughts";
  if (themeId === "links") {
    return `You saved ${count} link${count === 1 ? "" : "s"} this week.`;
  }
  return `You wrote ${count} ${thoughtWord} about ${themeLabel(themeId).toLowerCase()} this week.`;
}

type Props = {
  themeId: string;
  count: number;
  onBrowse: () => void;
  onDismiss: () => void;
};

export function ThemeClusterNudge({
  themeId,
  count,
  onBrowse,
  onDismiss,
}: Props) {
  return (
    <section className="theme-cluster-nudge" aria-label="Theme cluster">
      <p className="theme-cluster-nudge-copy">
        {nudgeMessage(themeId, count)}
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
