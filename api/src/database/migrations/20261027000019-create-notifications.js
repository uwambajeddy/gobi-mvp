"use strict";
/**
 * In-app notifications, the same table as the commercial platform's
 * `notifications` (title, content, isRead, actionUrl, entityType, entityId).
 * The MVP has no notification types or per-type settings, so those are left out.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("notifications", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      content: Sequelize.TEXT,
      isRead: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      actionUrl: Sequelize.STRING,
      entityType: Sequelize.STRING(50),
      entityId: Sequelize.INTEGER,
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("notifications", ["userId", "isRead"]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable("notifications");
  },
};
