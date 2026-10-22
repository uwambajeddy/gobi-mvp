"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Ban,
  Banknote,
  Bot,
  Building2,
  CircleCheck,
  ClipboardCheck,
  Clock,
  FileCheck,
  FileUp,
  FileX,
  Flag,
  History,
  MapPin,
  PackagePlus,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Truck,
  User as UserIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { Field } from "@/components/ui/field";
import { Callout } from "@/components/ui/feedback";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";
import { handleApiError } from "@/lib/handleApiError";
import { EVENT_LABELS, MANUAL_EVENT_TYPES } from "@/lib/labels";
import { cn, formatDateTime, formatRelative, fullName } from "@/lib/utils";
import { Shipment, ShipmentAccess, ShipmentEvent } from "@/types";

/** Milestones that advance the shipment status (mirrors the API's EVENT_STATUS_EFFECTS). */
const STATUS_MILESTONES = ["picked_up", "arrived_destination"];

const TONE_TILE = {
  success: "bg-success-soft text-success-fg ring-success-line",
  danger: "bg-danger-soft text-danger-fg ring-danger-line",
  warning: "bg-warning-soft text-warning-fg ring-warning-line",
  info: "bg-info-soft text-info-fg ring-info-line",
  neutral: "bg-surface-sunken text-ink-secondary ring-line",
};

/** Icon and tone for events Gobi writes, so outcomes read at a glance. */
const SYSTEM_EVENT_LOOK: Record<string, [LucideIcon, keyof typeof TONE_TILE]> = {
  shipment_created: [PackagePlus, "neutral"],
  shipment_submitted: [Send, "neutral"],
  carrier_assigned: [Building2, "neutral"],
  clearing_agent_assigned: [Building2, "neutral"],
  quote_approved: [BadgeCheck, "success"],
  document_uploaded: [FileUp, "info"],
  document_verified: [FileCheck, "success"],
  document_rejected: [FileX, "danger"],
  documents_complete: [ShieldCheck, "success"],
  execution_assigned: [Truck, "neutral"],
  gate_overridden: [ShieldAlert, "warning"],
  payment_recorded: [Banknote, "info"],
  exception_opened: [TriangleAlert, "warning"],
  exception_resolved: [CircleCheck, "success"],
  pod_captured: [ClipboardCheck, "success"],
  shipment_completed: [Flag, "success"],
  shipment_cancelled: [Ban, "danger"],
};

/**
 * The shipment's operational diary: every milestone with who / when / where /
 * evidence, whether recorded manually or written by the system.
 */
