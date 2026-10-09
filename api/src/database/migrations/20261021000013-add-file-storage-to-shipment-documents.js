"use strict";
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("shipment_documents", "fileKey", { type: Sequelize.STRING });
    await queryInterface.addColumn("shipment_documents", "fileResourceType", { type: Sequelize.STRING(16) });
    await queryInterface.addColumn("shipment_documents", "fileMimeType", { type: Sequelize.STRING(100) });
    await queryInterface.addColumn("shipment_documents", "fileSize", { type: Sequelize.INTEGER });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("shipment_documents", "fileSize");
    await queryInterface.removeColumn("shipment_documents", "fileMimeType");
    await queryInterface.removeColumn("shipment_documents", "fileResourceType");
    await queryInterface.removeColumn("shipment_documents", "fileKey");
  },
};
