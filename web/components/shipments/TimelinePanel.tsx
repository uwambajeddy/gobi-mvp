"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CircleDot, MapPin, User as UserIcon } from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { handleApiError } from "@/lib/handleApiError";
import { EVENT_LABELS, MANUAL_EVENT_TYPES } from "@/lib/labels";
import { cn, formatDateTime } from "@/lib/utils";
import { Shipment, ShipmentAccess, ShipmentEvent } from "@/types";

const OPERATIONAL_STATUSES = ["execution_assigned", "in_transit", "arrived", "delivered"];

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

  const { data: events, isLoading } = useQuery({
    queryKey: ["shipment-events", String(shipment.id)],
    queryFn: async () =>
      (await axios.get(`/api/v1/shipments/${shipment.id}/events`)).data.data
        .events as ShipmentEvent[],
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

  const canRecord =
    (access.isShipper || access.isCarrier || access.isAgent || access.isAssignedDriver) &&
    OPERATIONAL_STATUSES.includes(shipment.status);

  return (
    <div className="space-y-4">
      {canRecord && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Record operational milestone</CardTitle>
            <Button size="sm" variant={formOpen ? "ghost" : "default"} onClick={() => setFormOpen(!formOpen)}>
              {formOpen ? "Close" : "Record event"}
            </Button>
          </CardHeader>
          {formOpen && (
            <CardContent className="space-y-4">
              <p className="rounded-md bg-blue-50 p-3 text-xs text-blue-800">
                The structured replacement for a WhatsApp update. A future GPS or customs
                integration would write these same events automatically.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Milestone</Label>
                  <select
                    value={eventType}
                    onChange={(event) => setEventType(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    {MANUAL_EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {EVENT_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    placeholder="e.g. Rusumo Border"
                    value={locationName}
                    onChange={(event) => setLocationName(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder='e.g. "Truck crossed Rusumo at 15:42, seals intact"'
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <Button size="sm" disabled={recordEvent.isPending} onClick={() => recordEvent.mutate()}>
                {recordEvent.isPending ? "Recording..." : "Record milestone"}
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-mute">Loading timeline...</p>
          ) : (events ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-mute">No events recorded yet.</p>
          ) : (
            <ol>
              {events!.map((event, index) => (
                <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {index < events!.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[13px] top-7 h-full w-0.5 bg-gray-100"
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      event.source === "system"
                        ? "bg-gray-100 text-gray-500"
                        : "bg-primary-100 text-primary",
                    )}
                  >
                    {event.source === "system" ? (
                      <Bot className="h-3.5 w-3.5" />
                    ) : (
                      <CircleDot className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <p className="text-sm font-medium text-dark">
                        {EVENT_LABELS[event.eventType] ?? event.eventType}
                      </p>
                      <p className="text-xs text-mute">{formatDateTime(event.occurredAt)}</p>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          event.source === "system"
                            ? "bg-gray-100 text-gray-500"
                            : "bg-primary-50 text-primary-700",
                        )}
                      >
                        {event.source}
                      </span>
                    </div>
                    {(event.locationName || event.actor) && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-mute">
                        {event.locationName && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {event.locationName}
                          </span>
                        )}
                        {event.actor && (
                          <span className="flex items-center gap-1">
                            <UserIcon className="h-3 w-3" /> {event.actor.firstName}{" "}
                            {event.actor.lastName}
                          </span>
                        )}
                      </p>
                    )}
                    {event.notes && <p className="mt-1 text-sm text-body-text">{event.notes}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
