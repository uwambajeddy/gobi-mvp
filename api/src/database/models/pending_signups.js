"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  /** A sign-up waiting for its emailed code; see the create-pending-signups migration. */
  class pending_signups extends Model {}

  pending_signups.init(
    {
      handle: {
        type: DataTypes.STRING(48),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phoneNumber: DataTypes.STRING,
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      codeHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      lastSentAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "pending_signups",
    },
  );
  return pending_signups;
};
