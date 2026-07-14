"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("activity_logs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      actorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      actorRole: Sequelize.STRING,
      organizationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "organizations", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      entityType: Sequelize.STRING,
      entityId: Sequelize.INTEGER,
      description: Sequelize.TEXT,
      metadata: Sequelize.JSONB,
      ipAddress: Sequelize.STRING,
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("activity_logs", ["entityType", "entityId"]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable("activity_logs");
  },
};
