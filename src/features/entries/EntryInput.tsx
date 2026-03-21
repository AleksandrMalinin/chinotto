import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  onSubmit: (text: string) => void;
  /** Fires on each change so the shell can react while the stream is still empty (progressive onboarding). */
  onDraftChange?: (value: string) => void;
};

export type EntryInputRef = { focus: () => void };

export const EntryInput = forwardRef<EntryInputRef, Props>(function EntryInput(
  { onSubmit, onDraftChange },
  ref
) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      (e.target as HTMLTextAreaElement).blur();
      return;
    }
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const raw = (e.target as HTMLTextAreaElement).value.trim();
    if (!raw) return;
    onSubmit(raw);
    (e.target as HTMLTextAreaElement).value = "";
  }

  return (
    <div className="entry-input-area">
      <Textarea
        ref={inputRef}
        className="entry-input !py-0"
        placeholder="Capture a thought…"
        onKeyDown={handleKeyDown}
        onChange={(e) => onDraftChange?.(e.target.value)}
        rows={2}
        aria-label="New thought"
      />
    </div>
  );
});
