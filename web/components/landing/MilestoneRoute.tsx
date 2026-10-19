"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Flag, Fuel, MapPin, Milestone, Package, PackageCheck, Stamp, Warehouse } from "lucide-react";
import truckSide from "@/public/landing/truck-side.png";
import truckTop from "@/public/landing/truck-top.png";
import { cn } from "@/lib/utils";

const MILESTONES = [
  { icon: Package, label: "Picked up" },
  { icon: MapPin, label: "Checkpoint" },
  { icon: Fuel, label: "Fuel stop" },
  { icon: Milestone, label: "Border cleared" },
  { icon: Stamp, label: "Customs released" },
  { icon: Warehouse, label: "Warehouse" },
  { icon: Flag, label: "Arrived" },
  { icon: PackageCheck, label: "Proof of delivery" },
];

const LAST = MILESTONES.length - 1;

/*
 * One run, as route progress: 0 is the first stop, 1 the last. The truck
 * drives it at a constant speed, starting a little before the first stop and
 * ending a little after the last (LEAD), fading in and out over those ends.
 */
const DRIVE_MS = 15000; // first stop to last
const LEAD = 0.05;
const HOLD_MS = 1800; // the finished route stays on show
const CLEAR_MS = 600; // the trail fades before the next run
const RUN_MS = DRIVE_MS * (1 + 2 * LEAD);
const CYCLE_MS = RUN_MS + HOLD_MS + CLEAR_MS;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** How many stops the middle of the truck has passed at progress `p`. */
const stopsPassed = (p: number) => (p < 0 ? 0 : Math.min(MILESTONES.length, Math.floor(p * LAST + 1e-6) + 1));

/**
 * The milestones a shipment timeline records, as stops on a road. A container
 * truck drives the route at a steady speed and each stop checks as it passes,
 * then the route clears and the run repeats. One row from lg up, with the
 * tiles as signs above the road; a vertical route below. Reduced motion
 * shows the finished route.
 *
 * The truck and trail are moved per frame through CSS variables on the root
 * (--progress, --trail); React only re-renders when a stop is passed.
 */
