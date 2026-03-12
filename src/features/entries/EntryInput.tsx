import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  onSubmit: (text: string) => void;
};

export type EntryInputRef = { focus: () => void };

export const EntryInput = forwardRef<EntryInputRef, Props>(function EntryInput(
  { onSubmit },
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
        placeholder="Type a thought and press Enter…"
        onKeyDown={handleKeyDown}
        rows={2}
        aria-label="New entry"
      />
    </div>
  );
});
