import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDistance, formatDuration } from "@/lib/maps";
import type { ShipmentGeo } from "@/hooks/useShipmentGeo";

export function CountryTag({ code, name }: { code?: string; name?: string }) {
  if (!code) return null;
  return (
    <span
      title={name}
      className="inline-flex shrink-0 items-center rounded border border-line bg-surface-muted px-1 font-mono text-[0.625rem] font-semibold leading-4 text-ink-secondary"
    >
      {code}
    </span>
  );
}

export function RouteDistance({ geo, className, withDuration = true }: { geo: ShipmentGeo; className?: string; withDuration?: boolean }) {
  if (geo.isLocating) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-ink-muted", className)}>
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Measuring route…
      </span>
    );
  }
  if (geo.distanceMeters == null) {
    return <span className={cn("text-ink-subtle", className)}>Distance unavailable</span>;
  }
  return (
    <span className={className}>
      {formatDistance(geo.distanceMeters)}
      {geo.distanceIsRoute
        ? withDuration && geo.route
          ? ` by road · about ${formatDuration(geo.route.durationSeconds)} driving`
          : " by road"
        : " in a straight line"}
    </span>
  );
}