export function MilestoneRoute() {
  const ref = useRef<HTMLDivElement>(null);
  const truckRef = useRef<HTMLSpanElement>(null);
  const trailRef = useRef<HTMLSpanElement>(null);
  const [checked, setChecked] = useState(0);

  useEffect(() => {
    const root = ref.current;
    const truck = truckRef.current;
    const trail = trailRef.current;
    if (!root || !truck || !trail) return;

    let shown = 0;
    const show = (count: number) => {
      if (count === shown) return;
      shown = count;
      setChecked(count);
    };
    const place = (p: number) => {
      root.style.setProperty("--progress", String(p));
      root.style.setProperty("--trail", String(clamp01(p)));
      truck.style.opacity = String(clamp01(Math.min(1 + p / LEAD, 1 - (p - 1) / LEAD)));
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      place(1);
      show(MILESTONES.length);
      return;
    }

    // The first run starts at the first stop, where the truck is drawn before it moves.
    let elapsed = LEAD * DRIVE_MS;
    let last: number | null = null;
    let raf = 0;

    const frame = (now: number) => {
      // A long gap (background tab, stalled frame) must not jump the truck ahead.
      elapsed += last === null ? 0 : Math.min(now - last, 250);
      last = now;
      const t = elapsed % CYCLE_MS;

      if (t < RUN_MS) {
        const p = -LEAD + (t / RUN_MS) * (1 + 2 * LEAD);
        place(p);
        trail.style.opacity = "1";
        show(stopsPassed(p));
      } else if (t < RUN_MS + HOLD_MS) {
        place(1 + LEAD);
        show(MILESTONES.length);
      } else {
        place(1 + LEAD);
        show(0);
        trail.style.opacity = String(1 - (t - RUN_MS - HOLD_MS) / CLEAR_MS);
      }
      raf = requestAnimationFrame(frame);
    };

    // Drive only while the route is on screen.
    const observer = new IntersectionObserver(
      ([entry]) => {
        cancelAnimationFrame(raf);
        if (!entry.isIntersecting) return;
        last = null;
        raf = requestAnimationFrame(frame);
      },
      { threshold: 0.3 },
    );
    observer.observe(root);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="relative mx-auto mt-9 w-full max-w-[18rem] lg:max-w-none"
      style={{ "--progress": 0, "--trail": 0 } as React.CSSProperties}
    >
      {/* Road ahead: dashed. Vertical through the stop dots, horizontal from lg up. */}
      <span
        aria-hidden
        className="absolute bottom-8 left-[calc(1.125rem-1px)] top-8 border-l-2 border-dashed border-line-strong lg:bottom-auto lg:left-[6.25%] lg:right-[6.25%] lg:top-[calc(5.75rem-1px)] lg:border-l-0 lg:border-t-2"
      />
      {/* Road behind the truck: solid orange, up to its middle. */}
      <span
        ref={trailRef}
        aria-hidden
        className={cn(
          "absolute left-[calc(1.125rem-1px)] top-8 h-[calc(var(--trail)*28rem)] w-0.5 rounded-full bg-primary-500",
          "lg:left-[6.25%] lg:top-[calc(5.75rem-1px)] lg:h-0.5 lg:w-[calc(var(--trail)*87.5%)]",
        )}
      />

      <ol className="relative lg:grid lg:grid-cols-8">
        {MILESTONES.map(({ icon: Icon, label }, index) => {
          const done = index < checked;
          const delivered = done && index === LAST;
          return (
            <li key={label} className="flex h-16 items-center gap-3 lg:h-auto lg:flex-col lg:gap-0 lg:text-center">
              {/* The sign: pops and tints once the check has run up its post. */}
              <span
                className={cn(
                  "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-inset transition-colors duration-300",
                  delivered
                    ? "animate-tile-pop bg-primary-600 text-white shadow-brand delay-200"
                    : done
                      ? "animate-tile-pop bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-200 delay-200"
                      : "tile text-ink-secondary",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {done && !delivered && (
                  <span
                    aria-hidden
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 animate-badge-in items-center justify-center rounded-full bg-primary-600 text-white ring-2 ring-canvas"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                {delivered && (
                  <span aria-hidden className="absolute inset-0 animate-tile-burst rounded-inset ring-2 ring-primary-500" />
                )}
              </span>

              {/* Signpost from the tile down to the road (lg up); fills orange upwards. */}
              <span aria-hidden className="relative hidden h-8 w-px bg-line-strong lg:block">
                <span
                  className={cn(
                    "absolute inset-x-[-0.5px] bottom-0 h-full origin-bottom bg-primary-500 transition-transform duration-300 ease-out",
                    done ? "scale-y-100" : "scale-y-0",
                  )}
                />
              </span>

              {/* The stop on the road: left of the tile on phones, under it from lg up. */}
              <span
                aria-hidden
                className="order-first flex h-full w-9 shrink-0 items-center justify-center lg:order-none lg:h-6 lg:w-full"
              >
                <span className="relative flex h-3 w-3">
                  {done && <span className="absolute inset-0 animate-stop-ping rounded-full bg-primary-500" />}
                  <span
                    className={cn(
                      "relative h-3 w-3 rounded-full border-2 transition-colors duration-200",
                      done ? "border-primary-500 bg-primary-500" : "border-line-strong bg-surface",
                    )}
                  />
                </span>
              </span>

              <span className="flex flex-col lg:mt-1">
                <span
                  className={cn(
                    "font-mono text-caption transition-colors duration-300",
                    done ? "text-primary-600" : "text-ink-subtle",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-label font-semibold text-ink">{label}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {/*
        The truck, its middle on the route progress. Phones: seen from above,
        centred on the vertical road. From lg up: from the side, wheels on the road.
      */}
      <span
        ref={truckRef}
        aria-hidden
        className={cn(
          "absolute left-[1.125rem] top-[calc(2rem_+_var(--progress)*28rem)] z-10 h-28 -translate-x-1/2 -translate-y-1/2",
          "lg:left-[calc(6.25%_+_var(--progress)*87.5%)] lg:top-[5.75rem] lg:h-auto lg:w-[clamp(7rem,11%,9rem)] lg:-translate-y-full",
        )}
      >
        <Image
          src={truckTop}
          alt=""
          sizes="1.5rem"
          className="block h-full w-auto drop-shadow-[0_2px_4px_rgb(15_26_51/0.25)] lg:hidden"
        />
        <Image
          src={truckSide}
          alt=""
          sizes="9rem"
          className="hidden h-auto w-full drop-shadow-[0_3px_3px_rgb(15_26_51/0.22)] lg:block"
        />
      </span>
    </div>
  );
}
