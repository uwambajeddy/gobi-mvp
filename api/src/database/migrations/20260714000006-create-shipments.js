"use strict";
const { SHIPMENT_STATUSES } = require("../../config/shipmentLifecycle");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("shipments", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      reference: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      distributionOrgId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      transportOrgId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "organizations", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      clearingAgentOrgId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "organizations", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      createdByUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      assignedDriverId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      assignedVehicleId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "vehicles", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      originAddress: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      destinationAddress: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      isCrossBorder: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      recipientName: Sequelize.STRING,
      recipientPhone: Sequelize.STRING,
      quoteAmount: Sequelize.FLOAT,
      quoteCurrency: {
        type: Sequelize.STRING,
        defaultValue: "RWF",
      },
      quoteApprovedAt: Sequelize.DATE,
      status: {
        type: Sequelize.ENUM(...SHIPMENT_STATUSES),
        allowNull: false,
        defaultValue: "draft",
      },
      podRecipientName: Sequelize.STRING,
      podNotes: Sequelize.TEXT,
      podCapturedAt: Sequelize.DATE,
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("shipments");
  },
};
