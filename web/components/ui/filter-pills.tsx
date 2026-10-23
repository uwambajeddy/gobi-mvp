"use client";

import { cn } from "@/lib/utils";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Single-select chip filter. Each chip is a toggle button (aria-pressed). */
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 md:flex-wrap md:overflow-visible",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-label transition-colors duration-150",
              active
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink-secondary hover:border-line-strong hover:text-ink",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[0.6875rem] font-semibold tabular-nums leading-[1.125rem]",
                  active ? "bg-white/15 text-white" : "bg-surface-sunken text-ink-muted",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
