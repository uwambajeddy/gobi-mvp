"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class vehicles extends Model {
    static associate({ organizations }) {
      this.belongsTo(organizations, { foreignKey: "organizationId", as: "organization" });
    }
  }

  vehicles.init(
    {
      organizationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      plateNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      model: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("truck", "van", "trailer", "pickup"),
        allowNull: false,
      },
      capacityKg: DataTypes.FLOAT,
      // Compliance fields feeding the assignment gate
      insuranceExpiresAt: DataTypes.DATEONLY,
      inspectionExpiresAt: DataTypes.DATEONLY,
      yellowCardExpiresAt: DataTypes.DATEONLY,
    },
    {
      sequelize,
      modelName: "vehicles",
    },
  );
  return vehicles;
};
