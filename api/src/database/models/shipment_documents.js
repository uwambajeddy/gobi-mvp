"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class shipment_documents extends Model {
    static associate({ shipments, users }) {
      this.belongsTo(shipments, { foreignKey: "shipmentId", as: "shipment" });
      this.belongsTo(users, { foreignKey: "uploadedByUserId", as: "uploadedBy" });
      this.belongsTo(users, { foreignKey: "verifiedByUserId", as: "verifiedBy" });
    }

    /**
     * Storage details stay server-side; clients get `hasFile` and fetch a signed link.
     * `fileUrl` only holds legacy and seeded links, which would bypass that check.
     */
    toJSON() {
      const values = { ...this.get() };
      values.hasFile = Boolean(values.fileKey);
      delete values.fileKey;
      delete values.fileResourceType;
      delete values.fileUrl;
      return values;
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
      fileKey: DataTypes.STRING,
      fileResourceType: DataTypes.STRING,
      fileMimeType: DataTypes.STRING,
      fileSize: DataTypes.INTEGER,
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
