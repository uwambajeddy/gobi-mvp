"use client";

import { Pause, Play } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { cn, formatRelative } from "@/lib/utils";
import type { TrackingState } from "@/hooks/useDriverBackgroundTracker";
import { isSharingRelevant, useDriverTracker } from "./DriverBackgroundTracker";

type Tone = "live" | "warning" | "danger";

/** How each tracker state reads in the top bar: a short label for phones, a full one, and what to do. */
export const SHARING_STATE: Record<Exclude<TrackingState, "idle">, { short: string; label: string; tone: Tone; help?: string }> = {
  active: { short: "Live", label: "Sharing location", tone: "live" },
  prompt: {
    short: "Allow",
    label: "Allow location",
    tone: "warning",
    help: "Allow location when your browser asks, so the shipment's parties can follow the truck.",
  },
  disabled: {
    short: "Paused",
    label: "Sharing paused",
    tone: "warning",
    help: "The shipment's parties can't see the truck until you resume.",
  },
  denied: {
    short: "Blocked",
    label: "Location blocked",
    tone: "danger",
    help: "Allow location for this site in your browser settings, so the shipment's parties can follow the truck.",
  },
  unsupported: {
    short: "No GPS",
    label: "Location unavailable",
    tone: "danger",
    help: "This browser can't share its location. Open Gobi in Chrome or Safari on your phone.",
  },
};

const DOT: Record<Tone, string> = {
  live: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const CHIP: Record<Tone, string> = {
  live: "text-ink",
  warning: "text-warning-fg",
  danger: "text-danger-fg",
};

/**
 * The driver's location-sharing status in the top bar, while a shipment is on
 * the road: a quiet chip that turns amber or red when the shipment's parties
 * can't see the truck. It opens to show what is shared, and pause or resume.
 */
export function LocationSharingMenu() {
  const status = useDriverTracker();
  if (!isSharingRelevant(status)) return null;

  const look = SHARING_STATE[status.state as Exclude<TrackingState, "idle">];
  const references = status.activeShipments.map((shipment) => shipment.reference).join(", ");
  const link = !status.online ? "Offline" : status.socketConnected ? "Live link connected" : "Live link reconnecting";

  return (
    <DropdownMenu
      triggerLabel={`Location sharing: ${look.label}`}
      trigger={
        <span
          className={cn(
            "glass flex h-9 items-center gap-2 rounded-full px-3 text-label font-semibold transition-colors hover:bg-white/90",
            CHIP[look.tone],
          )}
        >
          <span
            aria-hidden
            className={cn("h-2 w-2 shrink-0 rounded-full", DOT[look.tone], look.tone === "live" && "animate-pulse")}
          />
          <span className="sm:hidden">{look.short}</span>
          <span className="hidden sm:inline">{look.label}</span>
        </span>
      }
      header={
        <div className="min-w-0 space-y-0.5">
          <p className="text-label font-semibold text-ink">{look.label}</p>
          <p className="truncate text-caption text-ink-secondary" title={references}>
            {references}
          </p>
          <p className="text-caption text-ink-muted">
            {status.lastSendAt
              ? `Last sent ${formatRelative(new Date(status.lastSendAt).toISOString())}`
              : "Nothing sent yet"}{" "}
            · {link}
          </p>
          {look.help && <p className={cn("pt-1 text-caption", CHIP[look.tone])}>{look.help}</p>}
          {status.error && status.state === "active" && (
            <p className="pt-1 text-caption text-danger-fg">{status.error}</p>
          )}
        </div>
      }
      items={[
        status.prefs.enabled
          ? { label: "Pause sharing", icon: Pause, onSelect: () => status.setEnabled(false) }
          : { label: "Resume sharing", icon: Play, onSelect: () => status.setEnabled(true) },
      ]}
    />
  );
}
