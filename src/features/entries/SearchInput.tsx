import { forwardRef, useCallback } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  placeholder?: string;
};

export const SearchInput = forwardRef<HTMLInputElement, Props>(
  function SearchInput({ value, onChange, onClose, placeholder = "Search entries…" }, ref) {
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose?.();
        }
      },
      [onClose]
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
