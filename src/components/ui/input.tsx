import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-md border border-[var(--border)] bg-transparent px-0 py-2 text-[var(--fg)] text-base placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-0 focus-visible:border-[var(--border-focus)] focus-visible:shadow-[0_1px_0_0_var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50 transition-[border-color,box-shadow] duration-[180ms] ease-out",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
