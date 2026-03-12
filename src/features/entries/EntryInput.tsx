import { useRef, useEffect } from "react";

type Props = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
};

export function EntryInput({ onSubmit, disabled }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    <textarea
      ref={inputRef}
      className="entry-input"
      placeholder="Type a thought and press Enter…"
      onKeyDown={handleKeyDown}
      disabled={disabled}
      rows={2}
      aria-label="New entry"
    />
  );
}
