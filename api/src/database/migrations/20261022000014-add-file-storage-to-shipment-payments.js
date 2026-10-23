"use strict";
/**
 * Real proof-of-payment files, stored like document files: the Cloudinary
 * public id and resource type plus the file's type and size. Seeded and older
 * rows keep these null, which the API reports as "no proof file stored".
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("shipment_payments", "proofFileKey", { type: Sequelize.STRING });
    await queryInterface.addColumn("shipment_payments", "proofResourceType", { type: Sequelize.STRING(16) });
    await queryInterface.addColumn("shipment_payments", "proofMimeType", { type: Sequelize.STRING(100) });
    await queryInterface.addColumn("shipment_payments", "proofFileSize", { type: Sequelize.INTEGER });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("shipment_payments", "proofFileSize");
    await queryInterface.removeColumn("shipment_payments", "proofMimeType");
    await queryInterface.removeColumn("shipment_payments", "proofResourceType");
    await queryInterface.removeColumn("shipment_payments", "proofFileKey");
  },
};
