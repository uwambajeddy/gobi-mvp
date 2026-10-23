"use strict";
/**
 * Invitations for people who don't have a Gobi account yet. The emailed link
 * carries a random token; only its SHA-256 hash is stored, so the table alone
 * can't be used to accept an invitation.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("organization_invitations", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      organizationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM("owner", "coordinator", "member", "driver"),
        allowNull: false,
      },
      tokenHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM("pending", "accepted", "revoked"),
        allowNull: false,
        defaultValue: "pending",
      },
      invitedByUserId: {
        type: Sequelize.INTEGER,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      acceptedByUserId: {
        type: Sequelize.INTEGER,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      acceptedAt: Sequelize.DATE,
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex("organization_invitations", ["organizationId", "email"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("organization_invitations");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_organization_invitations_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_organization_invitations_status";');
  },
};
