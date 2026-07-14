"use strict";
const { EVENT_TYPES } = require("../../config/shipmentEvents");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("shipment_events", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      shipmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "shipments", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      eventType: {
        type: Sequelize.ENUM(...EVENT_TYPES),
        allowNull: false,
      },
      actorUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      occurredAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      locationName: Sequelize.STRING,
      notes: Sequelize.TEXT,
      metadata: Sequelize.JSONB,
      attachments: Sequelize.JSONB,
      source: {
        type: Sequelize.ENUM("manual", "system"),
        allowNull: false,
        defaultValue: "manual",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("shipment_events", ["shipmentId", "occurredAt"]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable("shipment_events");
  },
};
