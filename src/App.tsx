import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { IntroScreen } from "@/components/IntroScreen";
import { LogoTransition } from "@/components/LogoTransition";
import { ChinottoLogo } from "@/components/ChinottoLogo";
import { ChinottoCard } from "@/components/ChinottoCard";
import { StreamShowcaseModal } from "@/components/StreamShowcaseModal";
import { AnalyticsOptInModal } from "@/components/AnalyticsOptInModal";
import { EntryInput, type EntryInputRef } from "./features/entries/EntryInput";
import { EntryStream } from "./features/entries/EntryStream";
import { EntryDetail } from "./features/entries/EntryDetail";
import { ResurfacedOverlay } from "./features/entries/ResurfacedOverlay";
import { VoiceCaptureOverlay } from "./features/entries/VoiceCaptureOverlay";
import { SearchInput } from "./features/entries/SearchInput";
import { SearchResultsList } from "./features/entries/SearchResultsList";
import { getSearchFeedback } from "./features/entries/searchOverlayFeedback";
import { Button } from "@/components/ui/button";
import {
  createEntry,
  restoreEntry,
  updateEntry,
  listEntries,
  searchEntries,
  jumpAnchorForLocalDate,
  generateEmbedding,
  getResurfacedEntry,
  getPinnedEntryIds,
  pinEntry,
  unpinEntry,
  recordEntryOpen,
  deleteAllEntries,
  deleteEntry,
} from "./features/entries/entryApi";
import {
  JumpToDatePopover,
  JumpToDateTriggerIcon,
} from "./features/entries/JumpToDatePopover";
import type { Entry } from "./types/entry";
import { getStoredIconVariantId } from "@/lib/iconVariants";
import { setDesktopIcon } from "@/lib/setDesktopIcon";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import {
  ask as dialogAsk,
  message as dialogMessage,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  getIdsInCooldown,
  markAsShown,
  mayAttemptResurface,
} from "@/lib/resurfaceSession";
import { getAnalyticsPromptShown, track } from "@/lib/analytics";
import {
  getDevSimulateNewUser,
  setDevSimulateNewUser,
} from "@/lib/devSimulateNewUser";
import { useAppUpdater } from "@/lib/appUpdater";
import {
  hasEverSavedThought,
  setHasEverSavedThought,
} from "@/lib/streamOnboarding";
import {
  hasEntriesAfterFullListLoad,
  resolveHasEntriesInDbAfterDeletion,
  shouldShowSearchTrigger,
} from "@/lib/entryCatalogPresence";
import { UpdateNudge } from "@/components/UpdateNudge";
import { scrollJumpSectionIntoView } from "@/lib/scrollJumpSectionIntoView";
import { useJumpContextAutoClear } from "@/lib/useJumpContextAutoClear";
import { APP_VERSION } from "@/lib/appVersion";
import { ENTER_KEY_GLYPH } from "@/lib/keyboardLabels";

/** Voice capture is disabled in the main flow. Set to true to re-enable as an experimental feature. */
const EXPERIMENTAL_VOICE_CAPTURE = false;

const RESURFACE_SHOW_PROBABILITY = 0.65;
const FEEDBACK_EMAIL = "hello@chinotto.app";
/** Tiny offset after intro→main handoff so empty onboarding stagger reads clearly. */
const EMPTY_ONBOARDING_POST_INTRO_DELAY_MS = 750;
const JUMP_CONTEXT_EXPANDED_MS = 3000;

