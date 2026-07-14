"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class organization_members extends Model {
    static associate({ users, organizations }) {
      this.belongsTo(users, { foreignKey: "userId", as: "user" });
      this.belongsTo(organizations, { foreignKey: "organizationId", as: "organization" });
    }
  }

  organization_members.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      organizationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM("owner", "coordinator", "member", "driver"),
        allowNull: false,
        defaultValue: "member",
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "organization_members",
      indexes: [{ unique: true, fields: ["userId", "organizationId"] }],
    },
  );
  return organization_members;
};
