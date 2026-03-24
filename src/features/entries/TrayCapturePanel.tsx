import { useCallback, useEffect, useRef } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ChinottoLogo } from "@/components/ChinottoLogo";
import { Textarea } from "@/components/ui/textarea";
import { createEntry, generateEmbedding } from "@/features/entries/entryApi";
import { getDevSimulateNewUser } from "@/lib/devSimulateNewUser";
import { track } from "@/lib/analytics";
import { setHasEverSavedThought } from "@/lib/streamOnboarding";

/** Fully transparent host; rounded chrome is only the HTML card (no native popover material). */
const TRAY_CAPTURE_CHROME_RGBA: [number, number, number, number] = [0, 0, 0, 0];

/**
 * Single-field capture for the menu bar popover window only.
 * Enter saves and closes; Esc closes without saving; focus loss hides the window.
 */
export function TrayCapturePanel() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hidePopover = useCallback(() => {
    void getCurrentWindow().hide();
  }, []);

  useEffect(() => {
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
          el.focus();
        }
        return;
      }
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        void appWindow.hide();
      }, 120);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      unlisten?.();
    };
  }, []);

  async function submit(text: string) {
    if (getDevSimulateNewUser()) return;
    try {
      const id = await createEntry(text);
      track({ event: "entry_created", text_length: text.length });
      setHasEverSavedThought();
      generateEmbedding(id);
      await emit("chinotto-tray-entry-saved", { id });
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      hidePopover();
    } catch {
      /* Keep popover open so the user can fix or retry. */
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      hidePopover();
      return;
    }
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const raw = (e.target as HTMLTextAreaElement).value.trim();
    if (!raw) return;
    void submit(raw);
  }

  return (
    <div className="tray-capture-panel">
      <div className="tray-capture-panel__row">
        <Textarea
          ref={inputRef}
          className="tray-capture-field !min-h-0 !border-0 !border-b-0 !py-1 !text-[14px] !leading-normal !shadow-none focus-visible:!border-0 focus-visible:!shadow-none"
          placeholder="Capture a thought..."
          rows={1}
          aria-label="Capture a thought"
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="tray-capture-open-main"
          aria-label="Open Chinotto"
          onClick={() => void openMainChinotto()}
        >
          <ChinottoLogo size={18} className="tray-capture-open-main__icon" />
        </button>
      </div>
    </div>
  );
}
