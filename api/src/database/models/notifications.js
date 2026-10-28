"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class notifications extends Model {
    static associate({ users }) {
      this.belongsTo(users, { foreignKey: "userId", as: "user" });
    }
  }

  notifications.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      content: DataTypes.TEXT,
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      actionUrl: DataTypes.STRING,
      entityType: DataTypes.STRING(50),
      entityId: DataTypes.INTEGER,
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "notifications",
    },
  );
  return notifications;
};
