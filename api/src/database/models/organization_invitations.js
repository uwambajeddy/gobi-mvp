"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class organization_invitations extends Model {
    static associate({ organizations, users }) {
      this.belongsTo(organizations, { foreignKey: "organizationId", as: "organization" });
      this.belongsTo(users, { foreignKey: "invitedByUserId", as: "invitedBy" });
      this.belongsTo(users, { foreignKey: "acceptedByUserId", as: "acceptedBy" });
    }

    get isExpired() {
      return this.status === "pending" && new Date(this.expiresAt) < new Date();
    }

    toJSON() {
      const values = { ...this.get() };
      delete values.tokenHash;
      if (this.isExpired) values.status = "expired";
      return values;
    }
  }

  organization_invitations.init(
    {
      organizationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM("owner", "coordinator", "member", "driver"),
        allowNull: false,
      },
      tokenHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("pending", "accepted", "revoked"),
        allowNull: false,
        defaultValue: "pending",
      },
      invitedByUserId: DataTypes.INTEGER,
      acceptedByUserId: DataTypes.INTEGER,
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      acceptedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "organization_invitations",
    },
  );
  return organization_invitations;
};
