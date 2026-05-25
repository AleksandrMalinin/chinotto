import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  onSubmit: (text: string) => void;
  /** Fires on each change so the shell can react while the stream is still empty (progressive onboarding). */
  onDraftChange?: (value: string) => void;
};

export type EntryInputRef = { focus: () => void };

const CAPTURE_INPUT_MIN_HEIGHT_PX = 28;

function syncCaptureInputHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, CAPTURE_INPUT_MIN_HEIGHT_PX)}px`;
}

export const EntryInput = forwardRef<EntryInputRef, Props>(function EntryInput(
  { onSubmit, onDraftChange },
  ref
) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const resizeInput = useCallback(() => {
    syncCaptureInputHeight(inputRef.current);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    resizeInput();
  }, [resizeInput]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      (e.target as HTMLTextAreaElement).blur();
      return;
    }
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const el = e.target as HTMLTextAreaElement;
    const raw = el.value.trim();
    if (!raw) return;
    onSubmit(raw);
    el.value = "";
    onDraftChange?.("");
    syncCaptureInputHeight(el);
  }

  return (
    <div className="entry-input-area">
      <Textarea
        ref={inputRef}
        className="entry-input"
        placeholder="Capture a thought…"
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          onDraftChange?.(e.target.value);
          syncCaptureInputHeight(e.target);
        }}
        rows={1}
        aria-label="New thought"
      />
    </div>
  );
});
