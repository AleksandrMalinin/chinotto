import { useCallback, useEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ChinottoLogo } from "@/components/ChinottoLogo";
import { createEntry, generateEmbedding, getEntry } from "@/features/entries/entryApi";
import {
  SPACE_SCOPE_STORAGE_KEY,
  captureSpaceId,
  parseStoredSpaceScope,
} from "@/lib/spaceScope";
import { pushEntryUpsertToFirestore } from "@/lib/desktopFirestoreSync";
import { isFirebaseSyncConfigured } from "@/lib/firebaseConfig";
import { getDevSimulateNewUser } from "@/lib/devSimulateNewUser";
import { track } from "@/lib/analytics";
import { setHasEverSavedThought } from "@/lib/streamOnboarding";
import { applyStoredUiZoom } from "@/lib/uiZoom";

/** Fully transparent host; rounded chrome is only the HTML card (no native popover material). */
const TRAY_CAPTURE_CHROME_RGBA: [number, number, number, number] = [0, 0, 0, 0];

/** After tray `show`/`set_focus`, macOS can deliver a spurious blur before focus settles; hide only after this delay and a fresh `isFocused()` check. */
const BLUR_HIDE_MS = 280;

function formatSubmitError(e: unknown): string {
  const msg =
    typeof e === "string"
      ? e
      : e instanceof Error
        ? e.message
        : String(e);
  if (/not allowed on window|not allowed on webview|invoke/i.test(msg)) {
    return "Couldn’t save from the menu bar. Rebuild the app with the latest version.";
  }
  if (msg.length > 200) {
    return `${msg.slice(0, 200)}…`;
  }
  return msg;
}

/**
 * Single-field capture for the menu bar popover window only.
 * Enter saves and closes; Esc closes without saving; focus loss hides the window.
 * Uses a one-line `input` inside a `form` so WebKit/Tauri delivers Enter as `submit` reliably (textarea + React `onKeyDown` is flaky in the tray webview).
 */
export function TrayCapturePanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hidePopover = useCallback(() => {
    void getCurrentWindow().hide();
  }, []);

  useEffect(() => {
    void applyStoredUiZoom();
    document.documentElement.classList.add("tray-capture-page");
    const win = getCurrentWindow();
    const wv = WebviewWindow.getCurrent();
    void win.setShadow(false).catch(() => {});
    void win.clearEffects().catch(() => {});
    void win.setBackgroundColor(TRAY_CAPTURE_CHROME_RGBA).catch(() => {});
    void wv.setBackgroundColor(TRAY_CAPTURE_CHROME_RGBA).catch(() => {});
    return () => {
      document.documentElement.classList.remove("tray-capture-page");
    };
  }, []);

  const openMainChinotto = useCallback(async () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    const pop = getCurrentWindow();
    await pop.hide().catch(() => {});
    const main = await WebviewWindow.getByLabel("main");
    if (!main) return;
    await main.unminimize().catch(() => {});
    await main.show().catch(() => {});
    await main.setFocus().catch(() => {});
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    void appWindow.onFocusChanged(({ payload: focused }) => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (focused) {
        const el = inputRef.current;
        if (el) {
          el.value = "";
          setSubmitError(null);
          el.focus();
        }
        return;
      }
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        void (async () => {
          const stillFocused = await appWindow.isFocused().catch(() => true);
          if (!stillFocused) void appWindow.hide();
        })();
      }, BLUR_HIDE_MS);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      unlisten?.();
    };
  }, []);

  const saveEntry = useCallback(async (text: string) => {
    if (getDevSimulateNewUser()) return;

    let id: string;
    try {
      const scope = parseStoredSpaceScope(
        typeof localStorage !== "undefined"
          ? localStorage.getItem(SPACE_SCOPE_STORAGE_KEY)
          : null
      );
      const cap = captureSpaceId(scope);
      try {
        id = await createEntry(text, cap ? { spaceId: cap } : undefined);
      } catch (e) {
        const msg =
          typeof e === "string"
            ? e
            : e instanceof Error
              ? e.message
              : String(e);
        if (cap != null && /unknown space/i.test(msg)) {
          id = await createEntry(text);
        } else {
          throw e;
        }
      }
    } catch (e) {
      setSubmitError(formatSubmitError(e));
      return;
    }

    setSubmitError(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
    hidePopover();

    try {
      await emit("chinotto-tray-entry-saved", { id });
    } catch {
      /* Main window may miss one refresh; entry is already persisted. */
    }

    try {
      if (isFirebaseSyncConfigured()) {
        void getEntry(id).then((row) => {
          if (row) void pushEntryUpsertToFirestore(row);
        });
      }
      track({ event: "entry_created", text_length: text.length });
      setHasEverSavedThought();
      generateEmbedding(id);
    } catch {
      /* Non-fatal after save. */
    }
  }, [hidePopover]);

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = inputRef.current?.value.trim() ?? "";
    if (!raw) return;
    void saveEntry(raw);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Escape") return;
    e.preventDefault();
    hidePopover();
  }

  return (
    <div className="tray-capture-panel">
      <form className="tray-capture-panel__row" onSubmit={handleFormSubmit}>
        <input
          ref={inputRef}
          type="text"
          enterKeyHint="done"
          autoComplete="off"
          className="tray-capture-field !min-h-0 !border-0 !border-b-0 !py-1 !text-[14px] !leading-normal !shadow-none focus-visible:!border-0 focus-visible:!shadow-none"
          placeholder="Capture a thought..."
          aria-label="Capture a thought"
          aria-invalid={submitError ? true : undefined}
          aria-describedby={submitError ? "tray-capture-error" : undefined}
          onKeyDown={handleKeyDown}
          onChange={() => submitError && setSubmitError(null)}
        />
        <button
          type="button"
          className="tray-capture-open-main"
          aria-label="Open Chinotto"
          onClick={() => void openMainChinotto()}
        >
          <ChinottoLogo size={18} className="tray-capture-open-main__icon" />
        </button>
      </form>
      {submitError ? (
        <p id="tray-capture-error" className="tray-capture-error" role="alert">
          {submitError}
        </p>
      ) : null}
    </div>
  );
}
