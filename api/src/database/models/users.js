"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class users extends Model {
    static associate({ organization_members, driver_profiles, shipments, shipment_events, activity_logs }) {
      this.hasMany(organization_members, { foreignKey: "userId", as: "memberships" });
      this.hasOne(driver_profiles, { foreignKey: "userId", as: "driverProfile" });
      this.hasMany(shipments, { foreignKey: "createdByUserId", as: "createdShipments" });
      this.hasMany(shipments, { foreignKey: "assignedDriverId", as: "drivingAssignments" });
      this.hasMany(shipment_events, { foreignKey: "actorUserId", as: "recordedEvents" });
      this.hasMany(activity_logs, { foreignKey: "actorId", as: "activityLogs" });
    }

    /** Never expose the password hash in JSON responses. */
    toJSON() {
      const values = { ...this.get() };
      delete values.password;
      return values;
    }
  }

  users.init(
    {
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      phoneNumber: DataTypes.STRING,
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("user", "admin"),
        allowNull: false,
        defaultValue: "user",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "users",
    },
  );
  return users;
};
