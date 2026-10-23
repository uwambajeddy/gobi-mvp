import { cn, initials } from "@/lib/utils";

const sizes = {
  sm: "h-7 w-7 text-[0.6875rem]",
  md: "h-9 w-9 text-caption",
  lg: "h-12 w-12 text-body",
  xl: "h-16 w-16 text-heading",
};

/** Initials avatar (the platform stores no profile photos). */
export function Avatar({
  firstName,
  lastName,
  size = "md",
  tone = "brand",
  className,
}: {
  firstName?: string | null;
  lastName?: string | null;
  size?: keyof typeof sizes;
  tone?: "brand" | "info" | "warning" | "neutral" | "inverse";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        sizes[size],
        tone === "brand" && "bg-primary-100 text-primary-800",
        tone === "info" && "bg-info-soft text-info-fg ring-1 ring-inset ring-info-line",
        tone === "warning" && "bg-warning-soft text-warning-fg ring-1 ring-inset ring-warning-line",
        tone === "neutral" && "bg-surface-sunken text-ink-secondary",
        tone === "inverse" && "bg-white/10 text-white",
        className,
      )}
    >
      {initials(firstName, lastName)}
    </span>
  );
}
