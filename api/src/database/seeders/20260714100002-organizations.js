"use strict";
const now = new Date();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert("organizations", [
      {
        id: 1,
        name: "Kigali Distribution Ltd",
        companyType: "distribution",
        contactEmail: "ops@kigalidistribution.rw",
        contactPhone: "+250788100001",
        address: "KG 7 Ave, Kigali",
        createdByUserId: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        name: "TransAfrica Logistics",
        companyType: "transport",
        contactEmail: "dispatch@transafrica.rw",
        contactPhone: "+250788100002",
        address: "Gikondo Industrial Zone, Kigali",
        createdByUserId: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 3,
        name: "ClearFast Agencies",
        companyType: "clearing_agent",
        contactEmail: "clearance@clearfast.rw",
        contactPhone: "+250788100003",
        address: "Rusumo Border Post",
        createdByUserId: 7,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await queryInterface.bulkInsert("organization_members", [
      { id: 1, userId: 2, organizationId: 1, role: "owner", active: true, createdAt: now, updatedAt: now },
      { id: 2, userId: 3, organizationId: 2, role: "owner", active: true, createdAt: now, updatedAt: now },
      { id: 3, userId: 4, organizationId: 2, role: "coordinator", active: true, createdAt: now, updatedAt: now },
      { id: 4, userId: 5, organizationId: 2, role: "driver", active: true, createdAt: now, updatedAt: now },
      { id: 5, userId: 6, organizationId: 2, role: "driver", active: true, createdAt: now, updatedAt: now },
      { id: 6, userId: 7, organizationId: 3, role: "owner", active: true, createdAt: now, updatedAt: now },
    ]);

    await queryInterface.sequelize.query(
      `SELECT setval(pg_get_serial_sequence('organizations', 'id'), (SELECT MAX(id) FROM organizations));`,
    );
    await queryInterface.sequelize.query(
      `SELECT setval(pg_get_serial_sequence('organization_members', 'id'), (SELECT MAX(id) FROM organization_members));`,
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("organization_members", null, {});
    await queryInterface.bulkDelete("organizations", null, {});
  },
};
