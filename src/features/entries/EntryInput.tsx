import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from "react";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  },
  ref
) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const userCollapsedExpandRef = useRef(false);

  const setExpandedState = useCallback(
    (open: boolean) => {
      setExpanded(open);
      onComposeExpandedChange?.(open);
    },
    [onComposeExpandedChange]
  );

  const collapseExpand = useCallback(() => {
    userCollapsedExpandRef.current = true;
    setExpandedState(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [setExpandedState]);

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
      if (expanded) collapseExpand();
    },
  }));

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

  const considerAutoExpand = useCallback(
    (el: HTMLTextAreaElement | null, text: string) => {
      if (!showExpandTrigger || userCollapsedExpandRef.current || expanded) return;
      if (shouldAutoExpandCapture(el, text)) {
        setExpandedState(true);
      }
    },
    [showExpandTrigger, expanded, setExpandedState]
  );

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

  const canExpand = showExpandTrigger && draft.length > 0;

  return (
    <>
      <div className="entry-input-area">
        {canExpand ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="entry-input-expand-btn"
            onClick={openExpand}
            aria-label="Expand capture (⌘⇧Enter)"
          >
            <Maximize2 size={16} strokeWidth={1.75} aria-hidden />
          </Button>
        ) : null}
        <Textarea
          ref={inputRef}
          className="entry-input entry-input--inline !min-h-0 !py-0"
          placeholder="Capture a thought…"
          value={draft}
          onKeyDown={handleInlineKeyDown}
          onChange={(e) => {
            const el = e.target;
            const next = el.value;
            updateDraft(next);
            requestAnimationFrame(() => {
              considerAutoExpand(el, next);
            });
          }}
          rows={1}
          aria-label="New thought"
        />
      </div>
      <ComposeExpandOverlay
        open={expanded}
        value={draft}
        onChange={updateDraft}
        onClose={collapseExpand}
        onSubmit={submitDraft}
      />
    </>
  );
});
