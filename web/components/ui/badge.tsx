import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-caption font-medium",
  {
    variants: {
      variant: {
        default: "border-primary-200/70 bg-primary-50 text-primary-700",
        secondary: "border-line bg-surface-sunken text-ink-secondary",
        success: "border-success-line/70 bg-success-soft text-success-fg",
        warning: "border-warning-line/80 bg-warning-soft text-warning-fg",
        info: "border-info-line/70 bg-info-soft text-info-fg",
        destructive: "border-danger-line/70 bg-danger-soft text-danger-fg",
        outline: "border-line bg-surface text-ink-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const dotColors: Record<string, string> = {
  default: "bg-primary-500",
  secondary: "bg-ink-subtle",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-danger",
  outline: "bg-ink-subtle",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Leading status dot (identity is still carried by the text label). */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColors[variant ?? "default"])}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
