"use strict";
const { Model } = require("sequelize");
const { SHIPMENT_STATUSES } = require("../../config/shipmentLifecycle");

module.exports = (sequelize, DataTypes) => {
  class shipments extends Model {
    static associate({
      organizations,
      users,
      vehicles,
      shipment_packages,
      shipment_documents,
      shipment_events,
      shipment_payments,
      shipment_exceptions,
    }) {
      this.belongsTo(organizations, { foreignKey: "distributionOrgId", as: "distributionOrg" });
      this.belongsTo(organizations, { foreignKey: "transportOrgId", as: "transportOrg" });
      this.belongsTo(organizations, { foreignKey: "clearingAgentOrgId", as: "clearingAgentOrg" });
      this.belongsTo(users, { foreignKey: "createdByUserId", as: "createdBy" });
      this.belongsTo(users, { foreignKey: "assignedDriverId", as: "assignedDriver" });
      this.belongsTo(vehicles, { foreignKey: "assignedVehicleId", as: "assignedVehicle" });
      this.hasMany(shipment_packages, { foreignKey: "shipmentId", as: "packages" });
      this.hasMany(shipment_documents, { foreignKey: "shipmentId", as: "documents" });
      this.hasMany(shipment_events, { foreignKey: "shipmentId", as: "events" });
      this.hasMany(shipment_payments, { foreignKey: "shipmentId", as: "payments" });
      this.hasMany(shipment_exceptions, { foreignKey: "shipmentId", as: "exceptions" });
    }
  }

  shipments.init(
    {
      reference: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      distributionOrgId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      transportOrgId: DataTypes.INTEGER,
      clearingAgentOrgId: DataTypes.INTEGER,
      createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      assignedDriverId: DataTypes.INTEGER,
      assignedVehicleId: DataTypes.INTEGER,
      originAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      destinationAddress: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isCrossBorder: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      recipientName: DataTypes.STRING,
      recipientPhone: DataTypes.STRING,
      quoteAmount: DataTypes.FLOAT,
      quoteCurrency: {
        type: DataTypes.STRING,
        defaultValue: "RWF",
      },
      quoteApprovedAt: DataTypes.DATE,
      status: {
        type: DataTypes.ENUM(...SHIPMENT_STATUSES),
        allowNull: false,
        defaultValue: "draft",
      },
      podRecipientName: DataTypes.STRING,
      podNotes: DataTypes.TEXT,
      podCapturedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "shipments",
    },
  );
  return shipments;
};
