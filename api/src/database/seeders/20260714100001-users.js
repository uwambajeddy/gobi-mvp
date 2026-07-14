"use strict";
const bcrypt = require("bcryptjs");

const password = bcrypt.hashSync("Password123!", 10);
const now = new Date();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert("users", [
      {
        id: 1,
        firstName: "Gobi",
        lastName: "Admin",
        email: "admin@gobi.rw",
        phoneNumber: "+250788000001",
        password,
        type: "admin",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        firstName: "Claire",
        lastName: "Uwase",
        email: "shipper@gobi.rw",
        phoneNumber: "+250788000002",
        password,
        type: "user",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 3,
        firstName: "Emmanuel",
        lastName: "Nkurunziza",
        email: "carrier@gobi.rw",
        phoneNumber: "+250788000003",
        password,
        type: "user",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 4,
        firstName: "Diane",
        lastName: "Mukamana",
        email: "coordinator@gobi.rw",
        phoneNumber: "+250788000004",
        password,
        type: "user",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 5,
        firstName: "David",
        lastName: "Niyonzima",
        email: "driver@gobi.rw",
        phoneNumber: "+250788000005",
        password,
        type: "user",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 6,
        firstName: "Patrick",
        lastName: "Habimana",
        email: "driver2@gobi.rw",
        phoneNumber: "+250788000006",
        password,
        type: "user",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 7,
        firstName: "Sandrine",
        lastName: "Ingabire",
        email: "agent@gobi.rw",
        phoneNumber: "+250788000007",
        password,
        type: "user",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await queryInterface.sequelize.query(
      `SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));`,
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("users", null, {});
  },
};
