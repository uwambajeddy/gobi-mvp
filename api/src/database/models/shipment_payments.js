"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class shipment_payments extends Model {
    static associate({ shipments, users }) {
      this.belongsTo(shipments, { foreignKey: "shipmentId", as: "shipment" });
      this.belongsTo(users, { foreignKey: "recordedByUserId", as: "recordedBy" });
    }
  }

  shipment_payments.init(
    {
      shipmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM(
          "delivery_order",
          "port_fee",
          "warehouse_fee",
          "border_fee",
          "customs_duty",
          "road_user_charge",
          "other",
        ),
        allowNull: false,
      },
      amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "RWF",
      },
      status: {
        type: DataTypes.ENUM("pending", "paid"),
        allowNull: false,
        defaultValue: "pending",
      },
      proofFileName: DataTypes.STRING,
      proofUrl: DataTypes.STRING,
      notes: DataTypes.TEXT,
      recordedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      paidAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "shipment_payments",
    },
  );
  return shipment_payments;
};
