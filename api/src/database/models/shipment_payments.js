"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class shipment_payments extends Model {
    static associate({ shipments, users }) {
      this.belongsTo(shipments, { foreignKey: "shipmentId", as: "shipment" });
      this.belongsTo(users, { foreignKey: "recordedByUserId", as: "recordedBy" });
    }

    /** Storage details stay server-side; clients get `hasProof` and fetch a signed link. */
    toJSON() {
      const values = { ...this.get() };
      values.hasProof = Boolean(values.proofFileKey);
      delete values.proofFileKey;
      delete values.proofResourceType;
      return values;
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
      proofFileKey: DataTypes.STRING,
      proofResourceType: DataTypes.STRING,
      proofMimeType: DataTypes.STRING,
      proofFileSize: DataTypes.INTEGER,
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
