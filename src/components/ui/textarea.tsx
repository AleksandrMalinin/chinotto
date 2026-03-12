import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex w-full min-h-[2.5rem] rounded-md border-b border-[var(--border)] bg-transparent px-0 py-1.5 text-[var(--fg)] text-[18px] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-0 focus-visible:border-[var(--border-focus)] focus-visible:shadow-[0_1px_0_0_var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50 transition-[border-color,box-shadow] duration-[180ms] ease-out resize-none leading-[1.55]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
