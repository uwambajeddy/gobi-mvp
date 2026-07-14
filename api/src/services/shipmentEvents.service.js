import db from "../database/models";

const { shipment_events } = db;

/**
 * Writes a system-sourced operational event onto the shipment timeline.
 * Platform actions (submit, assign, verify, POD, ...) call this so the
 * timeline is complete even before any manual milestone is recorded.
 */
export const recordSystemEvent = async (
  shipmentId,
  eventType,
  { req, notes, metadata, locationName, occurredAt } = {},
) =>
  shipment_events.create({
    shipmentId,
    eventType,
    actorUserId: req?.user?.id ?? null,
    occurredAt: occurredAt || new Date(),
    locationName,
    notes,
    metadata,
    source: "system",
  });
