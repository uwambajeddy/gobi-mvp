"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class organizations extends Model {
    static associate({ organization_members, vehicles, users }) {
      this.hasMany(organization_members, { foreignKey: "organizationId", as: "members" });
      this.hasMany(vehicles, { foreignKey: "organizationId", as: "vehicles" });
      this.belongsTo(users, { foreignKey: "createdByUserId", as: "createdBy" });
    }
  }

  organizations.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      companyType: {
        type: DataTypes.ENUM("distribution", "transport", "clearing_agent"),
        allowNull: false,
      },
      contactEmail: DataTypes.STRING,
      contactPhone: DataTypes.STRING,
      address: DataTypes.STRING,
      createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "organizations",
    },
  );
  return organizations;
};
