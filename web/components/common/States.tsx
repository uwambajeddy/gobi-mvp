import { AlertOctagon, RotateCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { apiErrorMessage } from "@/lib/handleApiError";

/** Friendly placeholder for lists and panels with nothing to show yet. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-6 py-8" : "px-6 py-14",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-line/70 bg-surface-muted text-ink-muted">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <p className="text-heading text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-body text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Shown when a query fails; surfaces the API's message and offers a retry. */
export function ErrorState({
  error,
  onRetry,
  title = "We couldn't load this",
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger-fg">
        <AlertOctagon className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-heading text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-body text-ink-muted">{apiErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}

/** Placeholder rows while a list loads. */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-line/60", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="hidden h-6 w-24 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Full-page loading placeholder (header + cards). */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading page" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}
