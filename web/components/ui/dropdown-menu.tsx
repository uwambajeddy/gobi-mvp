"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  tone?: "default" | "danger";
}

const GAP = 8;

/**
 * Minimal menu button (WAI-ARIA menu pattern): Enter/Space/ArrowDown opens,
 * arrows move between items, Escape or an outside click closes and returns
 * focus to the trigger. The menu renders in a portal with fixed positioning,
 * so containers that clip (the sidebar) or stack above it can't hide it.
 */
export function DropdownMenu({
  trigger,
  triggerLabel,
  header,
  items,
  align = "end",
  side = "bottom",
  className,
  triggerClassName,
}: {
  trigger: React.ReactNode;
  triggerLabel: string;
  header?: React.ReactNode;
  items: MenuItem[];
  /** Which trigger edge the menu lines up with. */
  align?: "start" | "end";
  /** Open below the trigger, or above it (for triggers at the bottom of the screen). */
  side?: "bottom" | "top";
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<React.CSSProperties>({});
  const rootRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = React.useId();

  const place = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      ...(side === "bottom" ? { top: rect.bottom + GAP } : { bottom: window.innerHeight - rect.top + GAP }),
      ...(align === "end" ? { right: window.innerWidth - rect.right } : { left: rect.left }),
    });
  }, [side, align]);

  React.useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const nodes = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      // Keep Escape from also closing an enclosing drawer.
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nodes[(index + 1) % nodes.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || (side === "top" && event.key === "ArrowUp")) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn("focus-ring rounded-full", triggerClassName)}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={triggerLabel}
            onKeyDown={onMenuKeyDown}
            style={position}
            className="glass fixed z-[60] w-60 animate-pop-in overflow-hidden rounded-inset bg-white/90 p-1.5"
          >
            {header && <div className="border-b border-line/70 px-2.5 pb-2.5 pt-1.5">{header}</div>}
            <div className={cn(header && "pt-1.5")}>
              {items.map(({ label, icon: Icon, onSelect, tone }, index) => (
                <button
                  key={label}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  role="menuitem"
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    setOpen(false);
                    onSelect();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[0.5rem] px-2.5 py-2 text-left text-body transition-colors focus:outline-none",
                    tone === "danger"
                      ? "text-danger-fg hover:bg-danger-soft focus:bg-danger-soft"
                      : "text-ink-secondary hover:bg-surface-sunken hover:text-ink focus:bg-surface-sunken focus:text-ink",
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  {label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
