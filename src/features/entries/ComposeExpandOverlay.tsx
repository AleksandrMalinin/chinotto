import { useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { syncComposeExpandInputHeight } from "./captureInputHeight";

type Props = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (text: string) => void;
};

export function ComposeExpandOverlay({
  open,
  value,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = textareaRef.current;
    if (!el) return;
    syncComposeExpandInputHeight(el);
    el.focus();
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    syncComposeExpandInputHeight(textareaRef.current);
  }, [open, value]);

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const raw = value.trim();
    if (!raw) return;
    onSubmit(raw);
  }

  return (
    <div
      className="compose-expand-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Expanded capture"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="compose-expand-panel">
        <Textarea
          ref={textareaRef}
          className="compose-expand-input entry-input"
          value={value}
          placeholder="Capture a thought…"
          onChange={(e) => {
            onChange(e.target.value);
            syncComposeExpandInputHeight(e.target);
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          aria-label="Expanded capture"
        />
        <p className="compose-expand-hint">
          Enter — save · Shift+Enter — line · Esc — discard
        </p>
      </div>
    </div>
  );
}
