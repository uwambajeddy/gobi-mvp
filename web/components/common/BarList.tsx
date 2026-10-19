import Link from "next/link";

import { cn } from "@/lib/utils";

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  href?: string;
}

/**
 * Horizontal bar list for one series (counts per category). Single hue on
 * a same-ramp track, value at the bar tip, so no legend is needed. Each row
 * is also a link/tooltip target, and the numbers double as the table view.
 */
export function BarList({
  items,
  total,
  unit = "shipments",
  className,
}: {
  items: BarListItem[];
  /** Denominator for the bar length and percentage (defaults to the sum of values). */
  total?: number;
  unit?: string;
  className?: string;
}) {
  const sum = total ?? items.reduce((acc, item) => acc + item.value, 0);

  return (
    <ul className={cn("space-y-1", className)}>
      {items.map((item) => {
        const pct = sum > 0 ? Math.round((item.value / sum) * 100) : 0;
        // Bar length is the share of the total, so it always matches the % label.
        const width = item.value === 0 || sum === 0 ? 0 : Math.max(3, (item.value / sum) * 100);
        const tooltip = `${item.label}: ${item.value} ${unit}${sum > 0 ? ` (${pct}%)` : ""}`;
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn("truncate text-label", item.value === 0 ? "text-ink-muted" : "text-ink")}>
                {item.label}
              </span>
              <span className="shrink-0 text-label tabular-nums text-ink">
                {item.value}
                <span className="ml-1.5 text-caption text-ink-muted">{pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-primary-50">
              <div
                className="fill-hatch h-full rounded-full bg-primary-500 transition-[width] duration-300 group-hover:bg-primary-600"
                style={{ width: `${width}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link
                href={item.href}
                title={tooltip}
                aria-label={tooltip}
                className="focus-ring group block rounded-inset px-2.5 py-2 transition-colors hover:bg-surface-muted"
              >
                {row}
              </Link>
            ) : (
              <div title={tooltip} className="group rounded-inset px-2.5 py-2">
                {row}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
