"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class shipment_packages extends Model {
    static associate({ shipments }) {
      this.belongsTo(shipments, { foreignKey: "shipmentId", as: "shipment" });
    }
  }

  shipment_packages.init(
    {
      shipmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      weightKg: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
    },
    {
      sequelize,
      modelName: "shipment_packages",
    },
  );
  return shipment_packages;
};
