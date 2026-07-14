"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class activity_logs extends Model {
    static associate({ users, organizations }) {
      this.belongsTo(users, { foreignKey: "actorId", as: "actor" });
      this.belongsTo(organizations, { foreignKey: "organizationId", as: "organization" });
    }
  }

  activity_logs.init(
    {
      actorId: DataTypes.INTEGER,
      actorRole: DataTypes.STRING,
      organizationId: DataTypes.INTEGER,
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      entityType: DataTypes.STRING,
      entityId: DataTypes.INTEGER,
      description: DataTypes.TEXT,
      metadata: DataTypes.JSONB,
      ipAddress: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "activity_logs",
      updatedAt: false, // audit rows are immutable
    },
  );
  return activity_logs;
};
