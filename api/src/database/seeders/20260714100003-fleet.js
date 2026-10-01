"use strict";
const now = new Date();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // driver@gobi.rw: fully compliant. driver2@gobi.rw: licence EXPIRED
    // (demonstrates the compliance gate blocking an assignment).
    await queryInterface.bulkInsert("driver_profiles", [
      {
        id: 1,
        userId: 5,
        licenceNumber: "RW-DL-2023-04821",
        licenceExpiresAt: "2027-06-30",
        status: "approved",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        userId: 6,
        licenceNumber: "RW-DL-2019-11937",
        licenceExpiresAt: "2025-01-31",
        status: "approved",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Fleet: one fully compliant truck, one with expired insurance (gate demo),
    // one van with no COMESA Yellow Card on file (cross-border warning).
    await queryInterface.bulkInsert("vehicles", [
      {
        id: 1,
        organizationId: 2,
        plateNumber: "RAE 001 T",
        model: "Mercedes Actros 2545",
        type: "truck",
        capacityKg: 30000,
        insuranceExpiresAt: "2027-03-31",
        inspectionExpiresAt: "2027-01-31",
        yellowCardExpiresAt: "2026-12-31",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        organizationId: 2,
        plateNumber: "RAE 002 T",
        model: "Scania R450",
        type: "truck",
        capacityKg: 25000,
        insuranceExpiresAt: "2025-06-30",
        inspectionExpiresAt: "2027-01-31",
        yellowCardExpiresAt: "2026-12-31",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 3,
        organizationId: 2,
        plateNumber: "RAE 003 V",
        model: "Toyota Dyna",
        type: "van",
        capacityKg: 3500,
        insuranceExpiresAt: "2027-05-31",
        inspectionExpiresAt: "2026-11-30",
        yellowCardExpiresAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await queryInterface.sequelize.query(
      `SELECT setval(pg_get_serial_sequence('driver_profiles', 'id'), (SELECT MAX(id) FROM driver_profiles));`,
    );
    await queryInterface.sequelize.query(
      `SELECT setval(pg_get_serial_sequence('vehicles', 'id'), (SELECT MAX(id) FROM vehicles));`,
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("vehicles", null, {});
    await queryInterface.bulkDelete("driver_profiles", null, {});
  },
};
