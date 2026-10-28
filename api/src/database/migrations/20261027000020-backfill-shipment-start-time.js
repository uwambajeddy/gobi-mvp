"use strict";
/**
 * Shipments whose driver recorded "En route to pickup" before `startTime`
 * existed: stamp the trip start from that event, so the driver's progress
 * card, live tracking and the API's "already recorded" check all agree.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE shipments AS s
      SET "startTime" = e."firstAt"
      FROM (
        SELECT "shipmentId", MIN("occurredAt") AS "firstAt"
        FROM shipment_events
        WHERE "eventType" = 'en_route_to_pickup'
        GROUP BY "shipmentId"
      ) AS e
      WHERE s.id = e."shipmentId" AND s."startTime" IS NULL;
    `);
  },

  async down() {
    // Nothing to undo: the stamped times match the recorded events.
  },
};
