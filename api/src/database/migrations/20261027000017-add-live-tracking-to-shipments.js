"use strict";
/**
 * Live driver tracking: the latest position reported by the assigned driver's
 * browser and a short history of points. Same columns as the commercial
 * platform's deliveries table (currentLocation, lastLocationUpdate, trackings).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("shipments", "currentLocation", { type: Sequelize.JSONB });
    await queryInterface.addColumn("shipments", "lastLocationUpdate", { type: Sequelize.DATE });
    await queryInterface.addColumn("shipments", "trackings", { type: Sequelize.ARRAY(Sequelize.JSONB) });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("shipments", "trackings");
    await queryInterface.removeColumn("shipments", "lastLocationUpdate");
    await queryInterface.removeColumn("shipments", "currentLocation");
  },
};
