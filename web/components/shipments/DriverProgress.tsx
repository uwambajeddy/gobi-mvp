"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Flag, MapPin, Navigation, PackageCheck, Play, Truck, type LucideIcon } from "lucide-react";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Callout } from "@/components/ui/feedback";
import { isSharingRelevant, useDriverTracker } from "@/components/driver/DriverBackgroundTracker";
import { SHARING_STATE } from "@/components/driver/LocationSharingMenu";
import { handleApiError } from "@/lib/handleApiError";
import { isTrackingActive } from "@/lib/shipments";
import { cn, formatDateTime, formatRelative, fullName } from "@/lib/utils";
import { Shipment, ShipmentAccess, ShipmentEvent, ShipmentStatus } from "@/types";

type StepKey = "en_route_to_pickup" | "arrived_pickup" | "picked_up" | "arrived_destination" | "delivered";

const STEPS: {
  key: StepKey;
  label: string;
  icon: LucideIcon;
  action: string;
  hint: string;
  place?: "origin" | "destination";
}[] = [
  {
    key: "en_route_to_pickup",
    label: "Going to pickup",
    icon: Navigation,
    action: "Start trip to pickup",
    hint: "Tap when you set off. Your live location is shared with the shipment's parties until you arrive.",
  },
  {
    key: "arrived_pickup",
    label: "Arrived at pickup",
    icon: MapPin,
    action: "Arrived at pickup",
    hint: "Tap when you reach the pickup point.",
    place: "origin",
  },
  {
    key: "picked_up",
    label: "In transit",
    icon: Truck,
    action: "Cargo loaded, start transit",
    hint: "Tap once the cargo is on board and you are leaving.",
    place: "origin",
  },
  {
    key: "arrived_destination",
    label: "Arrived at destination",
    icon: Flag,
    action: "Arrived at destination",
    hint: "Tap when you reach the delivery address.",
    place: "destination",
  },
  {
    key: "delivered",
    label: "Delivered",
    icon: PackageCheck,
    action: "Confirm delivery",
    hint: "Enter who received the cargo. The shipper then confirms receipt.",
  },
];

const AFTER_PICKUP: ShipmentStatus[] = ["in_transit", "arrived", "delivered", "completed"];
const AFTER_ARRIVAL: ShipmentStatus[] = ["arrived", "delivered", "completed"];
const AFTER_DELIVERY: ShipmentStatus[] = ["delivered", "completed"];

export const DRIVER_PROGRESS_STATUSES: ShipmentStatus[] = ["execution_assigned", ...AFTER_PICKUP];

/**
 * Which steps are done, and when. Status alone can't tell "going to pickup"
 * from "at pickup" (both are execution_assigned), so those come from the trip
 * start and the timeline, as the old driver app derived "picked up" from
 * pickedUpAt. A recorded event always counts, as it does for the API's
 * "already recorded" check. A step skipped by a coordinator counts as done
 * once a later one is.
 */
function progressOf(shipment: Shipment, events: ShipmentEvent[]) {
  const at = (type: string) => events.find((event) => event.eventType === type)?.occurredAt ?? null;
  const pastPickup = AFTER_PICKUP.includes(shipment.status);
  return {
    en_route_to_pickup: {
      done: Boolean(shipment.startTime || at("en_route_to_pickup")) || pastPickup,
      at: at("en_route_to_pickup") ?? shipment.startTime ?? null,
    },
    arrived_pickup: { done: Boolean(at("arrived_pickup")) || pastPickup, at: at("arrived_pickup") },
    picked_up: { done: pastPickup, at: at("picked_up") },
    arrived_destination: { done: AFTER_ARRIVAL.includes(shipment.status), at: at("arrived_destination") },
    delivered: { done: AFTER_DELIVERY.includes(shipment.status), at: at("pod_captured") ?? shipment.podCapturedAt ?? null },
  } satisfies Record<StepKey, { done: boolean; at: string | null }>;
}

function LocationSharingNote() {
  const tracker = useDriverTracker();
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  if (!isSharingRelevant(tracker)) return null;

  if (tracker.state === "active") {
    return (
      <p className="flex items-center gap-2 text-caption text-ink-secondary">
        <span aria-hidden className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-success" />
        Sharing your live location with the shipment&apos;s parties
        {tracker.lastSendAt && ` · last sent ${formatRelative(new Date(tracker.lastSendAt).toISOString())}`}
      </p>
    );
  }

  const look = SHARING_STATE[tracker.state as keyof typeof SHARING_STATE];
  return (
    <Callout
      tone={look.tone === "danger" ? "danger" : "warning"}
      title={look.label}
      action={
        tracker.state === "disabled" && (
          <Button size="sm" onClick={() => tracker.setEnabled(true)}>
            <Play /> Resume sharing
          </Button>
        )
      }
    >
      {look.help}
    </Callout>
  );
}

