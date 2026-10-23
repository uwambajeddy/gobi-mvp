import db from "../database/models";
import { notifyShipmentEvent } from "./notifications.service";

const { shipment_events } = db;

export const recordSystemEvent = async (
  shipmentId,
  eventType,
  { req, notes, metadata, locationName, occurredAt } = {},
) => {
  const event = await shipment_events.create({
    shipmentId,
    eventType,
    actorUserId: req?.user?.id ?? null,
    occurredAt: occurredAt || new Date(),
    locationName,
    notes,
    metadata,
    source: "system",
  });

  notifyShipmentEvent(eventType, { shipmentId, actorUserId: req?.user?.id ?? null, metadata });

  return event;
};
