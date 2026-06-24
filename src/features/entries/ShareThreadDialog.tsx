import { useCallback, useEffect, useMemo, useState } from "react";
import { save as saveDialog, message as dialogMessage } from "@tauri-apps/plugin-dialog";
import type { Entry } from "../../types/entry";
import { buildShareThreadHtml } from "@/lib/shareThreadHtml";
import { shareThreadUrl } from "@/lib/chinottoLinks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createShareThread, writeUtf8File } from "./shareThreadApi";

const MAX_ENTRIES = 15;
const EXPIRY_OPTIONS = [7, 14, 30] as const;

type Props = {
  currentEntry: Entry;
  trailEntries: Entry[];
  onClose: () => void;
};

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ShareThreadDialog({
  currentEntry,
  trailEntries,
  onClose,
}: Props) {
  const candidates = useMemo(() => {
    const byId = new Map<string, Entry>();
    for (const e of trailEntries) byId.set(e.id, e);
    byId.set(currentEntry.id, currentEntry);
    return [...byId.values()].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [currentEntry, trailEntries]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(candidates.map((e) => e.id))
  );
  const [contextNote, setContextNote] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number>(14);
  const [creating, setCreating] = useState(false);

  const selectedCount = selectedIds.size;
  const atLimit = selectedCount >= MAX_ENTRIES;

  const toggleEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (id === currentEntry.id) return prev;
        next.delete(id);
      } else if (next.size < MAX_ENTRIES) {
        next.add(id);
      }
      return next;
    });
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creating) {
        e.preventDefault();
        onClose();
      }
    },
    [creating, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleCreate = async () => {
    if (selectedCount === 0 || creating) return;
    setCreating(true);
    try {
      const entryIds = candidates
        .filter((e) => selectedIds.has(e.id))
        .map((e) => e.id);
      const thread = await createShareThread({
        entryIds,
        contextNote: contextNote.trim() || undefined,
        expiresInDays,
      });
      const entries = candidates.filter((e) => selectedIds.has(e.id));
      const html = buildShareThreadHtml({
        contextNote: thread.context_note,
        expiresAt: thread.expires_at,
        entries,
      });
      const path = await saveDialog({
        defaultPath: `chinotto-thread-${thread.token.slice(0, 8)}.html`,
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (path != null) {
        await writeUtf8File(path, html);
      }
      const url = shareThreadUrl(thread.token);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* clipboard optional */
      }
      await dialogMessage(
        path != null
          ? `Thread saved. Link copied to clipboard.\n\n${url}\n\nThe link will work when hosted sharing is enabled. Until then, send the HTML file.`
          : `Thread created. Link copied to clipboard.\n\n${url}\n\nSave the HTML preview from Share thread again if you need a file.`,
        { title: "Share thread" }
      );
      onClose();
    } catch (e) {
      await dialogMessage(String(e), { kind: "error", title: "Share thread" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="share-thread-overlay"
      role="dialog"
      aria-labelledby="share-thread-title"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !creating) onClose();
      }}
    >
      <div className="share-thread-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="share-thread-title" className="share-thread-title">
          Share thread
        </h2>
        <p className="share-thread-lead">
          Create a read-only snapshot for someone you trust. Thoughts stay on
          your device until you share. The link expires; you can revoke later.
        </p>

        <fieldset className="share-thread-fieldset" disabled={creating}>
          <legend className="share-thread-legend">Thoughts</legend>
          <ul className="share-thread-entry-list">
            {candidates.map((e) => {
              const checked = selectedIds.has(e.id);
              const isCurrent = e.id === currentEntry.id;
              const disabled =
                creating ||
                (isCurrent && checked) ||
                (!checked && atLimit);
              return (
                <li key={e.id}>
                  <label className="share-thread-entry-label">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleEntry(e.id)}
                    />
                    <span className="share-thread-entry-body">
                      <span className="share-thread-entry-text">
                        {truncate(e.text, 100)}
                      </span>
                      <time
                        className="share-thread-entry-time"
                        dateTime={e.created_at}
                      >
                        {isCurrent ? "Current · " : ""}
                        {formatTimestamp(e.created_at)}
                      </time>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {atLimit && candidates.length > MAX_ENTRIES ? (
            <p className="share-thread-hint">At most {MAX_ENTRIES} thoughts.</p>
          ) : null}
        </fieldset>

        <label className="share-thread-label">
          Context note <span className="share-thread-optional">(optional)</span>
          <Textarea
            className="share-thread-note"
            value={contextNote}
            placeholder="A line of context for the reader…"
            rows={2}
            disabled={creating}
            onChange={(e) => setContextNote(e.target.value)}
          />
        </label>

        <fieldset className="share-thread-fieldset" disabled={creating}>
          <legend className="share-thread-legend">Expires in</legend>
          <div className="share-thread-expiry">
            {EXPIRY_OPTIONS.map((days) => (
              <label key={days} className="share-thread-expiry-option">
                <input
                  type="radio"
                  name="share-expiry"
                  checked={expiresInDays === days}
                  onChange={() => setExpiresInDays(days)}
                />
                {days} days
              </label>
            ))}
          </div>
        </fieldset>

        <div className="share-thread-actions">
          <Button
            type="button"
            disabled={creating || selectedCount === 0}
            onClick={() => void handleCreate()}
          >
            {creating ? "Creating…" : "Create and save preview"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={creating}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
