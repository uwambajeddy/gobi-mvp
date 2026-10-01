"use strict";
const daysAgo = (n, hours = 0) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);
const now = new Date();

/**
 * Demo shipments across the lifecycle:
 *  1 GB-2026-0001 completed  (domestic, full history incl. POD)
 *  2 GB-2026-0002 in_transit (cross-border, mid-corridor)
 *  3 GB-2026-0003 awaiting_documents (rejected doc blocks the gate)
 *  4 GB-2026-0004 submitted  (quote awaiting approval)
 *  5 GB-2026-0005 draft
 *
 * Orgs: 1 = Kigali Distribution (shipper), 2 = TransAfrica (carrier),
 *       3 = ClearFast (clearing agent)
 * Users: 2 shipper, 3 carrier owner, 4 coordinator, 5 driver, 7 agent
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert("shipments", [
      {
        id: 1,
        reference: "GB-2026-0001",
        title: "Retail stock replenishment: Kigali to Musanze",
        distributionOrgId: 1,
        transportOrgId: 2,
        clearingAgentOrgId: null,
        createdByUserId: 2,
        assignedDriverId: 5,
        assignedVehicleId: 3,
        originAddress: "Kigali Distribution warehouse, Gikondo",
        destinationAddress: "Musanze Retail Center, Northern Province",
        isCrossBorder: false,
        recipientName: "Jean Bosco Mugenzi",
        recipientPhone: "+250788200001",
        quoteAmount: 450000,
        quoteCurrency: "RWF",
        quoteApprovedAt: daysAgo(9),
        status: "completed",
        podRecipientName: "Jean Bosco Mugenzi",
        podNotes: "Received in full, no damages.",
        podCapturedAt: daysAgo(6),
        createdAt: daysAgo(10),
        updatedAt: daysAgo(5),
      },
      {
        id: 2,
        reference: "GB-2026-0002",
        title: "Industrial machinery import: Dar es Salaam to Kigali",
        distributionOrgId: 1,
        transportOrgId: 2,
        clearingAgentOrgId: 3,
        createdByUserId: 2,
        assignedDriverId: 5,
        assignedVehicleId: 1,
        originAddress: "Dar es Salaam Port, Tanzania",
        destinationAddress: "Kigali Special Economic Zone, Rwanda",
        isCrossBorder: true,
        recipientName: "Kigali SEZ Receiving",
        recipientPhone: "+250788200002",
        quoteAmount: 8500000,
        quoteCurrency: "RWF",
        quoteApprovedAt: daysAgo(6),
        status: "in_transit",
        createdAt: daysAgo(8),
        updatedAt: now,
      },
      {
        id: 3,
        reference: "GB-2026-0003",
        title: "Pharmaceutical consignment: Mombasa to Kigali",
        distributionOrgId: 1,
        transportOrgId: 2,
        clearingAgentOrgId: 3,
        createdByUserId: 2,
        assignedDriverId: null,
        assignedVehicleId: null,
        originAddress: "Mombasa Port, Kenya",
        destinationAddress: "Kigali Pharmaceutical Depot, Nyarugenge",
        isCrossBorder: true,
        recipientName: "Kigali Pharma Depot",
        recipientPhone: "+250788200003",
        quoteAmount: 6200000,
        quoteCurrency: "RWF",
        quoteApprovedAt: daysAgo(2),
        status: "awaiting_documents",
        createdAt: daysAgo(4),
        updatedAt: daysAgo(1),
      },
      {
        id: 4,
        reference: "GB-2026-0004",
        title: "Construction materials: Kigali to Rubavu",
        distributionOrgId: 1,
        transportOrgId: 2,
        clearingAgentOrgId: null,
        createdByUserId: 2,
        assignedDriverId: null,
        assignedVehicleId: null,
        originAddress: "CIMERWA Depot, Kigali",
        destinationAddress: "Rubavu Construction Site, Western Province",
        isCrossBorder: false,
        recipientName: "Site Manager Rubavu",
        recipientPhone: "+250788200004",
        quoteAmount: 1200000,
        quoteCurrency: "RWF",
        quoteApprovedAt: null,
        status: "submitted",
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
      {
        id: 5,
        reference: "GB-2026-0005",
        title: "Coffee export lot: Huye to Kigali dry port",
        distributionOrgId: 1,
        transportOrgId: null,
        clearingAgentOrgId: null,
        createdByUserId: 2,
        assignedDriverId: null,
        assignedVehicleId: null,
        originAddress: "Huye Coffee Washing Station",
        destinationAddress: "Kigali Dry Port, Masaka",
        isCrossBorder: false,
        recipientName: "",
        recipientPhone: "",
        quoteAmount: null,
        quoteCurrency: "RWF",
        quoteApprovedAt: null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await queryInterface.bulkInsert("shipment_packages", [
      { shipmentId: 1, description: "Mixed retail goods (palletized)", weightKg: 2400, quantity: 1, createdAt: now, updatedAt: now },
      { shipmentId: 2, description: "CNC milling machine", weightKg: 12000, quantity: 1, createdAt: now, updatedAt: now },
      { shipmentId: 2, description: "Spare tooling crates", weightKg: 800, quantity: 4, createdAt: now, updatedAt: now },
      { shipmentId: 3, description: "Refrigerated pharmaceutical pallets", weightKg: 450, quantity: 8, createdAt: now, updatedAt: now },
      { shipmentId: 4, description: "Cement bags (50kg)", weightKg: 50, quantity: 400, createdAt: now, updatedAt: now },
      { shipmentId: 5, description: "Green coffee bags (60kg)", weightKg: 60, quantity: 150, createdAt: now, updatedAt: now },
    ]);

    // ── Documents ────────────────────────────────────────────────────────────
    await queryInterface.bulkInsert("shipment_documents", [
      // Shipment 1 (domestic checklist, all verified)
      { shipmentId: 1, docType: "commercial_invoice", label: "Commercial Invoice", mandatory: true, fileName: "invoice-0001.pdf", fileUrl: "https://files.gobi.local/demo/invoice-0001.pdf", status: "verified", uploadedByUserId: 2, uploadedAt: daysAgo(9), verifiedByUserId: 4, verifiedAt: daysAgo(9, 2), createdAt: daysAgo(9), updatedAt: daysAgo(9) },
      { shipmentId: 1, docType: "packing_list", label: "Packing List", mandatory: true, fileName: "packing-0001.pdf", fileUrl: "https://files.gobi.local/demo/packing-0001.pdf", status: "verified", uploadedByUserId: 2, uploadedAt: daysAgo(9), verifiedByUserId: 4, verifiedAt: daysAgo(9, 2), createdAt: daysAgo(9), updatedAt: daysAgo(9) },
      { shipmentId: 1, docType: "insurance_certificate", label: "Insurance Certificate", mandatory: true, fileName: "insurance-0001.pdf", fileUrl: "https://files.gobi.local/demo/insurance-0001.pdf", status: "verified", uploadedByUserId: 2, uploadedAt: daysAgo(9), verifiedByUserId: 4, verifiedAt: daysAgo(9, 2), expiresAt: "2027-06-30", createdAt: daysAgo(9), updatedAt: daysAgo(9) },
      { shipmentId: 1, docType: "signed_delivery_note", label: "Signed Delivery Note", mandatory: false, fileName: "pod-0001.pdf", fileUrl: "https://files.gobi.local/demo/pod-0001.pdf", status: "verified", uploadedByUserId: 5, uploadedAt: daysAgo(6), verifiedByUserId: 4, verifiedAt: daysAgo(6), createdAt: daysAgo(6), updatedAt: daysAgo(6) },

      // Shipment 2 (cross-border checklist, all verified)
      { shipmentId: 2, docType: "commercial_invoice", label: "Commercial Invoice", mandatory: true, fileName: "invoice-0002.pdf", fileUrl: "https://files.gobi.local/demo/invoice-0002.pdf", status: "verified", uploadedByUserId: 2, uploadedAt: daysAgo(6), verifiedByUserId: 4, verifiedAt: daysAgo(5), createdAt: daysAgo(6), updatedAt: daysAgo(5) },
      { shipmentId: 2, docType: "packing_list", label: "Packing List", mandatory: true, fileName: "packing-0002.pdf", fileUrl: "https://files.gobi.local/demo/packing-0002.pdf", status: "verified", uploadedByUserId: 2, uploadedAt: daysAgo(6), verifiedByUserId: 4, verifiedAt: daysAgo(5), createdAt: daysAgo(6), updatedAt: daysAgo(5) },
      { shipmentId: 2, docType: "certificate_of_origin", label: "Certificate of Origin", mandatory: true, fileName: "coo-0002.pdf", fileUrl: "https://files.gobi.local/demo/coo-0002.pdf", status: "verified", uploadedByUserId: 2, uploadedAt: daysAgo(6), verifiedByUserId: 4, verifiedAt: daysAgo(5), createdAt: daysAgo(6), updatedAt: daysAgo(5) },
      { shipmentId: 2, docType: "insurance_certificate", label: "Insurance Certificate", mandatory: true, fileName: "insurance-0002.pdf", fileUrl: "https://files.gobi.local/demo/insurance-0002.pdf", status: "verified", uploadedByUserId: 2, uploadedAt: daysAgo(6), verifiedByUserId: 4, verifiedAt: daysAgo(5), expiresAt: "2027-03-31", createdAt: daysAgo(6), updatedAt: daysAgo(5) },
      { shipmentId: 2, docType: "import_declaration_form", label: "Import Declaration Form (IDF)", mandatory: true, fileName: "idf-0002.pdf", fileUrl: "https://files.gobi.local/demo/idf-0002.pdf", status: "verified", uploadedByUserId: 7, uploadedAt: daysAgo(5), verifiedByUserId: 4, verifiedAt: daysAgo(5), createdAt: daysAgo(6), updatedAt: daysAgo(5) },
      { shipmentId: 2, docType: "duty_payment_receipt", label: "Duty Payment Receipt", mandatory: true, fileName: "duty-0002.pdf", fileUrl: "https://files.gobi.local/demo/duty-0002.pdf", status: "verified", uploadedByUserId: 7, uploadedAt: daysAgo(5), verifiedByUserId: 4, verifiedAt: daysAgo(5), createdAt: daysAgo(6), updatedAt: daysAgo(5) },
      { shipmentId: 2, docType: "release_order", label: "Release Order", mandatory: true, fileName: "release-0002.pdf", fileUrl: "https://files.gobi.local/demo/release-0002.pdf", status: "verified", uploadedByUserId: 7, uploadedAt: daysAgo(5), verifiedByUserId: 4, verifiedAt: daysAgo(4), createdAt: daysAgo(6), updatedAt: daysAgo(4) },
      { shipmentId: 2, docType: "comesa_yellow_card", label: "COMESA Yellow Card", mandatory: true, fileName: "yellowcard-0002.pdf", fileUrl: "https://files.gobi.local/demo/yellowcard-0002.pdf", status: "verified", uploadedByUserId: 4, uploadedAt: daysAgo(5), verifiedByUserId: 4, verifiedAt: daysAgo(4), expiresAt: "2026-12-31", createdAt: daysAgo(6), updatedAt: daysAgo(4) },
      { shipmentId: 2, docType: "c2_transit_manifest", label: "C2 / Transit Manifest", mandatory: true, fileName: "c2-0002.pdf", fileUrl: "https://files.gobi.local/demo/c2-0002.pdf", status: "verified", uploadedByUserId: 4, uploadedAt: daysAgo(5), verifiedByUserId: 4, verifiedAt: daysAgo(4), createdAt: daysAgo(6), updatedAt: daysAgo(4) },
      { shipmentId: 2, docType: "signed_delivery_note", label: "Signed Delivery Note", mandatory: false, status: "required", createdAt: daysAgo(6), updatedAt: daysAgo(6) },

      // Shipment 3 (awaiting_documents: mixed statuses, one rejected)
      { shipmentId: 3, docType: "commercial_invoice", label: "Commercial Invoice", mandatory: true, fileName: "invoice-0003.pdf", fileUrl: "https://files.gobi.local/demo/invoice-0003.pdf", status: "verified", uploadedByUserId: 2, uploadedAt: daysAgo(2), verifiedByUserId: 4, verifiedAt: daysAgo(1), createdAt: daysAgo(2), updatedAt: daysAgo(1) },
      { shipmentId: 3, docType: "packing_list", label: "Packing List", mandatory: true, fileName: "packing-0003.pdf", fileUrl: "https://files.gobi.local/demo/packing-0003.pdf", status: "uploaded", uploadedByUserId: 2, uploadedAt: daysAgo(1), createdAt: daysAgo(2), updatedAt: daysAgo(1) },
      { shipmentId: 3, docType: "certificate_of_origin", label: "Certificate of Origin", mandatory: true, fileName: "coo-0003-blurry.pdf", fileUrl: "https://files.gobi.local/demo/coo-0003.pdf", status: "rejected", rejectionReason: "Scan is illegible, please re-upload a clear copy.", uploadedByUserId: 2, uploadedAt: daysAgo(1), createdAt: daysAgo(2), updatedAt: daysAgo(1) },
      { shipmentId: 3, docType: "insurance_certificate", label: "Insurance Certificate", mandatory: true, status: "required", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
      { shipmentId: 3, docType: "import_declaration_form", label: "Import Declaration Form (IDF)", mandatory: true, status: "required", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
      { shipmentId: 3, docType: "duty_payment_receipt", label: "Duty Payment Receipt", mandatory: true, status: "required", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
      { shipmentId: 3, docType: "release_order", label: "Release Order", mandatory: true, status: "required", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
      { shipmentId: 3, docType: "comesa_yellow_card", label: "COMESA Yellow Card", mandatory: true, status: "required", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
      { shipmentId: 3, docType: "c2_transit_manifest", label: "C2 / Transit Manifest", mandatory: true, status: "required", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
      { shipmentId: 3, docType: "signed_delivery_note", label: "Signed Delivery Note", mandatory: false, status: "required", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    ]);

    // ── Events ───────────────────────────────────────────────────────────────
    await queryInterface.bulkInsert("shipment_events", [
      // Shipment 1: complete story
      { shipmentId: 1, eventType: "shipment_created", actorUserId: 2, occurredAt: daysAgo(10), source: "system", createdAt: daysAgo(10), updatedAt: daysAgo(10) },
      { shipmentId: 1, eventType: "shipment_submitted", actorUserId: 2, occurredAt: daysAgo(10, 1), source: "system", createdAt: daysAgo(10), updatedAt: daysAgo(10) },
      { shipmentId: 1, eventType: "carrier_assigned", actorUserId: 2, occurredAt: daysAgo(9), notes: "Carrier: TransAfrica Logistics", source: "system", createdAt: daysAgo(9), updatedAt: daysAgo(9) },
      { shipmentId: 1, eventType: "quote_approved", actorUserId: 2, occurredAt: daysAgo(9, 2), metadata: JSON.stringify({ amount: 450000, currency: "RWF" }), source: "system", createdAt: daysAgo(9), updatedAt: daysAgo(9) },
      { shipmentId: 1, eventType: "documents_complete", actorUserId: 4, occurredAt: daysAgo(9, 4), source: "system", createdAt: daysAgo(9), updatedAt: daysAgo(9) },
      { shipmentId: 1, eventType: "execution_assigned", actorUserId: 4, occurredAt: daysAgo(8), notes: "David Niyonzima with RAE 003 V", source: "system", createdAt: daysAgo(8), updatedAt: daysAgo(8) },
      { shipmentId: 1, eventType: "picked_up", actorUserId: 5, occurredAt: daysAgo(7), locationName: "Gikondo warehouse", source: "manual", createdAt: daysAgo(7), updatedAt: daysAgo(7) },
      { shipmentId: 1, eventType: "checkpoint", actorUserId: 5, occurredAt: daysAgo(7, 3), locationName: "Nyirangarama", notes: "Routine stop, cargo secure", source: "manual", createdAt: daysAgo(7), updatedAt: daysAgo(7) },
      { shipmentId: 1, eventType: "arrived_destination", actorUserId: 5, occurredAt: daysAgo(6, -2), locationName: "Musanze Retail Center", source: "manual", createdAt: daysAgo(6), updatedAt: daysAgo(6) },
      { shipmentId: 1, eventType: "pod_captured", actorUserId: 5, occurredAt: daysAgo(6), notes: "Received by Jean Bosco Mugenzi", source: "system", createdAt: daysAgo(6), updatedAt: daysAgo(6) },
      { shipmentId: 1, eventType: "shipment_completed", actorUserId: 2, occurredAt: daysAgo(5), source: "system", createdAt: daysAgo(5), updatedAt: daysAgo(5) },

      // Shipment 2: mid-corridor
      { shipmentId: 2, eventType: "shipment_created", actorUserId: 2, occurredAt: daysAgo(8), source: "system", createdAt: daysAgo(8), updatedAt: daysAgo(8) },
      { shipmentId: 2, eventType: "shipment_submitted", actorUserId: 2, occurredAt: daysAgo(8, 1), source: "system", createdAt: daysAgo(8), updatedAt: daysAgo(8) },
      { shipmentId: 2, eventType: "carrier_assigned", actorUserId: 2, occurredAt: daysAgo(7), notes: "Carrier: TransAfrica Logistics", source: "system", createdAt: daysAgo(7), updatedAt: daysAgo(7) },
      { shipmentId: 2, eventType: "clearing_agent_assigned", actorUserId: 2, occurredAt: daysAgo(7, 1), notes: "Clearing agent: ClearFast Agencies", source: "system", createdAt: daysAgo(7), updatedAt: daysAgo(7) },
      { shipmentId: 2, eventType: "quote_approved", actorUserId: 2, occurredAt: daysAgo(6), metadata: JSON.stringify({ amount: 8500000, currency: "RWF" }), source: "system", createdAt: daysAgo(6), updatedAt: daysAgo(6) },
      { shipmentId: 2, eventType: "documents_complete", actorUserId: 4, occurredAt: daysAgo(4), source: "system", createdAt: daysAgo(4), updatedAt: daysAgo(4) },
      { shipmentId: 2, eventType: "execution_assigned", actorUserId: 4, occurredAt: daysAgo(4, 2), notes: "David Niyonzima with RAE 001 T", source: "system", createdAt: daysAgo(4), updatedAt: daysAgo(4) },
      { shipmentId: 2, eventType: "picked_up", actorUserId: 5, occurredAt: daysAgo(3), locationName: "Dar es Salaam Port", source: "manual", createdAt: daysAgo(3), updatedAt: daysAgo(3) },
      { shipmentId: 2, eventType: "departed_origin", actorUserId: 5, occurredAt: daysAgo(3, 4), locationName: "Dar es Salaam", source: "manual", createdAt: daysAgo(3), updatedAt: daysAgo(3) },
      { shipmentId: 2, eventType: "customs_submitted", actorUserId: 7, occurredAt: daysAgo(2), locationName: "Rusumo Border", notes: "T1 transit declaration lodged", source: "manual", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
      { shipmentId: 2, eventType: "border_approached", actorUserId: 5, occurredAt: daysAgo(1, -3), locationName: "Rusumo Border", source: "manual", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
      { shipmentId: 2, eventType: "border_cleared", actorUserId: 7, occurredAt: daysAgo(1), locationName: "Rusumo Border", notes: "Crossed at 15:42, seals intact", source: "manual", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
      { shipmentId: 2, eventType: "customs_released", actorUserId: 7, occurredAt: daysAgo(1, 4), locationName: "Rusumo Border", source: "manual", createdAt: daysAgo(1), updatedAt: daysAgo(1) },

      // Shipment 3: documents phase
      { shipmentId: 3, eventType: "shipment_created", actorUserId: 2, occurredAt: daysAgo(4), source: "system", createdAt: daysAgo(4), updatedAt: daysAgo(4) },
      { shipmentId: 3, eventType: "shipment_submitted", actorUserId: 2, occurredAt: daysAgo(4, 1), source: "system", createdAt: daysAgo(4), updatedAt: daysAgo(4) },
      { shipmentId: 3, eventType: "carrier_assigned", actorUserId: 2, occurredAt: daysAgo(3), notes: "Carrier: TransAfrica Logistics", source: "system", createdAt: daysAgo(3), updatedAt: daysAgo(3) },
      { shipmentId: 3, eventType: "clearing_agent_assigned", actorUserId: 2, occurredAt: daysAgo(3, 1), notes: "Clearing agent: ClearFast Agencies", source: "system", createdAt: daysAgo(3), updatedAt: daysAgo(3) },
      { shipmentId: 3, eventType: "quote_approved", actorUserId: 2, occurredAt: daysAgo(2), metadata: JSON.stringify({ amount: 6200000, currency: "RWF" }), source: "system", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
      { shipmentId: 3, eventType: "document_uploaded", actorUserId: 2, occurredAt: daysAgo(2, 3), notes: "Commercial Invoice (invoice-0003.pdf)", source: "system", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
      { shipmentId: 3, eventType: "document_verified", actorUserId: 4, occurredAt: daysAgo(1), notes: "Commercial Invoice", source: "system", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
      { shipmentId: 3, eventType: "document_rejected", actorUserId: 4, occurredAt: daysAgo(1, 2), notes: "Certificate of Origin: Scan is illegible, please re-upload a clear copy.", source: "system", createdAt: daysAgo(1), updatedAt: daysAgo(1) },

      // Shipment 4: submitted
      { shipmentId: 4, eventType: "shipment_created", actorUserId: 2, occurredAt: daysAgo(1), source: "system", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
      { shipmentId: 4, eventType: "shipment_submitted", actorUserId: 2, occurredAt: daysAgo(1, 1), source: "system", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
      { shipmentId: 4, eventType: "carrier_assigned", actorUserId: 2, occurredAt: daysAgo(1, 2), notes: "Carrier: TransAfrica Logistics", source: "system", createdAt: daysAgo(1), updatedAt: daysAgo(1) },

      // Shipment 5: draft
      { shipmentId: 5, eventType: "shipment_created", actorUserId: 2, occurredAt: now, source: "system", createdAt: now, updatedAt: now },
    ]);

    // ── Payments ─────────────────────────────────────────────────────────────
    await queryInterface.bulkInsert("shipment_payments", [
      { shipmentId: 1, type: "delivery_order", amount: 25000, currency: "RWF", status: "paid", proofFileName: "do-receipt-0001.pdf", proofUrl: "https://files.gobi.local/demo/do-receipt-0001.pdf", recordedByUserId: 4, paidAt: daysAgo(8), createdAt: daysAgo(8), updatedAt: daysAgo(8) },
      { shipmentId: 2, type: "port_fee", amount: 320000, currency: "RWF", status: "paid", proofFileName: "port-fee-0002.pdf", proofUrl: "https://files.gobi.local/demo/port-fee-0002.pdf", recordedByUserId: 7, paidAt: daysAgo(3), createdAt: daysAgo(3), updatedAt: daysAgo(3) },
      { shipmentId: 2, type: "border_fee", amount: 85000, currency: "RWF", status: "paid", proofFileName: "border-fee-0002.pdf", proofUrl: "https://files.gobi.local/demo/border-fee-0002.pdf", recordedByUserId: 7, paidAt: daysAgo(1), createdAt: daysAgo(1), updatedAt: daysAgo(1) },
      { shipmentId: 2, type: "customs_duty", amount: 1450000, currency: "RWF", status: "pending", notes: "Awaiting assessment notice settlement", recordedByUserId: 7, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    ]);

    // ── Exceptions ───────────────────────────────────────────────────────────
    await queryInterface.bulkInsert("shipment_exceptions", [
      {
        shipmentId: 2,
        type: "border_queue",
        severity: "medium",
        status: "resolved",
        notes: "Long queue at Rusumo, estimated 6h delay.",
        resolutionNotes: "Cleared after 4 hours; schedule impact absorbed.",
        openedByUserId: 5,
        resolvedByUserId: 4,
        resolvedAt: daysAgo(1),
        createdAt: daysAgo(1, -6),
        updatedAt: daysAgo(1),
      },
    ]);

    for (const table of [
      "shipments",
      "shipment_packages",
      "shipment_documents",
      "shipment_events",
      "shipment_payments",
      "shipment_exceptions",
    ]) {
      await queryInterface.sequelize.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id),1) FROM ${table}));`,
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("shipment_exceptions", null, {});
    await queryInterface.bulkDelete("shipment_payments", null, {});
    await queryInterface.bulkDelete("shipment_events", null, {});
    await queryInterface.bulkDelete("shipment_documents", null, {});
    await queryInterface.bulkDelete("shipment_packages", null, {});
    await queryInterface.bulkDelete("shipments", null, {});
  },
};
