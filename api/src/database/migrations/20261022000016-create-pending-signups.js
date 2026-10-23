"use strict";
/**
 * Sign-ups waiting for their email to be verified. The account (a `users`
 * row) is only created once the emailed code is entered, so nobody can hold
 * an address they don't control. `handle` identifies the sign-up in the
 * browser that started it; the code itself is stored only as a bcrypt hash.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("pending_signups", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      handle: {
        type: Sequelize.STRING(48),
        allowNull: false,
        unique: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      phoneNumber: Sequelize.STRING,
      passwordHash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      codeHash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      lastSentAt: {
        type: Sequelize.DATE,
        allowNull: false,
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
    await queryInterface.addIndex("pending_signups", ["email"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("pending_signups");
  },
};
