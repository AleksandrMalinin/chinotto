import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onBeforeInput?: (e: React.FormEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
};

export function DetailWriteOverlay({
  open,
  value,
  onChange,
  onClose,
  onBeforeInput,
  onPaste,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="detail-write-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Expanded thought"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="detail-write-panel">
        <Textarea
          ref={textareaRef}
          className="detail-write-input entry-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBeforeInput={onBeforeInput}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          aria-label="Thought text"
        />
        <p className="detail-write-hint">Esc — close · saves as you write</p>
      </div>
    </div>,
    document.body
  );
}
