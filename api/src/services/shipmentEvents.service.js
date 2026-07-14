import db from "../database/models";

const { shipment_events } = db;

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
