import { checkShipmentPolicy } from "./shipmentAccess.service";

/**
 * Field-level visibility on shipment responses. Authorization decides who
 * may open a shipment; this decides what they see inside it. Today that is
 * money: quotes and payment amounts reach only FINANCIAL_VIEWERS
 * (config/shipmentPolicies), never the assigned driver.
 */

const QUOTE_FIELDS = ["quoteAmount", "quoteCurrency"];

const FINANCIAL_EVENTS = ["quote_approved", "payment_recorded"];

const humanize = (value = "") => String(value).replace(/_/g, " ");

export const canSeeFinancials = (shipment, access) =>
  !checkShipmentPolicy("viewFinancials", shipment, access);

export const presentShipment = (shipment, access) => {
  const json = shipment.toJSON();
  if (!canSeeFinancials(shipment, access)) {
    QUOTE_FIELDS.forEach((field) => delete json[field]);
  }
  return json;
};

export const presentEvents = (events, shipment, access) => {
  if (canSeeFinancials(shipment, access)) return events;

  return events.map((event) => {
    const json = event.toJSON();
    if (!FINANCIAL_EVENTS.includes(json.eventType)) return json;

    const type = json.metadata?.type;
    return {
      ...json,
      notes: json.eventType === "payment_recorded" && type ? humanize(type) : null,
      metadata: type ? { type } : null,
    };
  });
};
