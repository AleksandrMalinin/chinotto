import { forwardRef, useCallback } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  placeholder?: string;
};

export const SearchInput = forwardRef<HTMLInputElement, Props>(
  function SearchInput(
    {
      value,
      onChange,
      onClose,
      onEnter,
      onArrowUp,
      onArrowDown,
      placeholder = "Search your thoughts…",
    },
    ref
  ) {
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose?.();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter?.();
          return;
        }
        if (e.key === "ArrowDown") {
          if (onArrowDown) e.preventDefault();
          onArrowDown?.();
          return;
        }
        if (e.key === "ArrowUp") {
          if (onArrowUp) e.preventDefault();
          onArrowUp?.();
        }
      },
      [onClose, onEnter, onArrowUp, onArrowDown]
    );
    return (
      <Input
        ref={ref}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Search entries"
        className="text-[13px] py-1.5 border-b border-[var(--border)] rounded-none"
      />
    );
  }
);