export function TimelinePanel({
  shipment,
  access,
  onChanged,
}: {
  shipment: Shipment;
  access: ShipmentAccess;
  onChanged: () => void;
}) {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [eventType, setEventType] = useState("checkpoint");
  const [locationName, setLocationName] = useState("");
  const [notes, setNotes] = useState("");

  const {
    data: events,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["shipment-events", String(shipment.id)],
    queryFn: async () =>
      (await axios.get(`/api/v1/shipments/${shipment.id}/events`)).data.data.events as ShipmentEvent[],
  });

  const recordEvent = useMutation({
    mutationFn: async () =>
      axios.post(`/api/v1/shipments/${shipment.id}/events`, {
        eventType,
        locationName: locationName || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Milestone recorded.");
      setFormOpen(false);
      setLocationName("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["shipment-events", String(shipment.id)] });
      onChanged();
    },
    onError: handleApiError,
  });

  const canRecord = Boolean(access.can?.recordEvent);
  // Pickup and arrival move the status, so only the carrier's coordinators and the assigned driver see them.
  const eventTypes = MANUAL_EVENT_TYPES.filter(
    (type) => access.can?.recordStatusMilestone || !STATUS_MILESTONES.includes(type),
  );

  return (
    <div className="space-y-5">
      {canRecord && (
        <Card>
          <CardHeader className={cn(!formOpen && "pb-5")}>
            <div>
              <CardTitle>Record an operational milestone</CardTitle>
              <CardDescription>Pickup, checkpoints, borders, customs, warehouse and arrival.</CardDescription>
            </div>
            <Button
              variant={formOpen ? "ghost" : "default"}
              aria-expanded={formOpen}
              onClick={() => setFormOpen(!formOpen)}
            >
              {formOpen ? (
                <>
                  <X /> Close
                </>
              ) : (
                <>
                  <Plus /> Record event
                </>
              )}
            </Button>
          </CardHeader>
          {formOpen && (
            <CardContent className="space-y-4">
              <Callout tone="info">
                The structured replacement for a WhatsApp update. A future GPS or customs integration
                would write these same events automatically.
              </Callout>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Milestone">
                  <Select value={eventType} onChange={(event) => setEventType(event.target.value)}>
                    {eventTypes.map((type) => (
                      <option key={type} value={type}>
                        {EVENT_LABELS[type]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Location" optional>
                  <Input
                    icon={<MapPin />}
                    placeholder="e.g. Rusumo Border"
                    value={locationName}
                    onChange={(event) => setLocationName(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Notes" optional>
                <Textarea
                  placeholder='e.g. "Truck crossed Rusumo at 15:42, seals intact"'
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button loading={recordEvent.isPending} onClick={() => recordEvent.mutate()}>
                  {recordEvent.isPending ? "Recording..." : "Record milestone"}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>
              <History className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Timeline
            </CardTitle>
            <CardDescription>Newest first. Every party sees the same record.</CardDescription>
          </div>
        </CardHeader>
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} title="We couldn't load the timeline" />
        ) : isLoading ? (
          <ListSkeleton rows={4} className="border-t border-line/60" />
        ) : (events ?? []).length === 0 ? (
          <EmptyState compact icon={Clock} title="No events recorded yet" className="border-t border-line/60" />
        ) : (
          <CardContent>
            <ol>
              {events!.map((event, index) => {
                const manual = event.source === "manual";
                const [SystemIcon, tone] = SYSTEM_EVENT_LOOK[event.eventType] ?? [Bot, "neutral"];
                return (
                  <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {index < events!.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] border-l border-dashed border-line-strong"
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        manual ? "bg-primary-500 text-white shadow-brand" : cn("ring-1 ring-inset", TONE_TILE[tone]),
                      )}
                    >
                      {manual ? (
                        <MapPin className="h-4 w-4" aria-hidden />
                      ) : (
                        <SystemIcon className="h-4 w-4" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="text-label font-semibold text-ink">
                          {EVENT_LABELS[event.eventType] ?? event.eventType}
                          {manual ? (
                            <Tooltip
                              className="ml-2 align-[1px]"
                              content="Added by hand by a shipment party, usually from the road. Untagged entries are logged automatically by Gobi."
                            >
                              <Badge className="px-2 py-0 text-[0.6875rem]">Reported</Badge>
                            </Tooltip>
                          ) : (
                            <span className="sr-only"> (logged automatically)</span>
                          )}
                        </p>
                        <time
                          dateTime={event.occurredAt}
                          title={formatDateTime(event.occurredAt)}
                          className="text-caption text-ink-muted"
                        >
                          {formatDateTime(event.occurredAt)}
                          <span className="hidden sm:inline"> · {formatRelative(event.occurredAt)}</span>
                        </time>
                      </div>
                      {(event.locationName || event.actor) && (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-ink-muted">
                          {event.locationName && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" aria-hidden /> {event.locationName}
                            </span>
                          )}
                          {event.actor && (
                            <span className="inline-flex items-center gap-1">
                              <UserIcon className="h-3 w-3" aria-hidden /> {fullName(event.actor)}
                            </span>
                          )}
                        </p>
                      )}
                      {event.notes && (
                        <p className="tile mt-2 rounded-inset px-3 py-2 text-body text-ink-secondary">
                          {event.notes}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
