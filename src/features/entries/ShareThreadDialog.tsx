import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { save as saveDialog, message as dialogMessage } from "@tauri-apps/plugin-dialog";
import type { Entry } from "../../types/entry";
import { buildShareThreadHtml } from "@/lib/shareThreadHtml";
import { shareThreadUrl } from "@/lib/chinottoLinks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createShareThread, writeUtf8File } from "./shareThreadApi";
import { findSimilarEntries } from "./entryApi";
import { copyTextToClipboard } from "@/lib/copyToClipboard";
import {
  publishShareThreadSnapshot,
  shareThreadCreateMessage,
} from "@/lib/shareThreadUpload";

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

function relativeBeat(
  currentIso: string,
  otherIso: string,
  isCurrent: boolean
): string | null {
  if (isCurrent) return "Current";
  const days = Math.round(
    (new Date(otherIso).getTime() - new Date(currentIso).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "Same day";
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} day${n === 1 ? "" : "s"} earlier`;
  }
  return `${days} day${days === 1 ? "" : "s"} later`;
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
  const [relatedCandidates, setRelatedCandidates] = useState<Entry[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [selectedRelatedIds, setSelectedRelatedIds] = useState<Set<string>>(
    () => new Set()
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

  useEffect(() => {
    let cancelled = false;
    setRelatedLoading(true);
    findSimilarEntries(currentEntry.id)
      .then((list) => {
        if (cancelled) return;
        const threadIds = new Set(candidates.map((e) => e.id));
        const next = list.filter((e) => !threadIds.has(e.id));
        setRelatedCandidates(next);
        setSelectedRelatedIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setRelatedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentEntry.id, candidates]);

  const toggleRelated = (id: string) => {
    setSelectedRelatedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      const relatedEntries = relatedCandidates.filter((e) =>
        selectedRelatedIds.has(e.id)
      );
      const html = buildShareThreadHtml({
        contextNote: thread.context_note,
        expiresAt: thread.expires_at,
        entries,
        relatedEntries,
      });
      const path = await saveDialog({
        defaultPath: `chinotto-thread-${thread.token.slice(0, 8)}.html`,
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (path != null) {
        await writeUtf8File(path, html);
      }
      const hosted = await publishShareThreadSnapshot({
        token: thread.token,
        html,
        expiresAt: thread.expires_at,
        contextNote: thread.context_note,
      });
      const url = shareThreadUrl(thread.token);
      const copied = await copyTextToClipboard(url);
      await dialogMessage(
        shareThreadCreateMessage({
          url,
          savedHtml: path != null,
          hosted,
          copied,
        }),
        { title: "Share thread" }
      );
      onClose();
    } catch (e) {
      await dialogMessage(String(e), { kind: "error", title: "Share thread" });
    } finally {
      setCreating(false);
    }
  };

  const summaryLabel = `${selectedCount} thought${selectedCount === 1 ? "" : "s"} · oldest first`;

  return createPortal(
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
        <header className="share-thread-head">
          <div className="share-thread-head-text">
            <h2 id="share-thread-title" className="share-thread-title">
              Share thread
            </h2>
            <p className="share-thread-summary">{summaryLabel}</p>
          </div>
          <button
            type="button"
            className="share-thread-close"
            disabled={creating}
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="share-thread-body">
          <p className="share-thread-lead">
            A read-only link for someone you trust. Nothing leaves your device
            until you create the link.
          </p>

          <section className="share-thread-section" aria-label="Thoughts to include">
          <h3 className="share-thread-section-title">Include</h3>
          <ul className="share-thread-entry-list">
            {candidates.map((e) => {
              const checked = selectedIds.has(e.id);
              const isCurrent = e.id === currentEntry.id;
              const disabled =
                creating ||
                (isCurrent && checked) ||
                (!checked && atLimit);
              const beat = relativeBeat(
                currentEntry.created_at,
                e.created_at,
                isCurrent
              );
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={disabled}
                    className={[
                      "share-thread-entry-row",
                      checked ? "share-thread-entry-row--selected" : "",
                      isCurrent ? "share-thread-entry-row--current" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => toggleEntry(e.id)}
                  >
                    <span className="share-thread-entry-check" aria-hidden="true">
                      {checked ? "✓" : ""}
                    </span>
                    <span className="share-thread-entry-body">
                      {beat ? (
                        <span className="share-thread-entry-meta">{beat}</span>
                      ) : null}
                      <span className="share-thread-entry-text">
                        {truncate(e.text, 100)}
                      </span>
                      <time
                        className="share-thread-entry-time"
                        dateTime={e.created_at}
                      >
                        {formatTimestamp(e.created_at)}
                      </time>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {atLimit && candidates.length > MAX_ENTRIES ? (
            <p className="share-thread-hint">At most {MAX_ENTRIES} thoughts.</p>
          ) : null}
        </section>

        {relatedLoading || relatedCandidates.length > 0 ? (
          <section className="share-thread-section" aria-label="Related thoughts">
            <h3 className="share-thread-section-title">Related thoughts</h3>
            {relatedLoading ? (
              <p className="share-thread-hint">Loading related thoughts…</p>
            ) : (
              <ul className="share-thread-entry-list">
                {relatedCandidates.map((e) => {
                  const checked = selectedRelatedIds.has(e.id);
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        disabled={creating}
                        className={[
                          "share-thread-entry-row",
                          checked ? "share-thread-entry-row--selected" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => toggleRelated(e.id)}
                      >
                        <span className="share-thread-entry-check" aria-hidden="true">
                          {checked ? "✓" : ""}
                        </span>
                        <span className="share-thread-entry-body">
                          <span className="share-thread-entry-meta">Related</span>
                          <span className="share-thread-entry-text">
                            {truncate(e.text, 100)}
                          </span>
                          <time
                            className="share-thread-entry-time"
                            dateTime={e.created_at}
                          >
                            {formatTimestamp(e.created_at)}
                          </time>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        <section className="share-thread-section">
          <label className="share-thread-section-title" htmlFor="share-context-note">
            Context for reader
            <span className="share-thread-optional">optional</span>
          </label>
          <Textarea
            id="share-context-note"
            className="share-thread-note min-h-0"
            value={contextNote}
            placeholder="One line of context…"
            rows={1}
            disabled={creating}
            onChange={(e) => setContextNote(e.target.value)}
          />
        </section>

        <section className="share-thread-section">
          <span className="share-thread-section-title" id="share-expiry-label">
            Link expires
          </span>
          <div
            className="share-thread-expiry"
            role="tablist"
            aria-labelledby="share-expiry-label"
          >
            {EXPIRY_OPTIONS.map((days) => {
              const active = expiresInDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  role="tab"
                  disabled={creating}
                  aria-selected={active}
                  className={
                    active
                      ? "space-scope-tab space-scope-tab--active share-thread-expiry-tab"
                      : "space-scope-tab share-thread-expiry-tab"
                  }
                  onClick={() => setExpiresInDays(days)}
                >
                  {days}d
                </button>
              );
            })}
          </div>
        </section>
        </div>

        <footer className="share-thread-footer">
          <p className="share-thread-privacy">
            Read-only · expires · revoke anytime · link copied on create
          </p>
          <div className="share-thread-actions">
            <Button
              type="button"
              className="share-thread-action share-thread-action--primary"
              disabled={creating || selectedCount === 0}
              onClick={() => void handleCreate()}
            >
              {creating ? "Creating link…" : "Create link"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="share-thread-action share-thread-action--cancel"
              disabled={creating}
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}
