import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/feedback";

type Tone = "brand" | "info" | "success" | "warning" | "danger" | "neutral";

// Solid tiles so each figure carries its tone; every pair is at least 3:1.
const iconTone: Record<Tone, string> = {
  brand: "bg-primary-500 text-white shadow-brand",
  info: "bg-info-fg text-white",
  success: "bg-success-fg text-white",
  warning: "bg-warning-fg text-white",
  danger: "bg-danger text-white",
  neutral: "bg-ink text-white",
};

/**
 * Stat tile: label, value and a supporting line. Values come straight from
 * API data; when `href` is set the whole tile links to the filtered view.
 */
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  href,
  highlight,
  loading,
  compact,
  className,
}: {
  label: string;
  value: number | string;
  detail?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  href?: string;
  /** Draws attention when the number needs action (e.g. pending approvals). */
  highlight?: boolean;
  loading?: boolean;
  /** Single-row layout: icon, value and label side by side. */
  compact?: boolean;
  className?: string;
}) {
  const compactBody = (
    <div className="flex items-center gap-3">
      {Icon && (
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.75rem]", iconTone[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {loading ? (
          <Skeleton className="mb-1 h-6 w-10" />
        ) : (
          <p className="font-display text-[1.375rem] font-bold leading-7 text-ink">{value}</p>
        )}
        <p className="truncate text-caption text-ink-muted" title={typeof detail === "string" ? detail : undefined}>
          {label}
        </p>
      </div>
      {href && (
        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-ink-subtle transition-colors group-hover:text-primary-600"
          aria-hidden
        />
      )}
    </div>
  );

  const body = compact ? compactBody : (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-[0.625rem]", iconTone[tone])}>
              <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            </span>
          )}
          <p className="text-label text-ink-secondary">{label}</p>
        </div>
        {href && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-muted transition-colors group-hover:border-primary-200 group-hover:bg-primary-50 group-hover:text-primary-600">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-4 h-8 w-16" />
      ) : (
        <p className="font-display mt-4 text-[1.875rem] font-bold leading-9 text-ink">{value}</p>
      )}
      {detail && <p className="mt-0.5 truncate text-caption text-ink-muted">{detail}</p>}
    </>
  );

  const classes = cn(
    "glass group block rounded-card transition-colors duration-150",
    compact ? "px-4 py-3" : "p-5",
    highlight && "border-warning-line bg-warning-soft/70",
    href && "focus-ring hover:bg-white/90",
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
