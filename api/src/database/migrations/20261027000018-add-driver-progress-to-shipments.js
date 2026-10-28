"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("shipments", "startTime", { type: Sequelize.DATE });
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_shipment_events_eventType" ADD VALUE IF NOT EXISTS 'arrived_pickup' AFTER 'en_route_to_pickup';`,
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("shipments", "startTime");
  },
};
