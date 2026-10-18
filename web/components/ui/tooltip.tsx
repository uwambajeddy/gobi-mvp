"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const GAP = 8;
const EDGE = 12;

/**
 * Small explanation shown on hover, keyboard focus or tap. Rendered in a
 * portal with fixed coordinates so cards with overflow-hidden don't clip it;
 * it sits above the trigger, flips below when there is no room, and stays
 * inside the viewport horizontally. Escape closes it.
 */
export function Tooltip({
  content,
  children,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const tipRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<React.CSSProperties>({ visibility: "hidden" });

  React.useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const tip = tipRef.current?.getBoundingClientRect();
      if (!trigger || !tip) return;
      const above = trigger.top - tip.height - GAP;
      const centred = trigger.left + trigger.width / 2 - tip.width / 2;
      setPosition({
        top: above >= EDGE ? above : trigger.bottom + GAP,
        left: Math.min(Math.max(centred, EDGE), window.innerWidth - tip.width - EDGE),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      setPosition({ visibility: "hidden" });
    };
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        className={cn("focus-ring inline-flex cursor-help rounded-full", className)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={position}
            className="pointer-events-none fixed z-50 max-w-[16rem] rounded-lg bg-ink px-3 py-2 text-caption font-normal leading-snug text-white shadow-overlay"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
