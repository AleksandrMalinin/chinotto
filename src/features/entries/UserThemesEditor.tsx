import { useCallback, useEffect, useState } from "react";
import {
  createUserTheme,
  deleteUserTheme,
  listUserThemes,
  updateUserTheme,
  type UserTheme,
} from "@/features/entries/entryApi";
import { MAX_USER_THEMES } from "@/lib/entryThemes";

type ThemeDraft = {
  label: string;
};

type Props = {
  onThemesChange?: () => void;
};

export function UserThemesEditor({ onThemesChange }: Props) {
  const [themes, setThemes] = useState<UserTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ThemeDraft>>({});
  const [adding, setAdding] = useState(false);

  const loadThemes = useCallback(() => {
    setLoading(true);
    void listUserThemes()
      .then((rows) => {
        setThemes(rows);
        const nextDrafts: Record<string, ThemeDraft> = {};
        for (const theme of rows) {
          nextDrafts[theme.id] = { label: theme.label };
        }
        setDrafts(nextDrafts);
        setError(null);
      })
      .catch(() => setError("Could not load themes"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  const persistTheme = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    const label = draft.label.trim();
    if (!label) {
      setError("Theme name is required");
      return;
    }
    try {
      const updated = await updateUserTheme(id, label);
      setThemes((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setDrafts((prev) => ({
        ...prev,
        [id]: { label: updated.label },
      }));
      setError(null);
      onThemesChange?.();
    } catch {
      setError("Could not save theme");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUserTheme(id);
      setThemes((prev) => prev.filter((t) => t.id !== id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setError(null);
      onThemesChange?.();
    } catch {
      setError("Could not delete theme");
    }
  };

  const handleAdd = async () => {
    if (themes.length >= MAX_USER_THEMES || adding) return;
    setAdding(true);
    try {
      const created = await createUserTheme("New theme");
      setThemes((prev) => [...prev, created]);
      setDrafts((prev) => ({
        ...prev,
        [created.id]: { label: created.label },
      }));
      setError(null);
      onThemesChange?.();
    } catch {
      setError("Could not add theme");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return <p className="chinotto-card-theme-status">Loading themes…</p>;
  }

  return (
    <div className="chinotto-card-theme-editor">
      <p className="chinotto-card-theme-hint">
        Assign in entry detail. {themes.length}/{MAX_USER_THEMES} themes.
      </p>
      {error ? (
        <p className="chinotto-card-theme-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="chinotto-card-theme-list">
        {themes.map((theme) => {
          const draft = drafts[theme.id];
          if (!draft) return null;
          return (
            <li key={theme.id} className="chinotto-card-theme-row">
              <div className="chinotto-card-theme-fields">
                <input
                  type="text"
                  className="chinotto-card-theme-input chinotto-card-theme-input--label"
                  aria-label={`Theme name for ${theme.label}`}
                  value={draft.label}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [theme.id]: { label: e.target.value },
                    }))
                  }
                  onBlur={() => void persistTheme(theme.id)}
                />
                <button
                  type="button"
                  className="chinotto-card-theme-delete"
                  aria-label={`Delete ${theme.label}`}
                  onClick={() => void handleDelete(theme.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="chinotto-card-theme-add"
        disabled={themes.length >= MAX_USER_THEMES || adding}
        onClick={() => void handleAdd()}
      >
        {themes.length >= MAX_USER_THEMES
          ? `Maximum ${MAX_USER_THEMES} themes`
          : adding
            ? "Adding…"
            : "Add theme"}
      </button>
    </div>
  );
}
