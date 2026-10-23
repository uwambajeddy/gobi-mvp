import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Skeleton                                                             */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-sunken", className)} />;
}

/* ------------------------------------------------------------------ */
/* Callout: inline banner for gate results, notes and warnings          */
/* ------------------------------------------------------------------ */

type Tone = "info" | "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<Tone, { box: string; icon: string; title: string; body: string }> = {
  info: { box: "border-info-line/70 bg-info-soft", icon: "text-info-fg", title: "text-info-fg", body: "text-info-fg" },
  success: {
    box: "border-success-line/70 bg-success-soft",
    icon: "text-success-fg",
    title: "text-success-fg",
    body: "text-success-fg",
  },
  warning: {
    box: "border-warning-line bg-warning-soft",
    icon: "text-warning-fg",
    title: "text-warning-fg",
    body: "text-warning-fg",
  },
  danger: {
    box: "border-danger-line/70 bg-danger-soft",
    icon: "text-danger-fg",
    title: "text-danger-fg",
    body: "text-danger-fg",
  },
  neutral: {
    box: "border-line/70 bg-surface-muted",
    icon: "text-ink-muted",
    title: "text-ink",
    body: "text-ink-muted",
  },
};

const toneIcons: Record<Tone, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Info,
};

export function Callout({
  tone = "info",
  title,
  icon,
  action,
  className,
  children,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const styles = toneStyles[tone];
  const Icon = icon ?? toneIcons[tone];
  return (
    <div className={cn("flex gap-3 rounded-inset border p-3.5", styles.box, className)}>
      <Icon className={cn("mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0", styles.icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className={cn("text-label font-semibold", styles.title)}>{title}</p>}
        {children && (
          <div className={cn("text-caption leading-5", styles.body, title && "mt-0.5")}>{children}</div>
        )}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Meter: a single ratio against a total                                */
/* ------------------------------------------------------------------ */

const meterFill: Record<"brand" | "success" | "warning" | "danger", string> = {
  brand: "bg-primary-500",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};
const meterTrack: Record<keyof typeof meterFill, string> = {
  brand: "bg-primary-100",
  success: "bg-success-line/60",
  warning: "bg-warning-line/70",
  danger: "bg-danger-line/70",
};

export function Meter({
  value,
  max,
  tone = "brand",
  label,
  className,
}: {
  value: number;
  max: number;
  tone?: keyof typeof meterFill;
  /** Accessible name, e.g. "Mandatory documents in place". */
  label: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("h-2 w-full overflow-hidden rounded-full", meterTrack[tone], className)}
    >
      <div
        className={cn("fill-hatch h-full rounded-full transition-[width] duration-300", meterFill[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