export function DriverProgress({
  shipment,
  access,
  onChanged,
}: {
  shipment: Shipment;
  access: ShipmentAccess;
  onChanged: () => void;
}) {
  const axios = useAxiosAuth();
  const [recipient, setRecipient] = useState("");
  const [podNotes, setPodNotes] = useState("");

  const { data: events = [], isSuccess: eventsLoaded } = useQuery({
    queryKey: ["shipment-events", String(shipment.id)],
    queryFn: async () =>
      (await axios.get(`/api/v1/shipments/${shipment.id}/events`)).data.data.events as ShipmentEvent[],
  });

  const progress = progressOf(shipment, events);
  const nextIndex = STEPS.findIndex((step) => !progress[step.key].done);
  const next = nextIndex === -1 ? null : STEPS[nextIndex];
  const lastDone = [...STEPS].reverse().find((step) => progress[step.key].done);

  const isDriver = access.isAssignedDriver;
  const canAct =
    isDriver &&
    eventsLoaded &&
    (next?.key === "delivered"
      ? Boolean(access.can?.capturePod)
      : Boolean(access.can?.recordEvent && access.can?.recordStatusMilestone));

  const record = useMutation({
    mutationFn: async (step: (typeof STEPS)[number]) =>
      axios.post(`/api/v1/shipments/${shipment.id}/events`, {
        eventType: step.key,
        locationName:
          step.place === "origin"
            ? shipment.originAddress
            : step.place === "destination"
              ? shipment.destinationAddress
              : undefined,
      }),
    onSuccess: (_, step) => {
      toast.success(`${step.label}. Everyone on the shipment has been notified.`);
      onChanged();
    },
    onError: handleApiError,
  });

  const deliver = useMutation({
    mutationFn: async () =>
      axios.post(`/api/v1/shipments/${shipment.id}/pod`, {
        podRecipientName: recipient.trim(),
        podNotes: podNotes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Delivery confirmed. The shipper has been asked to confirm receipt.");
      onChanged();
    },
    onError: handleApiError,
  });

  const driverName = fullName(shipment.assignedDriver) || "The driver";

  return (
    <Card className="mt-5">
      <CardHeader className="pb-4">
        <div>
          <CardTitle>
            <Truck className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden />{" "}
            {isDriver ? "Your trip" : "Driver progress"}
          </CardTitle>
          <CardDescription>
            {isDriver
              ? "Tap the button at each stop. The shipper and carrier are notified straight away."
              : lastDone
                ? `${driverName}: ${lastDone.label.toLowerCase()}${
                    progress[lastDone.key].at ? `, ${formatRelative(progress[lastDone.key].at)}` : ""
                  }.`
                : `${driverName} hasn't set off yet.`}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-1">
          <ol aria-label="Driver progress" className="grid min-w-[30rem] grid-cols-5">
            {STEPS.map((step, index) => {
              const { done, at } = progress[step.key];
              const isCurrent = index === nextIndex;
              const Icon = step.icon;
              return (
                <li
                  key={step.key}
                  aria-current={isCurrent ? "step" : undefined}
                  className="relative flex flex-col items-center text-center"
                >
                  {index > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-[19px] h-0.5 rounded-full",
                        done || isCurrent ? "bg-primary-500" : "bg-line",
                      )}
                      style={{ left: "calc(-50% + 26px)", width: "calc(100% - 52px)" }}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                      done && "border-primary-500 bg-primary-500 text-white",
                      isCurrent && "border-primary-500 bg-surface text-primary-600 ring-4 ring-primary-100",
                      !done && !isCurrent && "border-line-strong bg-surface text-ink-subtle",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
                  </span>
                  <span
                    className={cn(
                      "mt-2 px-1 text-caption leading-4",
                      isCurrent ? "font-semibold text-ink" : done ? "text-ink-secondary" : "text-ink-muted",
                    )}
                  >
                    {step.label}
                  </span>
                  {done && at && (
                    <time dateTime={at} title={formatDateTime(at)} className="mt-0.5 text-[0.6875rem] tabular-nums text-ink-muted">
                      {new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  )}
                  <span className="sr-only">{done ? "(done)" : isCurrent ? "(next)" : "(upcoming)"}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {isDriver && isTrackingActive(shipment) && <LocationSharingNote />}

        {canAct && next && (
          <div className="tile rounded-inset p-4">
            {next.key === "delivered" ? (
              <form
                className="flex flex-col gap-3 md:flex-row md:items-start"
                onSubmit={(event) => {
                  event.preventDefault();
                  deliver.mutate();
                }}
              >
                <Field label="Received by" hint="At least 2 characters." className="md:w-56">
                  <Input placeholder="Recipient name" value={recipient} onChange={(event) => setRecipient(event.target.value)} />
                </Field>
                <Field label="Notes (condition, remarks)" optional className="md:flex-1">
                  <Input
                    placeholder="e.g. Received in full, no damages"
                    value={podNotes}
                    onChange={(event) => setPodNotes(event.target.value)}
                  />
                </Field>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full md:mt-[1.625rem] md:w-auto"
                  disabled={recipient.trim().length < 2}
                  loading={deliver.isPending}
                >
                  <PackageCheck /> {next.action}
                </Button>
              </form>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-body text-ink-secondary">{next.hint}</p>
                <Button
                  size="lg"
                  className="w-full shrink-0 sm:w-auto"
                  loading={record.isPending}
                  onClick={() => record.mutate(next)}
                >
                  <next.icon /> {next.action}
                </Button>
              </div>
            )}
          </div>
        )}

        {isDriver && shipment.status === "delivered" && (
          <p className="text-body text-ink-secondary">Delivered. Waiting for the shipper to confirm receipt.</p>
        )}
        {isDriver && shipment.status === "completed" && (
          <p className="text-body text-ink-secondary">The shipper confirmed receipt. This trip is complete.</p>
        )}
      </CardContent>
    </Card>
  );
}
