import {
  useRef,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { ComposeExpandOverlay } from "./ComposeExpandOverlay";
import { shouldAutoExpandCapture } from "./captureInputHeight";

type Props = {
  onSubmit: (text: string) => void;
  /** Fires on each change so the shell can react while the stream is still empty (progressive onboarding). */
  onDraftChange?: (value: string) => void;
  /** Hide expand affordance during first-run empty stream onboarding. */
  showExpandTrigger?: boolean;
  onComposeExpandedChange?: (expanded: boolean) => void;
  /** Reading focus: quieter single-line capture above an open thought. */
  compact?: boolean;
};

export type EntryInputRef = {
  focus: () => void;
  collapseComposeExpand: () => void;
};

export const EntryInput = forwardRef<EntryInputRef, Props>(function EntryInput(
  {
    onSubmit,
    onDraftChange,
    showExpandTrigger = true,
    onComposeExpandedChange,
    compact = false,
  },
  ref
) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const userCollapsedExpandRef = useRef(false);
  const pastePendingExpandRef = useRef(false);

  const setExpandedState = useCallback(
    (open: boolean) => {
      setExpanded(open);
      onComposeExpandedChange?.(open);
    },
    [onComposeExpandedChange]
  );

  const updateDraft = useCallback(
    (next: string) => {
      setDraft(next);
      onDraftChange?.(next);
    },
    [onDraftChange]
  );

  const clearDraft = useCallback(() => {
    userCollapsedExpandRef.current = false;
    updateDraft("");
  }, [updateDraft]);

  const dismissExpand = useCallback(() => {
    userCollapsedExpandRef.current = true;
    pastePendingExpandRef.current = false;
    updateDraft("");
    setExpandedState(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [updateDraft, setExpandedState]);

  const openExpand = useCallback(() => {
    if (!showExpandTrigger) return;
    userCollapsedExpandRef.current = false;
    setExpandedState(true);
  }, [showExpandTrigger, setExpandedState]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (expanded) return;
      inputRef.current?.focus();
    },
    collapseComposeExpand: () => {
      if (expanded) dismissExpand();
    },
  }));

  const submitDraft = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      onSubmit(trimmed);
      clearDraft();
      if (expanded) setExpandedState(false);
    },
    [onSubmit, clearDraft, expanded, setExpandedState]
  );

  const tryAutoExpand = useCallback(
    (text: string, options?: { ignoreUserCollapsed?: boolean }) => {
      if (!showExpandTrigger || expanded) return;
      if (!options?.ignoreUserCollapsed && userCollapsedExpandRef.current) return;
      const el = inputRef.current;
      if (!shouldAutoExpandCapture(el, text)) return;
      userCollapsedExpandRef.current = false;
      setExpandedState(true);
    },
    [showExpandTrigger, expanded, setExpandedState]
  );

  useLayoutEffect(() => {
    if (expanded) return;
    const ignoreCollapsed = pastePendingExpandRef.current;
    pastePendingExpandRef.current = false;
    tryAutoExpand(draft, { ignoreUserCollapsed: ignoreCollapsed });
  }, [draft, expanded, tryAutoExpand]);

  useEffect(() => {
    if (expanded) return;
    inputRef.current?.focus();
  }, [expanded]);

  function handleInlineKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      if (expanded) return;
      (e.target as HTMLTextAreaElement).blur();
      return;
    }
    if (
      e.key === "Enter" &&
      e.shiftKey &&
      (e.metaKey || e.ctrlKey) &&
      showExpandTrigger
    ) {
      e.preventDefault();
      openExpand();
      return;
    }
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    submitDraft((e.target as HTMLTextAreaElement).value);
  }

  return (
    <>
      <div
        className={[
          "entry-input-area",
          expanded ? "entry-input-area--compose-open" : "",
          compact ? "entry-input-area--compact" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Textarea
          ref={inputRef}
          className="entry-input entry-input--inline !min-h-0 !py-0"
          placeholder={compact ? "New thought…" : "Capture a thought…"}
          value={expanded ? "" : draft}
          readOnly={expanded}
          tabIndex={expanded ? -1 : 0}
          aria-hidden={expanded}
          onKeyDown={handleInlineKeyDown}
          onChange={(e) => {
            if (expanded) return;
            updateDraft(e.target.value);
          }}
          onPaste={() => {
            if (expanded) return;
            pastePendingExpandRef.current = true;
          }}
          rows={1}
          aria-label="New thought"
        />
      </div>
      <ComposeExpandOverlay
        open={expanded}
        value={draft}
        onChange={updateDraft}
        onClose={dismissExpand}
        onSubmit={submitDraft}
      />
    </>
  );
});
