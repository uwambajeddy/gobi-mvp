"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class driver_profiles extends Model {
    static associate({ users }) {
      this.belongsTo(users, { foreignKey: "userId", as: "user" });
    }
  }

  driver_profiles.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      licenceNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      licenceExpiresAt: DataTypes.DATEONLY,
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
    },
    {
      sequelize,
      modelName: "driver_profiles",
    },
  );
  return driver_profiles;
};
