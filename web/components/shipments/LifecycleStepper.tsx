import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { LIFECYCLE_STAGES, stageIndexOf } from "@/lib/shipments";
import { ShipmentStatus } from "@/types";

const SIZES = {
  md: { list: "min-w-[36rem]", dot: "h-6 w-6", check: "h-3.5 w-3.5", inner: "h-2 w-2", line: "top-[11px]", gap: 16, label: "mt-2 text-caption" },
  sm: { list: "min-w-[29rem]", dot: "h-5 w-5", check: "h-3 w-3", inner: "h-1.5 w-1.5", line: "top-[9px]", gap: 14, label: "mt-1.5 text-[0.6875rem] leading-4" },
} as const;

/** Progress through the condensed lifecycle, derived from the live status. */
export function LifecycleStepper({ status, size = "md" }: { status: ShipmentStatus; size?: keyof typeof SIZES }) {
  const cancelled = status === "cancelled";
  const current = stageIndexOf(status);
  const last = LIFECYCLE_STAGES.length - 1;
  const s = SIZES[size];

  return (
    <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-1">
      <ol aria-label="Shipment lifecycle" className={cn("grid grid-cols-8", s.list)}>
        {LIFECYCLE_STAGES.map((stage, index) => {
          const done = !cancelled && (index < current || (index === current && status === "completed"));
          const isCurrent = !cancelled && index === current && status !== "completed";
          const lineDone = !cancelled && index <= current;
          return (
            <li
              key={stage.key}
              aria-current={isCurrent ? "step" : undefined}
              className="relative flex flex-col items-center text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn("absolute h-0.5 rounded-full", s.line, lineDone ? "bg-primary-500" : "bg-line")}
                  // From the previous circle's right edge to this circle's left edge.
                  style={{ left: `calc(-50% + ${s.gap}px)`, width: `calc(100% - ${s.gap * 2}px)` }}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex items-center justify-center rounded-full border-2 transition-colors",
                  s.dot,
                  done && "border-primary-500 bg-primary-500 text-white",
                  isCurrent && "border-primary-500 bg-surface ring-4 ring-primary-100",
                  !done && !isCurrent && "border-line-strong bg-surface",
                  cancelled && "border-line bg-surface-sunken",
                )}
              >
                {done && <Check className={s.check} strokeWidth={3} aria-hidden />}
                {isCurrent && <span className={cn("rounded-full bg-primary-500", s.inner)} aria-hidden />}
              </span>
              <span
                className={cn(
                  "px-0.5",
                  s.label,
                  isCurrent ? "font-semibold text-ink" : done ? "text-ink-secondary" : "text-ink-muted",
                  index === last && status === "completed" && "font-semibold text-ink",
                )}
              >
                {stage.label}
              </span>
              <span className="sr-only">
                {done ? "(completed)" : isCurrent ? "(current step)" : cancelled ? "(cancelled)" : "(upcoming)"}
              </span>
            </li>
          );
        })}
      </ol>
      {cancelled && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-caption font-medium text-danger-fg">
          <X className="h-3.5 w-3.5" aria-hidden /> This shipment was cancelled and will not progress further.
        </p>
      )}
    </div>
  );
}
