"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Small count shown after the label (hidden when 0/undefined). */
  count?: number;
  countTone?: "neutral" | "danger";
}

/**
 * Accessible tab list (WAI-ARIA tabs pattern): arrow keys move between
 * tabs, Home/End jump to the ends, and only the selected tab is tabbable.
 * Pair each panel with <TabPanel> using the same idBase.
 */
export function Tabs<T extends string>({
  idBase,
  items,
  value,
  onValueChange,
  label,
  className,
}: {
  idBase: string;
  items: TabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last ? 0 : index + 1
        : event.key === "ArrowLeft"
          ? index === 0 ? last : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onValueChange(items[next].value);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "scrollbar-thin flex gap-1 overflow-x-auto rounded-[0.875rem] bg-surface-sunken p-1",
        className,
      )}
    >
      {items.map(({ value: itemValue, label: itemLabel, icon: Icon, count, countTone }, index) => {
        const selected = itemValue === value;
        return (
          <button
            key={itemValue}
            ref={(el) => {
              refs.current[index] = el;
            }}
            role="tab"
            type="button"
            id={`${idBase}-tab-${itemValue}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${itemValue}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(itemValue)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "focus-ring flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[0.625rem] px-3.5 py-2 text-label transition-colors duration-150",
              selected
                ? "bg-surface text-ink shadow-card"
                : "text-ink-muted hover:bg-surface/60 hover:text-ink",
            )}
          >
            {/* Icons only on wide screens so five tabs fit beside the details column. */}
            {Icon && <Icon className={cn("hidden h-4 w-4 2xl:block", selected ? "text-primary-500" : "")} />}
            {itemLabel}
            {count ? (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-[0.6875rem] font-semibold leading-5",
                  countTone === "danger"
                    ? "bg-danger-soft text-danger-fg"
                    : "bg-surface-sunken text-ink-secondary",
                  selected && countTone !== "danger" && "bg-primary-50 text-primary-700",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  idBase,
  value,
  className,
  children,
}: {
  idBase: string;
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      tabIndex={0}
      className={cn("focus-visible:outline-none", className)}
    >
      {children}
    </div>
  );
}
