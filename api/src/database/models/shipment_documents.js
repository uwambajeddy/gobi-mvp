"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class shipment_documents extends Model {
    static associate({ shipments, users }) {
      this.belongsTo(shipments, { foreignKey: "shipmentId", as: "shipment" });
      this.belongsTo(users, { foreignKey: "uploadedByUserId", as: "uploadedBy" });
      this.belongsTo(users, { foreignKey: "verifiedByUserId", as: "verifiedBy" });
    }
  }

  shipment_documents.init(
    {
      shipmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      docType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mandatory: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      fileName: DataTypes.STRING,
      fileUrl: DataTypes.STRING,
      status: {
        type: DataTypes.ENUM("required", "uploaded", "verified", "rejected"),
        allowNull: false,
        defaultValue: "required",
      },
      rejectionReason: DataTypes.TEXT,
      uploadedByUserId: DataTypes.INTEGER,
      uploadedAt: DataTypes.DATE,
      verifiedByUserId: DataTypes.INTEGER,
      verifiedAt: DataTypes.DATE,
      expiresAt: DataTypes.DATEONLY,
    },
    {
      sequelize,
      modelName: "shipment_documents",
    },
  );
  return shipment_documents;
};
