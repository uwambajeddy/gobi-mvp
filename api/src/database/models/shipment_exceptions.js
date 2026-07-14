"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class shipment_exceptions extends Model {
    static associate({ shipments, users }) {
      this.belongsTo(shipments, { foreignKey: "shipmentId", as: "shipment" });
      this.belongsTo(users, { foreignKey: "openedByUserId", as: "openedBy" });
      this.belongsTo(users, { foreignKey: "resolvedByUserId", as: "resolvedBy" });
    }
  }

  shipment_exceptions.init(
    {
      shipmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM(
          "breakdown",
          "accident",
          "theft",
          "seal_tamper",
          "customs_hold",
          "border_queue",
          "cargo_damage",
          "other",
        ),
        allowNull: false,
      },
      severity: {
        type: DataTypes.ENUM("low", "medium", "high", "critical"),
        allowNull: false,
        defaultValue: "medium",
      },
      status: {
        type: DataTypes.ENUM("open", "investigating", "resolved"),
        allowNull: false,
        defaultValue: "open",
      },
      notes: DataTypes.TEXT,
      resolutionNotes: DataTypes.TEXT,
      openedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      resolvedByUserId: DataTypes.INTEGER,
      resolvedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "shipment_exceptions",
    },
  );
  return shipment_exceptions;
};
