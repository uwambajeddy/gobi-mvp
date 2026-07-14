"use strict";
const { Model } = require("sequelize");
const { EVENT_TYPES } = require("../../config/shipmentEvents");

module.exports = (sequelize, DataTypes) => {
  class shipment_events extends Model {
    static associate({ shipments, users }) {
      this.belongsTo(shipments, { foreignKey: "shipmentId", as: "shipment" });
      this.belongsTo(users, { foreignKey: "actorUserId", as: "actor" });
    }
  }

  shipment_events.init(
    {
      shipmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      eventType: {
        type: DataTypes.ENUM(...EVENT_TYPES),
        allowNull: false,
      },
      actorUserId: DataTypes.INTEGER,
      occurredAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      locationName: DataTypes.STRING,
      notes: DataTypes.TEXT,
      metadata: DataTypes.JSONB,
      attachments: DataTypes.JSONB,
      source: {
        type: DataTypes.ENUM("manual", "system"),
        allowNull: false,
        defaultValue: "manual",
      },
    },
    {
      sequelize,
      modelName: "shipment_events",
    },
  );
  return shipment_events;
};
