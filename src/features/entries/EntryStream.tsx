import type { Entry } from "../../types/entry";

type Props = {
  entries: Entry[];
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EntryStream({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="stream-empty" aria-live="polite">
        No entries yet. Type above and press Enter to add one.
      </p>
    );
  }
  return (
    <ul className="entry-stream" aria-label="Entries">
      {entries.map((entry) => (
        <li key={entry.id} className="entry-item">
          <span className="entry-text">{entry.text}</span>
          <time className="entry-time" dateTime={entry.created_at}>
            {formatDate(entry.created_at)}
          </time>
        </li>
      ))}
    </ul>
  );
}
