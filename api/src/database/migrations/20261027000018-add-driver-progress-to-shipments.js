"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("shipments", "startTime", { type: Sequelize.DATE });
    // A fresh database already has the value: the events table is created from config/shipmentEvents.
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_shipment_events_eventType" ADD VALUE IF NOT EXISTS 'arrived_pickup' AFTER 'en_route_to_pickup';`,
    );
  },

  async down(queryInterface) {
    // Postgres can't drop a single enum value; `arrived_pickup` stays in the type, unused.
    await queryInterface.removeColumn("shipments", "startTime");
  },
};
