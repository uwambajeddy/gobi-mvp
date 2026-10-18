import * as React from "react";

import { cn } from "@/lib/utils";

/** Shared look for text inputs, selects and textareas. */
export const controlClasses =
  "w-full rounded-control border border-line bg-surface px-3 text-body text-ink shadow-[0_1px_1px_rgb(16_24_40/0.03)] transition-[border-color,box-shadow] duration-150 placeholder:text-ink-subtle hover:border-line-strong focus:border-primary-500 focus:outline-none focus:ring-[3px] focus:ring-primary-500/15 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional leading icon rendered inside the field. */
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    const input = (
      <input
        type={type}
        className={cn(controlClasses, "h-control", icon && "pl-9", className)}
        ref={ref}
        {...props}
      />
    );
    if (!icon) return input;
    return (
      <div className="relative w-full">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-subtle [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
        {input}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