function isTypingInInput(): boolean {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

function loadEntries(query: string): Promise<Entry[]> {
  return query.trim() ? searchEntries(query) : listEntries();
}

function formatJumpContextLabel(ymd: string): string {
  const p = ymd.split("-").map(Number);
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return ymd;
  const [y, m, d] = p;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function toLocalYmd(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Dev-only: mock resurfaced entry so the overlay can be previewed when backend returns nothing */
function devMockResurfaced(): { entry: Entry; reason: string } {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return {
    entry: {
      id: "dev-mock-resurfaced",
      text: `This is a sample thought from the past. Click the card to open it, or press ${ENTER_KEY_GLYPH} / Esc to continue to the main screen.`,
      created_at: d.toISOString(),
    },
    reason: "From 3 days ago.",
  };
}

export default function App() {
  const appUpdater = useAppUpdater();
  const [introDismissed, setIntroDismissed] = useState(false);
  const [introTransitioning, setIntroTransitioning] = useState(false);
  const [emptyOnboardingIntroDelayReady, setEmptyOnboardingIntroDelayReady] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  /** True after a full list load (no search query); used so the ⌘K control stays hidden while FTS results are empty. */
  const [hasEntriesInDb, setHasEntriesInDb] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [jumpPopoverOpen, setJumpPopoverOpen] = useState(false);
  const [jumpContextYmd, setJumpContextYmd] = useState<string | null>(null);
  const [jumpContextExpanded, setJumpContextExpanded] = useState(false);
  const [isChinottoCardOpen, setIsChinottoCardOpen] = useState(false);
  const [isStreamShowcaseOpen, setIsStreamShowcaseOpen] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [, setIntroSettled] = useState(false);
  const [iconVariantId, setIconVariantId] = useState(() => getStoredIconVariantId());
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [resurfaced, setResurfaced] = useState<{
    entry: Entry;
    reason: string;
  } | null>(null);
  const [voiceCaptureOpen, setVoiceCaptureOpen] = useState(false);
  const [voiceCaptureMode, setVoiceCaptureMode] = useState<"shortcut" | "hold">("shortcut");
  const voiceHoldReleasedBeforeMountRef = useRef(false);
  const [justAddedEntryId, setJustAddedEntryId] = useState<string | null>(null);
  const [ephemeralEntryIds, setEphemeralEntryIds] = useState<Set<string>>(new Set());
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [settlingEntryIds, setSettlingEntryIds] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  /** After first save we show a softer empty state when the stream is empty again. */
  const [hasEverSaved, setHasEverSavedState] = useState(() => hasEverSavedThought());
  /** Progressive onboarding: hidden after first keystroke/save until stream was non-empty then empty again. */
  const [emptyOnboardingDismissed, setEmptyOnboardingDismissed] = useState(false);
  const [emptyOnboardingExiting, setEmptyOnboardingExiting] = useState(false);
  const [emptyOnboardingTypingAccent, setEmptyOnboardingTypingAccent] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [lastDeletedEntry, setLastDeletedEntry] = useState<{
    entry: Entry;
    wasPinned: boolean;
  } | null>(null);
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const jumpToDateButtonRef = useRef<HTMLButtonElement>(null);
  const entryInputRef = useRef<EntryInputRef>(null);
  const devDeleteAllThoughtsRef = useRef<(() => Promise<void>) | null>(null);
  const headerLogoRef = useRef<HTMLButtonElement>(null);
  const shownThisSessionRef = useRef(false);
  const triedResurfaceOnOpenRef = useRef(false);
  const justAddedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ephemeralTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prevStreamLenRef = useRef(0);
  const emptyOnboardingExitStartedRef = useRef(false);
  const [logoEndRect, setLogoEndRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const handleSendFeedback = useCallback(() => {
    const subject = "Chinotto feedback";
    const body = [
      "Just write freely — even a rough thought helps.",
      "",
      "What were you trying to do?",
      "",
      "What felt off?",
      "",
      "What did you expect?",
      "",
      "Anything else?",
    ].join("\n");
    const mailtoUrl = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    openUrl(mailtoUrl).catch(() => {
      window.location.href = mailtoUrl;
    });
  }, []);

  const refresh = useCallback(async (query: string) => {
    if (getDevSimulateNewUser()) {
      setEntries([]);
      setPinnedIds([]);
      setHasEntriesInDb(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await loadEntries(query);
      setEntries(list);
      if (!query.trim()) {
        setHasEntriesInDb(hasEntriesAfterFullListLoad(list.length));
        const ids = await getPinnedEntryIds();
        setPinnedIds(ids);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      refresh("");
      return;
    }
    const t = setTimeout(() => refresh(search), 120);
    return () => clearTimeout(t);
  }, [search, refresh]);

  const { pinnedEntries, streamEntries } = useMemo(() => {
    const pinnedEntries = pinnedIds
      .map((id) => entries.find((e) => e.id === id))
      .filter((e): e is Entry => e != null);
    const streamEntries = entries.filter((e) => !pinnedIds.includes(e.id));
    return { pinnedEntries, streamEntries };
  }, [entries, pinnedIds]);

  const showSearchTrigger = useMemo(
    () =>
      shouldShowSearchTrigger({
        searchQueryActive: search.trim() !== "",
        entriesLength: entries.length,
        hasEntriesInDb,
      }),
    [search, entries.length, hasEntriesInDb]
  );

  const canJumpByDate = useMemo(() => {
    const dayKeys = new Set<string>();
    for (const entry of entries) {
      dayKeys.add(toLocalYmd(entry.created_at));
      if (dayKeys.size >= 2) return true;
    }
    return false;
  }, [entries]);

  const showJumpTrigger = useMemo(
    () =>
      introDismissed &&
      !loading &&
      !selectedEntry &&
      !search.trim() &&
      !isSearchOpen &&
      showSearchTrigger &&
      canJumpByDate,
    [
      introDismissed,
      loading,
      selectedEntry,
      search,
      isSearchOpen,
      showSearchTrigger,
      canJumpByDate,
    ]
  );

  useEffect(() => {
    if (!hasEntriesInDb) setIsStreamShowcaseOpen(false);
  }, [hasEntriesInDb]);

  useEffect(() => {
    if (!showJumpTrigger) setJumpPopoverOpen(false);
  }, [showJumpTrigger]);

  useEffect(() => {
    if (!jumpContextYmd || !jumpContextExpanded) return;
    const t = window.setTimeout(() => {
      setJumpContextExpanded(false);
    }, JUMP_CONTEXT_EXPANDED_MS);
    return () => clearTimeout(t);
  }, [jumpContextYmd, jumpContextExpanded]);

  const clearJumpContext = useCallback(() => {
    setJumpContextYmd(null);
    setJumpContextExpanded(false);
  }, []);

  useJumpContextAutoClear({
    jumpContextYmd,
    clearJumpContext,
    isSearchOpen,
    selectedEntry,
  });

  useEffect(() => {
    const len = streamEntries.length;
    const prev = prevStreamLenRef.current;
    if (prev > 0 && len === 0) {
      setEmptyOnboardingDismissed(false);
      emptyOnboardingExitStartedRef.current = false;
    }
    prevStreamLenRef.current = len;
  }, [streamEntries.length]);

  const onEmptyOnboardingExitComplete = useCallback(() => {
    setEmptyOnboardingDismissed(true);
    setEmptyOnboardingExiting(false);
    setEmptyOnboardingTypingAccent(false);
  }, []);

  const tryBeginEmptyOnboardingExit = useCallback(() => {
    if (emptyOnboardingExitStartedRef.current) return;
    if (streamEntries.length > 0) return;
    emptyOnboardingExitStartedRef.current = true;
    setEmptyOnboardingExiting(true);
    setEmptyOnboardingTypingAccent(true);
  }, [streamEntries.length]);

  const onCaptureDraftChange = useCallback(
    (value: string) => {
      if (streamEntries.length === 0 && value.trim().length === 0) {
        setEmptyOnboardingDismissed(false);
        setEmptyOnboardingExiting(false);
        setEmptyOnboardingTypingAccent(false);
        emptyOnboardingExitStartedRef.current = false;
        return;
      }
      if (value.length > 0) tryBeginEmptyOnboardingExit();
    },
    [tryBeginEmptyOnboardingExit, streamEntries.length]
  );

  useEffect(() => {
    if (search.trim()) {
      setSearchSelectedIndex(0);
    }
  }, [search]);

  useEffect(() => {
    if (entries.length > 0) {
      setSearchSelectedIndex((i) => (i >= entries.length ? entries.length - 1 : i));
    }
  }, [entries]);

  useEffect(() => {
    if (!introDismissed) {
      document.documentElement.classList.add("intro-open");
      document.body.classList.add("intro-open");
    } else {
      document.documentElement.classList.remove("intro-open");
      document.body.classList.remove("intro-open");
    }
    return () => {
      document.documentElement.classList.remove("intro-open");
      document.body.classList.remove("intro-open");
    };
  }, [introDismissed]);

  useEffect(() => {
    if (introDismissed) {
      setEmptyOnboardingIntroDelayReady(true);
      return;
    }
    if (!introTransitioning) {
      setEmptyOnboardingIntroDelayReady(false);
      return;
    }
    setEmptyOnboardingIntroDelayReady(false);
    const id = window.setTimeout(() => {
      setEmptyOnboardingIntroDelayReady(true);
    }, EMPTY_ONBOARDING_POST_INTRO_DELAY_MS);
    return () => clearTimeout(id);
  }, [introDismissed, introTransitioning]);

  useEffect(() => {
    if (isChinottoCardOpen) {
      document.documentElement.classList.add("chinotto-card-open");
      document.body.classList.add("chinotto-card-open");
    } else {
      document.documentElement.classList.remove("chinotto-card-open");
      document.body.classList.remove("chinotto-card-open");
    }
    return () => {
      document.documentElement.classList.remove("chinotto-card-open");
      document.body.classList.remove("chinotto-card-open");
    };
  }, [isChinottoCardOpen]);

  useEffect(() => {
    setDesktopIcon(getStoredIconVariantId()).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sep = () => PredefinedMenuItem.new({ item: "Separator" });
      const about = await PredefinedMenuItem.new({
        item: { About: { name: "Chinotto", version: APP_VERSION } },
      });
      const hide = await PredefinedMenuItem.new({ item: "Hide" });
      const hideOthers = await PredefinedMenuItem.new({ item: "HideOthers" });
      const showAll = await PredefinedMenuItem.new({ item: "ShowAll" });
      const quit = await PredefinedMenuItem.new({ item: "Quit" });
      const chinottoSubmenu = await Submenu.new({
        text: "Chinotto",
        items: [
          about,
          await sep(),
          hide,
          hideOthers,
          showAll,
          await sep(),
          quit,
        ],
      });

      const exportItem = await MenuItem.new({
        id: "export_entries",
        text: "Export Entries…",
        action: async () => {
          const path = await saveDialog({
            defaultPath: "chinotto-export.zip",
            filters: [{ name: "ZIP", extensions: ["zip"] }],
          });
          if (path == null) return;
          try {
            await invoke("export_entries", { path });
            await dialogMessage("Export completed successfully.");
          } catch (e) {
            await dialogMessage(String(e), { kind: "error" });
          }
        },
      });
      const backupItem = await MenuItem.new({
        id: "backup_now",
        text: "Backup Now",
        action: async () => {
          try {
            await invoke("create_backup");
            await dialogMessage("Backup completed successfully.");
          } catch (e) {
            await dialogMessage(String(e), { kind: "error" });
          }
        },
      });
      const fileSubmenu = await Submenu.new({
        text: "File",
        items: [exportItem, backupItem],
      });

      const undo = await PredefinedMenuItem.new({ item: "Undo" });
      const redo = await PredefinedMenuItem.new({ item: "Redo" });
      const cut = await PredefinedMenuItem.new({ item: "Cut" });
      const copy = await PredefinedMenuItem.new({ item: "Copy" });
      const paste = await PredefinedMenuItem.new({ item: "Paste" });
      const selectAll = await PredefinedMenuItem.new({ item: "SelectAll" });
      const editSubmenu = await Submenu.new({
        text: "Edit",
        items: [undo, redo, await sep(), cut, copy, paste, await sep(), selectAll],
      });

      const menuItems = [chinottoSubmenu, fileSubmenu, editSubmenu];
      if (import.meta.env.DEV) {
        const simNewUserItem = await MenuItem.new({
          id: "dev_simulate_new_user",
          text: getDevSimulateNewUser()
            ? "Stop Simulating New User"
            : "Simulate New User",
          action: () => {
            setDevSimulateNewUser(!getDevSimulateNewUser());
            window.location.reload();
          },
        });
        const devMenuItems = [simNewUserItem];
        if (entries.length > 0) {
          devMenuItems.push(
            await MenuItem.new({
              id: "dev_delete_all_thoughts",
              text: "Delete All Thoughts…",
              action: () => {
                void devDeleteAllThoughtsRef.current?.();
              },
            })
          );
        }
        const developerSubmenu = await Submenu.new({
          text: "Developer",
          items: devMenuItems,
        });
        menuItems.push(developerSubmenu);
      }
      const menu = await Menu.new({ items: menuItems });
      if (!cancelled) await menu.setAsAppMenu();
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entries.length]);

  useEffect(() => {
    invoke("create_backup_if_needed").catch(() => {});
  }, []);

  useEffect(() => {
    if (!introDismissed) return;
    if (getAnalyticsPromptShown()) {
      setIntroSettled(true);
      return;
    }
    const t = setTimeout(() => {
      setIntroSettled(true);
      setShowAnalyticsModal(true);
    }, 600);
    return () => clearTimeout(t);
  }, [introDismissed]);

  /* Focus capture input when main screen appears so first-run user can type immediately. */
  useEffect(() => {
    if (!introDismissed) return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) entryInputRef.current?.focus();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [introDismissed]);

  useEffect(() => {
    if (!EXPERIMENTAL_VOICE_CAPTURE) return;
    const unlistenShortcut = listen("chinotto-voice-shortcut", () => {
      setVoiceCaptureMode("shortcut");
      setVoiceCaptureOpen(true);
    });
    const unlistenHoldStart = listen("chinotto-voice-hold-start", () => {
      voiceHoldReleasedBeforeMountRef.current = false;
      setVoiceCaptureMode("hold");
      setVoiceCaptureOpen(true);
    });
    const unlistenHoldStop = listen("chinotto-voice-hold-stop", () => {
      voiceHoldReleasedBeforeMountRef.current = true;
    });
    return () => {
      unlistenShortcut.then((u) => u());
      unlistenHoldStart.then((u) => u());
      unlistenHoldStop.then((u) => u());
    };
  }, []);

  useEffect(() => {
    const unlistenCapture = listen("chinotto-capture-shortcut", () => {
      if (isTypingInInput()) return;
      if (selectedEntry) setSelectedEntry(null);
      if (isSearchOpen) {
        setIsSearchOpen(false);
        setSearch("");
      }
      if (jumpPopoverOpen) setJumpPopoverOpen(false);
      if (isChinottoCardOpen) setIsChinottoCardOpen(false);
      clearJumpContext();
      requestAnimationFrame(() => {
        entryInputRef.current?.focus();
      });
    });
    return () => {
      unlistenCapture.then((u) => u());
    };
  }, [
    selectedEntry,
    isSearchOpen,
    jumpPopoverOpen,
    isChinottoCardOpen,
    clearJumpContext,
  ]);

  useEffect(() => {
    const unlistenTraySave = listen("chinotto-tray-entry-saved", () => {
      void refresh(search);
    });
    return () => {
      unlistenTraySave.then((u) => u());
    };
  }, [search, refresh]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      function onKeyDown(e: KeyboardEvent) {
        if (isTypingInInput()) return;
        if ((e.metaKey || e.ctrlKey) && e.key === "r") {
          e.preventDefault();
          window.location.reload();
        }
        /* Force-show resurfaced overlay for testing: Ctrl+Shift+R (Cmd+Shift+R on Mac) */
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "R") {
          e.preventDefault();
          getResurfacedEntry(getIdsInCooldown()).then((r) => {
            if (r) setResurfaced(r);
          });
        }
      }
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, []);

  const resurfaceInFlightRef = useRef(false);
  const tryResurface = useCallback(() => {
    if (shownThisSessionRef.current || resurfaceInFlightRef.current) return;
    resurfaceInFlightRef.current = true;
    const excludeIds = getIdsInCooldown();
    getResurfacedEntry(excludeIds)
      .then((r) => {
        if (!r) return;
        if (Math.random() > RESURFACE_SHOW_PROBABILITY) return;
        shownThisSessionRef.current = true;
        markAsShown(r.entry.id);
        setResurfaced(r);
        const ageDays = Math.floor(
          (Date.now() - new Date(r.entry.created_at).getTime()) / (24 * 60 * 60 * 1000)
        );
        track({ event: "resurface_shown", age_days: ageDays });
      })
      .finally(() => {
        resurfaceInFlightRef.current = false;
      });
  }, []);

  useEffect(() => {
    if (
      !mayAttemptResurface({
        introDismissed,
        selectedEntry,
        loading,
        searchTrimmed: search.trim() === "",
        isSearchOpen,
        editingEntryId,
        triedResurface: triedResurfaceOnOpenRef.current,
      })
    ) {
      return;
    }
    const id = window.setTimeout(() => {
      triedResurfaceOnOpenRef.current = true;
      tryResurface();
    }, 600);
    return () => clearTimeout(id);
  }, [
    introDismissed,
    selectedEntry,
    loading,
    search,
    isSearchOpen,
    editingEntryId,
    tryResurface,
  ]);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingInInput()) return;
      if (e.key === "Escape") {
        if (jumpPopoverOpen) {
          setJumpPopoverOpen(false);
          e.preventDefault();
          return;
        }
        if (selectedEntry) {
          setSelectedEntry(null);
          e.preventDefault();
        }
        return;
      }
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setJumpPopoverOpen(false);
        setIsSearchOpen(true);
      }
      if (
        showJumpTrigger &&
        e.key.toLowerCase() === "j" &&
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey
      ) {
        e.preventDefault();
        setJumpPopoverOpen((o) => !o);
      }
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (selectedEntry) setSelectedEntry(null);
        if (isSearchOpen) setIsSearchOpen(false);
        entryInputRef.current?.focus();
      }
      if (EXPERIMENTAL_VOICE_CAPTURE && (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        setVoiceCaptureMode("shortcut");
        setVoiceCaptureOpen(true);
      }
      if (EXPERIMENTAL_VOICE_CAPTURE && e.altKey && e.key === " " && !e.repeat && !voiceCaptureOpen) {
        e.preventDefault();
        voiceHoldReleasedBeforeMountRef.current = false;
        setVoiceCaptureMode("hold");
        setVoiceCaptureOpen(true);
        const handleHoldKeyUp = (e2: KeyboardEvent) => {
          if (e2.key !== " " && e2.key !== "Alt" && e2.key !== "Option") return;
          voiceHoldReleasedBeforeMountRef.current = true;
          window.removeEventListener("keyup", handleHoldKeyUp);
        };
        window.addEventListener("keyup", handleHoldKeyUp);
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    selectedEntry,
    voiceCaptureOpen,
    isSearchOpen,
    jumpPopoverOpen,
    showJumpTrigger,
  ]);

  const EPHEMERAL_WINDOW_MS = 15_000;
  const SETTLING_DURATION_MS = 200;

  async function handleSubmit(text: string) {
    if (getDevSimulateNewUser()) return;
    const id = await createEntry(text);
    track({ event: "entry_created", text_length: text.length });
    if (streamEntries.length === 0) tryBeginEmptyOnboardingExit();
    setHasEverSavedThought();
    setHasEverSavedState(true);
    if (entries.length === 0) {
      track({ event: "first_entry_created", text_length: text.length });
    }
    if (justAddedTimeoutRef.current) clearTimeout(justAddedTimeoutRef.current);
    setJustAddedEntryId(id);
    setEphemeralEntryIds((prev) => new Set(prev).add(id));
    const existing = ephemeralTimersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      ephemeralTimersRef.current.delete(id);
      setEphemeralEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSettlingEntryIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setSettlingEntryIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, SETTLING_DURATION_MS);
    }, EPHEMERAL_WINDOW_MS);
    ephemeralTimersRef.current.set(id, t);
    justAddedTimeoutRef.current = setTimeout(() => {
      setJustAddedEntryId(null);
      justAddedTimeoutRef.current = null;
    }, 400);
    refresh(search);
    generateEmbedding(id);
  }

  function handleSearchClose() {
    setIsSearchOpen(false);
    setSearch("");
    requestAnimationFrame(() => {
      entryInputRef.current?.focus();
    });
  }

  const handleJumpDatePick = useCallback(async (ymd: string) => {
    if (getDevSimulateNewUser()) return;
    const id = await jumpAnchorForLocalDate(ymd);
    if (!id) return;
    setJumpPopoverOpen(false);
    setJumpContextYmd(ymd);
    setJumpContextExpanded(true);
    const runScroll = () => {
      scrollJumpSectionIntoView(id);
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(runScroll);
    });
  }, []);

  const handleJumpBackToNow = useCallback(() => {
    clearJumpContext();
    requestAnimationFrame(() => {
      const scroller = document.scrollingElement;
      scroller?.scrollTo({ top: 0, behavior: "smooth" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [clearJumpContext]);

  const handleOpenEntry = useCallback((entry: Entry) => {
    track({ event: "entry_opened" });
    recordEntryOpen(entry.id);
    setSelectedEntry(entry);
  }, []);

  const refreshPinned = useCallback(() => {
    getPinnedEntryIds().then(setPinnedIds);
  }, []);

  const handlePin = useCallback(
    (entry: Entry) => {
      track({ event: "entry_pinned" });
      pinEntry(entry.id).then(refreshPinned);
    },
    [refreshPinned]
  );

  const handleUnpin = useCallback(
    (entry: Entry) => {
      unpinEntry(entry.id).then(refreshPinned);
    },
    [refreshPinned]
  );

  const handleEntryDelete = useCallback(
    (entry: Entry) => {
      track({ event: "entry_deleted" });
      setDeletingIds((prev) => new Set(prev).add(entry.id));
      setLastDeletedEntry({
        entry,
        wasPinned: pinnedIds.includes(entry.id),
      });
      if (selectedEntry?.id === entry.id) setSelectedEntry(null);
      deleteEntry(entry.id).catch(() => {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
        setLastDeletedEntry(null);
      });
    },
    [selectedEntry?.id, pinnedIds]
  );

  const handleDeleteAnimationEnd = useCallback((entryId: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== entryId);
      queueMicrotask(() => {
        void resolveHasEntriesInDbAfterDeletion({
          remainingInCurrentView: next.length,
          isDevSimulateNewUser: getDevSimulateNewUser(),
          listEntries,
        })
          .then(setHasEntriesInDb)
          .catch(() => {});
      });
      return next;
    });
    setPinnedIds((prev) => prev.filter((id) => id !== entryId));
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.delete(entryId);
      return next;
    });
  }, []);

  const handleEntryUpdate = useCallback(
    (entryId: string, text: string) => {
      const t = ephemeralTimersRef.current.get(entryId);
      if (t) {
        clearTimeout(t);
        ephemeralTimersRef.current.delete(entryId);
      }
      updateEntry(entryId, text).then(() => {
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, text } : e))
        );
        setSettlingEntryIds((prev) => new Set(prev).add(entryId));
        setEphemeralEntryIds((prev) => {
          const next = new Set(prev);
          next.delete(entryId);
          return next;
        });
        setEditingEntryId(null);
        setTimeout(() => {
          setSettlingEntryIds((prev) => {
            const next = new Set(prev);
            next.delete(entryId);
            return next;
          });
        }, 200);
      });
    },
    []
  );

  const handleStartLateEdit = useCallback((entry: Entry) => {
    setEditingEntryId(entry.id);
  }, []);

  const handleEndEdit = useCallback((entryId: string) => {
    const t = ephemeralTimersRef.current.get(entryId);
    if (t) {
      clearTimeout(t);
      ephemeralTimersRef.current.delete(entryId);
    }
    setSettlingEntryIds((prev) => new Set(prev).add(entryId));
    setEphemeralEntryIds((prev) => {
      const next = new Set(prev);
      next.delete(entryId);
      return next;
    });
    setEditingEntryId(null);
    setTimeout(() => {
      setSettlingEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }, 200);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingInInput()) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey && lastDeletedEntry) {
        e.preventDefault();
        const { entry, wasPinned } = lastDeletedEntry;
        restoreEntry(entry.id, entry.text, entry.created_at)
          .then((restoredId) => {
            if (wasPinned) return pinEntry(restoredId);
          })
          .then(() => {
            setLastDeletedEntry(null);
            refresh(search);
            refreshPinned();
          })
          .catch(() => {
            setLastDeletedEntry(null);
            refresh(search);
            refreshPinned();
          });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lastDeletedEntry, refresh, search, refreshPinned]);

  /* Cmd+Backspace: delete hovered entry (row only gets keydown when focused, so use global + hover) */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingInInput()) return;
      if (!(e.metaKey || e.ctrlKey) || e.key !== "Backspace") return;
      if (!hoveredEntryId) return;
      const entry = entries.find((e) => e.id === hoveredEntryId);
      if (entry) {
        e.preventDefault();
        handleEntryDelete(entry);
        setHoveredEntryId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoveredEntryId, entries, handleEntryDelete]);

  /* Cmd+P: pin hovered entry (matches shortcut list in Chinotto Card) */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingInInput()) return;
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "p") return;
      if (!hoveredEntryId) return;
      if (pinnedIds.includes(hoveredEntryId)) return; /* already pinned */
      const entry = entries.find((e) => e.id === hoveredEntryId);
      if (entry) {
        e.preventDefault();
        handlePin(entry);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoveredEntryId, entries, pinnedIds, handlePin]);

  /* Cmd+E: edit hovered/focused entry (ephemeral edit escape hatch) */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingInInput()) return;
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "e") return;
      if (!hoveredEntryId) return;
      const entry = entries.find((ent) => ent.id === hoveredEntryId);
      if (entry) {
        e.preventDefault();
        handleStartLateEdit(entry);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoveredEntryId, entries, handleStartLateEdit]);

  /* Clean up ephemeral timers on unmount */
  useEffect(() => {
    return () => {
      ephemeralTimersRef.current.forEach((t) => clearTimeout(t));
      ephemeralTimersRef.current.clear();
    };
  }, []);

  const handleLogoTransitionEnd = useCallback(() => {
    setIntroDismissed(true);
    setIntroTransitioning(false);
    setLogoEndRect(null);
  }, []);

  const handleDevPreviewResurface = useCallback(() => {
    getResurfacedEntry().then((r) => {
      const res = r ?? (import.meta.env.DEV ? devMockResurfaced() : null);
      if (res) {
        setResurfaced(res);
        const ageDays = Math.floor(
          (Date.now() - new Date(res.entry.created_at).getTime()) / (24 * 60 * 60 * 1000)
        );
        track({ event: "resurface_shown", age_days: ageDays });
      }
    });
  }, []);

  const handleDevDeleteAllThoughts = useCallback(async () => {
    if (!import.meta.env.DEV) return;
    const ok = await dialogAsk(
      "Delete every thought from this Mac? This cannot be undone.",
      {
        title: "Delete all (debug)",
        kind: "warning",
        okLabel: "Delete all",
      }
    );
    if (!ok) return;
    try {
      await deleteAllEntries();
      setSelectedEntry(null);
      setResurfaced(null);
      setEditingEntryId(null);
      setDeletingIds(new Set());
      setLastDeletedEntry(null);
      setJustAddedEntryId(null);
      setEphemeralEntryIds(new Set());
      setSettlingEntryIds(new Set());
      setHoveredEntryId(null);
      setSearch("");
      setIsSearchOpen(false);
      await refresh("");
    } catch (e) {
      void dialogMessage(String(e), { kind: "error", title: "Chinotto" });
    }
  }, [refresh]);

  devDeleteAllThoughtsRef.current = handleDevDeleteAllThoughts;

  const handleIntroDismissRequest = useCallback(() => {
    setIntroTransitioning(true);
    const rect = headerLogoRef.current?.getBoundingClientRect();
    if (rect) {
      setLogoEndRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setTimeout(handleLogoTransitionEnd, 400);
    }
  }, [handleLogoTransitionEnd]);

  const mainAppClass = [
    "app-shell",
    !introDismissed && !introTransitioning && "main-app-behind",
    introTransitioning && "main-app-enter",
  ]
    .filter(Boolean)
    .join(" ");

  /** Empty onboarding runs with main handoff, not after logo lands; short delay accents stagger. */
  const emptyOnboardingIntroReady =
    introDismissed || (introTransitioning && emptyOnboardingIntroDelayReady);

  const canOpenStreamShowcase = introDismissed && hasEntriesInDb;

  return (
    <>
      <div className={mainAppClass}>
        <div className="app-bg" aria-hidden="true" />
        <div className="app">
          <header
            className={`app-header ${introDismissed ? "app-header-visible" : ""}`}
            aria-hidden={!introDismissed}
          >
            <div className="app-header-brand">
              <button
                ref={headerLogoRef}
                type="button"
                className="app-header-logo"
                onClick={() => {
                  if (introDismissed) {
                    track({ event: "settings_opened" });
                    setIsChinottoCardOpen(true);
                  }
                }}
                aria-label="About Chinotto"
                tabIndex={introDismissed ? 0 : -1}
              >
                <ChinottoLogo size={32} className="chinotto-logo" />
              </button>
              {canOpenStreamShowcase ? (
                <button
                  type="button"
                  className="app-header-name app-header-name-btn"
                  onClick={() => {
                    track({ event: "stream_showcase_opened" });
                    setIsStreamShowcaseOpen(true);
                  }}
                  aria-label="Preview welcome screen. Your timeline stays on the main screen."
                >
                  Chinotto <span className="app-header-beta" aria-hidden="true">β</span>
                </button>
              ) : (
                <span className="app-header-name">
                  Chinotto <span className="app-header-beta" aria-hidden="true">β</span>
                </span>
              )}
            </div>
            {import.meta.env.DEV && introDismissed && getDevSimulateNewUser() && (
              <span
                className="dev-simulate-banner text-xs text-[var(--muted)]"
                aria-live="polite"
              >
                Simulating new user — data intact
              </span>
            )}
            {import.meta.env.DEV && introDismissed && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="dev-preview-resurface text-[var(--muted)] hover:text-[var(--fg-dim)] text-xs"
                  onClick={handleDevPreviewResurface}
                  aria-label="Preview resurfaced overlay (dev)"
                >
                  Preview resurface
                </Button>
                {entries.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="dev-delete-all-thoughts text-[var(--muted)] hover:text-[var(--fg-dim)] text-xs"
                    onClick={() => void handleDevDeleteAllThoughts()}
                    aria-label="Delete all thoughts from database (dev)"
                  >
                    Delete all thoughts
                  </Button>
                ) : null}
              </>
            )}
          </header>
          {isSearchOpen && (
            <div
              className="search-overlay"
              role="dialog"
              aria-label="Search"
              onClick={(e) => e.target === e.currentTarget && handleSearchClose()}
            >
              <div className="search-center search-reveal">
                <SearchInput
                  ref={searchInputRef}
                  value={search}
                  onChange={setSearch}
                  onClose={handleSearchClose}
                  onEnter={() => {
                    if (search.trim() && entries.length > 0) {
                      track({ event: "search_used", result_count: entries.length });
                      const entry = entries[searchSelectedIndex] ?? entries[0];
                      handleOpenEntry(entry);
                    }
                    handleSearchClose();
                  }}
                  onArrowUp={
                    entries.length > 0
                      ? () =>
                          setSearchSelectedIndex((i) => Math.max(0, i - 1))
                      : undefined
                  }
                  onArrowDown={
                    entries.length > 0
                      ? () =>
                          setSearchSelectedIndex((i) =>
                            Math.min(entries.length - 1, i + 1)
                          )
                      : undefined
                  }
                />
                {search.trim() && (
                  <>
                    <p className="search-feedback" aria-live="polite">
                      {getSearchFeedback(entries)}
                    </p>
                    <SearchResultsList
                      entries={entries}
                      selectedIndex={searchSelectedIndex}
                      onSelectIndex={setSearchSelectedIndex}
                      onSelectEntry={(entry) => {
                        track({ event: "search_used", result_count: entries.length });
                        handleOpenEntry(entry);
                        handleSearchClose();
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          )}
          <div className="entry-input-row">
            <EntryInput
              ref={entryInputRef}
              onSubmit={handleSubmit}
              onDraftChange={onCaptureDraftChange}
            />
            <div
              className={`entry-input-row-aside ${showJumpTrigger ? "entry-input-row-aside--with-jump" : ""}`}
            >
              {showJumpTrigger ? (
                <Button
                  ref={jumpToDateButtonRef}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="jump-date-trigger"
                  onClick={() => setJumpPopoverOpen((o) => !o)}
                  aria-label="Jump to date (⌘⇧J)"
                  aria-expanded={jumpPopoverOpen && showJumpTrigger}
                >
                  <JumpToDateTriggerIcon />
                </Button>
              ) : null}
              {showSearchTrigger ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="search-trigger-inline text-[var(--muted)] hover:text-[var(--fg-dim)]"
                  onClick={() => {
                    setJumpPopoverOpen(false);
                    setIsSearchOpen(true);
                  }}
                  aria-label="Search (⌘K)"
                >
                  ⌘K
                </Button>
              ) : null}
            </div>
            <JumpToDatePopover
              open={jumpPopoverOpen && showJumpTrigger}
              anchorRef={jumpToDateButtonRef}
              contextYmd={jumpContextYmd}
              onClose={() => setJumpPopoverOpen(false)}
              onPickDate={(ymd) => {
                void handleJumpDatePick(ymd);
              }}
            />
          </div>
      {jumpContextYmd && !search.trim() && !selectedEntry ? (
        <div className="jump-date-context">
          {jumpContextExpanded ? (
            <span className="jump-date-context-label">
              {formatJumpContextLabel(jumpContextYmd)}
            </span>
          ) : null}
          <button
            type="button"
            className="jump-date-context-back"
            onClick={handleJumpBackToNow}
          >
            Back to now
          </button>
        </div>
      ) : null}
      {loading ? (
        <p className="stream-loading">Loading…</p>
      ) : selectedEntry ? (
        <EntryDetail
          entry={selectedEntry}
          onBack={() => {
          setSelectedEntry(null);
          requestAnimationFrame(() => entryInputRef.current?.focus());
        }}
          onSelectEntry={handleOpenEntry}
        />
      ) : (
        <>
          {!search.trim() && (
            <>
              {pinnedEntries.length > 0 && (
                <EntryStream
                  entries={pinnedEntries}
                  showHighlights={false}
                  justAddedEntryId={null}
                  ephemeralEntryIds={ephemeralEntryIds}
                  editingEntryId={editingEntryId}
                  settlingEntryIds={settlingEntryIds}
                  onEntryUpdate={handleEntryUpdate}
                  onStartLateEdit={handleStartLateEdit}
                  onEndEdit={handleEndEdit}
                  onEntryClick={handleOpenEntry}
                  sectionTitle="Pinned"
                  isPinnedSection
                  onPinToggle={handleUnpin}
                  onEntryDelete={handleEntryDelete}
                  deletingIds={deletingIds}
                  onDeleteAnimationEnd={handleDeleteAnimationEnd}
                  onEntryHover={(entry) => setHoveredEntryId(entry ? entry.id : null)}
                  deferEmptyPanelMotion={!emptyOnboardingIntroReady}
                  revealEmptyOnboarding={emptyOnboardingIntroReady}
                />
              )}
              {streamEntries.length > 0 || pinnedEntries.length === 0 ? (
                <EntryStream
                  entries={streamEntries}
                  showHighlights={false}
                  justAddedEntryId={justAddedEntryId}
                  ephemeralEntryIds={ephemeralEntryIds}
                  editingEntryId={editingEntryId}
                  settlingEntryIds={settlingEntryIds}
                  onEntryUpdate={handleEntryUpdate}
                  onStartLateEdit={handleStartLateEdit}
                  onEndEdit={handleEndEdit}
                  onEntryClick={handleOpenEntry}
                  onPinToggle={handlePin}
                  onEntryDelete={handleEntryDelete}
                  deletingIds={deletingIds}
                  onDeleteAnimationEnd={handleDeleteAnimationEnd}
                  onEntryHover={(entry) => setHoveredEntryId(entry ? entry.id : null)}
                  deferEmptyPanelMotion={!emptyOnboardingIntroReady}
                  revealEmptyOnboarding={emptyOnboardingIntroReady}
                  emptyOnboarding={
                    pinnedEntries.length === 0 && streamEntries.length === 0
                      ? emptyOnboardingDismissed
                        ? null
                        : {
                            variant: hasEverSaved ? "soft" : "full",
                            exiting: emptyOnboardingExiting,
                            typingAccent: emptyOnboardingTypingAccent,
                            onExitComplete: onEmptyOnboardingExitComplete,
                          }
                      : undefined
                  }
                />
              ) : null}
            </>
          )}
          {search.trim() && (
            <EntryStream
              entries={entries}
              showHighlights={true}
              justAddedEntryId={null}
              ephemeralEntryIds={new Set()}
              editingEntryId={null}
              settlingEntryIds={new Set()}
              onEntryClick={handleOpenEntry}
              onEntryDelete={handleEntryDelete}
              deletingIds={deletingIds}
              onDeleteAnimationEnd={handleDeleteAnimationEnd}
              onEntryHover={(entry) => setHoveredEntryId(entry ? entry.id : null)}
              deferEmptyPanelMotion={!emptyOnboardingIntroReady}
              revealEmptyOnboarding={emptyOnboardingIntroReady}
            />
          )}
        </>
      )}
        </div>
        <div className="app-studio-signature" aria-hidden="true">
          <span>Bogart Labs</span>
        </div>
        <button
          type="button"
          className="app-feedback-link"
          onClick={handleSendFeedback}
          aria-label="Send feedback by email"
        >
          Share feedback
        </button>
      </div>
      {!introDismissed && (
        <>
          <IntroScreen onDismissRequest={handleIntroDismissRequest} />
          <LogoTransition
            transitioning={introTransitioning}
            targetRect={logoEndRect}
            onTransitionEnd={handleLogoTransitionEnd}
          />
        </>
      )}
      {showAnalyticsModal && (
        <AnalyticsOptInModal onClose={() => setShowAnalyticsModal(false)} />
      )}
      {isChinottoCardOpen && (
        <ChinottoCard
          onClose={() => setIsChinottoCardOpen(false)}
          iconVariantId={iconVariantId}
          onIconVariantChange={setIconVariantId}
        />
      )}
      {isStreamShowcaseOpen && (
        <StreamShowcaseModal onClose={() => setIsStreamShowcaseOpen(false)} />
      )}
      {resurfaced && (
        <ResurfacedOverlay
          entry={resurfaced.entry}
          reason={resurfaced.reason}
          onOpen={(entry) => {
            const ageDays = Math.floor(
              (Date.now() - new Date(entry.created_at).getTime()) / (24 * 60 * 60 * 1000)
            );
            track({ event: "resurface_opened", age_days: ageDays });
            handleOpenEntry(entry);
            setResurfaced(null);
          }}
          onDismiss={() => {
            setResurfaced(null);
            requestAnimationFrame(() => {
              entryInputRef.current?.focus();
            });
          }}
        />
      )}
      {EXPERIMENTAL_VOICE_CAPTURE && voiceCaptureOpen && (
        <VoiceCaptureOverlay
          mode={voiceCaptureMode}
          releasedBeforeMountRef={voiceHoldReleasedBeforeMountRef}
          onClose={() => setVoiceCaptureOpen(false)}
          onCreateEntry={async (text) => {
            try {
              await handleSubmit(text);
            } finally {
              setVoiceCaptureOpen(false);
            }
          }}
        />
      )}
      <UpdateNudge
        phase={appUpdater.phase}
        onDownload={appUpdater.download}
        onRestart={appUpdater.installAndRestart}
        onRetry={appUpdater.retryAfterError}
      />
    </>
  );
}
