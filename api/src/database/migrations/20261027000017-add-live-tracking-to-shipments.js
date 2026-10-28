"use strict";
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
