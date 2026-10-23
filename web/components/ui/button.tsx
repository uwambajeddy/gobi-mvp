import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-[color,background-color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary-600 text-white shadow-brand hover:bg-primary-700 active:bg-primary-800",
        destructive: "bg-danger text-white shadow-sm hover:bg-danger-fg",
        "destructive-outline":
          "border border-danger-line bg-surface text-danger-fg hover:border-danger/40 hover:bg-danger-soft",
        outline:
          "border border-line bg-surface text-ink shadow-card hover:border-line-strong hover:bg-surface-muted",
        secondary: "bg-surface-sunken text-ink hover:bg-line",
        ghost: "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
        soft: "bg-primary-50 text-primary-700 hover:bg-primary-100",
        link: "h-auto px-0 text-primary-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-control rounded-control px-4 text-body",
        sm: "h-control-sm rounded-control px-3 text-label",
        lg: "h-control-lg rounded-control px-6 text-body",
        icon: "h-control w-control rounded-control",
        "icon-sm": "h-control-sm w-control-sm rounded-control",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner and disables the button while an action is in flight. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
