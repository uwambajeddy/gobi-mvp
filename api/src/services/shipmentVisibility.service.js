import { checkShipmentPolicy } from "./shipmentAccess.service";

/**
 * Field-level visibility on shipment responses. Authorization decides who
 * may open a shipment; this decides what they see inside it. Today that is
 * money: quotes and payment amounts reach only FINANCIAL_VIEWERS
 * (config/shipmentPolicies), never the assigned driver.
 */

const QUOTE_FIELDS = ["quoteAmount", "quoteCurrency"];

/** Timeline events whose notes or metadata carry amounts. */
const FINANCIAL_EVENTS = ["quote_approved", "payment_recorded"];

const humanize = (value = "") => String(value).replace(/_/g, " ");

/** Whether this caller may see quotes and payment amounts on the shipment. */
export const canSeeFinancials = (shipment, access) =>
  !checkShipmentPolicy("viewFinancials", shipment, access);

/** The shipment as JSON, without its quote for callers who may not see money. */
export const presentShipment = (shipment, access) => {
  const json = shipment.toJSON();
  if (!canSeeFinancials(shipment, access)) {
    QUOTE_FIELDS.forEach((field) => delete json[field]);
  }
  return json;
};

/**
 * Timeline events as JSON. For callers who may not see money, amounts are
 * dropped from quote and payment events: a payment keeps only its type.
 */
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
