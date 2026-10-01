"use strict";
/**
 * Shipment document catalogue: 10 types condensed from the commercial
 * 24-type catalogue, keeping one representative set per bucket.
 *
 * `crossBorderOnly` documents are only added to the checklist when the
 * shipment is flagged as cross-border.
 *
 * CommonJS so both sequelize-cli (plain node) and the Babel app can load it.
 */

const DOCUMENT_BUCKETS = {
  COMMERCIAL: "commercial",
  CUSTOMS: "customs",
  CORRIDOR: "corridor",
  POD: "pod",
};

const DOCUMENT_TYPES = [
  {
    docType: "commercial_invoice",
    label: "Commercial Invoice",
    bucket: DOCUMENT_BUCKETS.COMMERCIAL,
    mandatory: true,
    crossBorderOnly: false,
    responsibleParty: "shipper",
  },
  {
    docType: "packing_list",
    label: "Packing List",
    bucket: DOCUMENT_BUCKETS.COMMERCIAL,
    mandatory: true,
    crossBorderOnly: false,
    responsibleParty: "shipper",
  },
  {
    docType: "certificate_of_origin",
    label: "Certificate of Origin",
    bucket: DOCUMENT_BUCKETS.COMMERCIAL,
    mandatory: true,
    crossBorderOnly: true,
    responsibleParty: "shipper",
  },
  {
    docType: "insurance_certificate",
    label: "Insurance Certificate",
    bucket: DOCUMENT_BUCKETS.COMMERCIAL,
    mandatory: true,
    crossBorderOnly: false,
    responsibleParty: "shipper",
  },
  {
    docType: "import_declaration_form",
    label: "Import Declaration Form (IDF)",
    bucket: DOCUMENT_BUCKETS.CUSTOMS,
    mandatory: true,
    crossBorderOnly: true,
    responsibleParty: "clearing_agent",
  },
  {
    docType: "duty_payment_receipt",
    label: "Duty Payment Receipt",
    bucket: DOCUMENT_BUCKETS.CUSTOMS,
    mandatory: true,
    crossBorderOnly: true,
    responsibleParty: "clearing_agent",
  },
  {
    docType: "release_order",
    label: "Release Order",
    bucket: DOCUMENT_BUCKETS.CUSTOMS,
    mandatory: true,
    crossBorderOnly: true,
    responsibleParty: "clearing_agent",
  },
  {
    docType: "comesa_yellow_card",
    label: "COMESA Yellow Card",
    bucket: DOCUMENT_BUCKETS.CORRIDOR,
    mandatory: true,
    crossBorderOnly: true,
    responsibleParty: "carrier",
  },
  {
    docType: "c2_transit_manifest",
    label: "C2 / Transit Manifest",
    bucket: DOCUMENT_BUCKETS.CORRIDOR,
    mandatory: true,
    crossBorderOnly: true,
    responsibleParty: "carrier",
  },
  {
    docType: "signed_delivery_note",
    label: "Signed Delivery Note",
    bucket: DOCUMENT_BUCKETS.POD,
    mandatory: false,
    crossBorderOnly: false,
    responsibleParty: "carrier",
  },
];

const DOCUMENT_TYPE_KEYS = DOCUMENT_TYPES.map((doc) => doc.docType);

/** The checklist rows to seed for a given shipment. */
const checklistForShipment = (isCrossBorder) =>
  DOCUMENT_TYPES.filter((doc) => !doc.crossBorderOnly || isCrossBorder);

const getDocumentType = (docType) => DOCUMENT_TYPES.find((doc) => doc.docType === docType);

module.exports = {
  DOCUMENT_BUCKETS,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_KEYS,
  checklistForShipment,
  getDocumentType,
};
