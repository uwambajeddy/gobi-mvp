import { expect } from "chai";
import {
  asUser,
  loginAs,
  registerUser,
  uniqueEmail,
  PERSONAS,
  SEED,
} from "../helpers/auth.helper";
import { createShipment, driveShipmentTo, uploadAllMandatoryDocs } from "../helpers/shipment.helper";
import { pdfFile } from "../helpers/files.helper";
import { enrollDriver } from "../helpers/organization.helper";
import { createOrRefreshInvitation } from "../../src/services/invitations.service";
import { testOutbox } from "../../src/services/email.service";
import { flushNotifications } from "../../src/services/notifications.service";

/**
 * Regression tests for the role and relationship rules in
 * src/config/shipmentPolicies.js and the organization role guards
 * (audit findings F-01, F-02, F-03, F-04). Each rule is checked from
 * both sides: the people it lets in and the people it keeps out.
 */

const S = (id) => `/api/v1/shipments/${id}`;

/** A fresh organization owned by a freshly registered user. */
const createOrg = async (companyType) => {
  const owner = await registerUser();
  const res = await asUser(owner.tokens).post("/api/v1/organizations", {
    name: `Authz ${companyType} ${Date.now()}`,
    companyType,
  });
  return { owner, orgId: res.body.data.organization.id };
};

/** Registers someone and adds them to the organization with `role` (drivers accept an invitation). */
const addFreshMember = async (actor, orgId, role) => {
  const person = await registerUser();
  if (role === "driver") {
    const membership = await enrollDriver(actor, orgId, person);
    return { ...person, membershipId: membership.id };
  }
  const res = await asUser(actor.tokens).post(`/api/v1/organizations/${orgId}/members`, {
    email: person.user.email,
    role,
  });
  expect(res, `add ${role}`).to.have.status(201);
  return { ...person, membershipId: res.body.data.member.id };
};

const membersOf = async (actor, orgId) =>
  (await asUser(actor.tokens).get(`/api/v1/organizations/${orgId}/members`)).body.data.members;

const statusOf = async (tokens, id) => (await asUser(tokens).get(S(id))).body.data.shipment.status;

describe("Shipment & organization authorization", () => {
  describe("Drivers reach only their own assignments (F-01)", () => {
    let assigned;
    let unassigned;
    let driver;
    let otherDriver;
    let coordinator;
    let documentId;
    let paymentId;

    before(async () => {
      ({ shipment: assigned, coordinator } = await driveShipmentTo("execution_assigned"));
      ({ shipment: unassigned } = await driveShipmentTo("awaiting_documents"));
      driver = await loginAs(PERSONAS.DRIVER_OK);
      otherDriver = await loginAs(PERSONAS.DRIVER_EXPIRED);

      const docs = await asUser(coordinator.tokens).get(`${S(assigned.id)}/documents`);
      documentId = docs.body.data.documents.find((d) => d.hasFile).id;

      const payment = await asUser(coordinator.tokens).upload(
        `${S(assigned.id)}/payments`,
        { type: "port_fee", amount: 1000 },
        pdfFile("proof.pdf"),
      );
      paymentId = payment.body.data.payment.id;
    });

    it("lists only the driver's own assignments", async () => {
      const mine = (await asUser(driver.tokens).get("/api/v1/shipments")).body.data.shipments;
      expect(mine.map((s) => s.id)).to.include(assigned.id);
      expect(mine.map((s) => s.id)).to.not.include(unassigned.id);
      mine.forEach((s) => expect(s.assignedDriverId).to.equal(SEED.DRIVER_OK_ID));

      const theirs = (await asUser(otherDriver.tokens).get("/api/v1/shipments")).body.data.shipments;
      expect(theirs.map((s) => s.id)).to.not.include(assigned.id);
      theirs.forEach((s) => expect(s.assignedDriverId).to.equal(SEED.DRIVER_EXPIRED_ID));
    });

    it("refuses a driver every record of a shipment assigned to someone else", async () => {
      const as = asUser(otherDriver.tokens);
      const id = assigned.id;

      expect(await as.get(S(id))).to.have.status(403);
      expect(await as.get(`${S(id)}/documents`)).to.have.status(403);
      expect(await as.get(`/api/v1/shipments/documents/${documentId}/file`)).to.have.status(403);
      expect(await as.get(`${S(id)}/payments`)).to.have.status(403);
      expect(await as.get(`/api/v1/shipments/payments/${paymentId}/proof`)).to.have.status(403);
      expect(await as.get(`${S(id)}/events`)).to.have.status(403);
      expect(await as.get(`${S(id)}/exceptions`)).to.have.status(403);
    });

    it("refuses a driver any write on a shipment assigned to someone else", async () => {
      const as = asUser(otherDriver.tokens);
      const id = assigned.id;

      const upload = await as.upload(
        `${S(id)}/documents`,
        { docType: "signed_delivery_note" },
        pdfFile("note.pdf"),
      );
      expect(upload).to.have.status(403);
      expect(
        await as.post(`${S(id)}/exceptions`, { type: "other", severity: "low", notes: "Not my truck" }),
      ).to.have.status(403);
      expect(await as.post(`${S(id)}/events`, { eventType: "checkpoint" })).to.have.status(403);
      expect(await as.post(`${S(id)}/events`, { eventType: "picked_up" })).to.have.status(403);
      expect(await as.post(`${S(id)}/pod`, { podRecipientName: "Someone" })).to.have.status(403);

      expect(await statusOf(coordinator.tokens, id)).to.equal("execution_assigned");
    });

    it("refuses a driver an unassigned shipment of their own carrier", async () => {
      const as = asUser(driver.tokens);

      expect(await as.get(S(unassigned.id))).to.have.status(403);
      expect(await as.get(`${S(unassigned.id)}/documents`)).to.have.status(403);
      const upload = await as.upload(
        `${S(unassigned.id)}/documents`,
        { docType: "packing_list" },
        pdfFile("packing.pdf"),
      );
      expect(upload).to.have.status(403);
    });

    it("keeps carrier coordinators and the platform admin on every carrier shipment", async () => {
      const listed = (await asUser(coordinator.tokens).get("/api/v1/shipments")).body.data.shipments;
      expect(listed.map((s) => s.id)).to.include.members([assigned.id, unassigned.id]);
      expect(await asUser(coordinator.tokens).get(S(unassigned.id))).to.have.status(200);

      const admin = await loginAs(PERSONAS.ADMIN);
      expect(await asUser(admin.tokens).get(S(unassigned.id))).to.have.status(200);
    });

    it("lets carrier members see their carrier's shipments, but not the carrier's drivers", async () => {
      const shipper = await loginAs(PERSONAS.SHIPPER);
      const { owner, orgId } = await createOrg("transport");
      const member = await addFreshMember(owner, orgId, "member");
      const carrierDriver = await addFreshMember(owner, orgId, "driver");

      const shipment = await createShipment(shipper.tokens);
      await asUser(shipper.tokens).post(`${S(shipment.id)}/submit`);
      await asUser(shipper.tokens).post(`${S(shipment.id)}/assign-carrier`, { transportOrgId: orgId });

      expect(await asUser(member.tokens).get(S(shipment.id))).to.have.status(200);
      const memberList = (await asUser(member.tokens).get("/api/v1/shipments")).body.data.shipments;
      expect(memberList.map((s) => s.id)).to.include(shipment.id);

      expect(await asUser(carrierDriver.tokens).get(S(shipment.id))).to.have.status(403);
      const driverList = (await asUser(carrierDriver.tokens).get("/api/v1/shipments")).body.data.shipments;
      expect(driverList).to.have.length(0);
    });

    it("lets the assigned driver work on their own shipment", async () => {
      const as = asUser(driver.tokens);
      const id = assigned.id;

      const detail = await as.get(S(id));
      expect(detail).to.have.status(200);
      expect(detail.body.data.access.isAssignedDriver).to.equal(true);
      expect(detail.body.data.access.isCarrier).to.equal(false);
      expect(detail.body.data.access.can.recordStatusMilestone).to.equal(true);
      expect(detail.body.data.access.can.capturePod).to.equal(false); // not arrived yet

      expect(await as.get(`${S(id)}/documents`)).to.have.status(200);
      expect(await as.get(`/api/v1/shipments/documents/${documentId}/file`)).to.have.status(200);
      // Payments are not shared with drivers, even on their own shipment (Q-2, authorization-batch2.test.js).
      expect(await as.get(`${S(id)}/payments`)).to.have.status(403);
      expect(await as.get(`/api/v1/shipments/payments/${paymentId}/proof`)).to.have.status(403);

      const upload = await as.upload(
        `${S(id)}/documents`,
        { docType: "signed_delivery_note" },
        pdfFile("note.pdf"),
      );
      expect(upload).to.have.status(201);

      const exception = await as.post(`${S(id)}/exceptions`, {
        type: "border_queue",
        severity: "low",
        notes: "Queue at the depot gate",
      });
      expect(exception).to.have.status(201);

      const pickup = await as.post(`${S(id)}/events`, { eventType: "picked_up", locationName: "Depot" });
      expect(pickup).to.have.status(201);
      expect(pickup.body.data.shipmentStatus).to.equal("in_transit");
    });
  });

  describe("Only the carrier advances the status through milestones (F-02)", () => {
    let shipment;
    let shipper;
    let coordinator;
    let agent;
    let driver;

    before(async () => {
      ({ shipment, shipper, coordinator } = await driveShipmentTo("awaiting_documents"));
      const assignAgent = await asUser(shipper.tokens).post(`${S(shipment.id)}/assign-clearing-agent`, {
        clearingAgentOrgId: SEED.CLEARING_ORG,
      });
      expect(assignAgent).to.have.status(200);
      await uploadAllMandatoryDocs(coordinator.tokens, shipment.id);
      const assign = await asUser(coordinator.tokens).post(`${S(shipment.id)}/assign`, {
        vehicleId: SEED.VEHICLE_COMPLIANT,
        driverId: SEED.DRIVER_OK_ID,
      });
      expect(assign).to.have.status(200);

      agent = await loginAs(PERSONAS.AGENT);
      driver = await loginAs(PERSONAS.DRIVER_OK);
    });

    it("refuses pickup from the shipper, the clearing agent and an unassigned driver", async () => {
      const otherDriver = await loginAs(PERSONAS.DRIVER_EXPIRED);

      for (const actor of [shipper, agent, otherDriver]) {
        const res = await asUser(actor.tokens).post(`${S(shipment.id)}/events`, { eventType: "picked_up" });
        expect(res).to.have.status(403);
      }
      expect(await statusOf(shipper.tokens, shipment.id)).to.equal("execution_assigned");
    });

    it("refuses pickup from a carrier member, who can still record other milestones", async () => {
      const carrierOwner = await loginAs(PERSONAS.CARRIER_OWNER);
      const member = await addFreshMember(carrierOwner, SEED.TRANSPORT_ORG, "member");
      try {
        const pickup = await asUser(member.tokens).post(`${S(shipment.id)}/events`, { eventType: "picked_up" });
        expect(pickup).to.have.status(403);

        const checkpoint = await asUser(member.tokens).post(`${S(shipment.id)}/events`, {
          eventType: "checkpoint",
          locationName: "Weighbridge",
        });
        expect(checkpoint).to.have.status(201);
      } finally {
        await asUser(carrierOwner.tokens).delete(
          `/api/v1/organizations/${SEED.TRANSPORT_ORG}/members/${member.membershipId}`,
        );
      }
      expect(await statusOf(shipper.tokens, shipment.id)).to.equal("execution_assigned");
    });

    it("still lets the shipper and the clearing agent record informational milestones and do their work", async () => {
      const note = await asUser(shipper.tokens).post(`${S(shipment.id)}/events`, {
        eventType: "note_added",
        notes: "Receiver asked for a morning delivery",
      });
      expect(note).to.have.status(201);

      const customs = await asUser(agent.tokens).post(`${S(shipment.id)}/events`, {
        eventType: "customs_submitted",
        locationName: "Gatuna",
      });
      expect(customs).to.have.status(201);

      expect(await asUser(agent.tokens).get(S(shipment.id))).to.have.status(200);
      const upload = await asUser(agent.tokens).upload(
        `${S(shipment.id)}/documents`,
        { docType: "import_declaration_form" },
        pdfFile("idf.pdf"),
      );
      expect(upload).to.have.status(201);
      const payment = await asUser(agent.tokens).post(`${S(shipment.id)}/payments`, {
        type: "customs_duty",
        amount: 25000,
      });
      expect(payment).to.have.status(201);

      expect(await statusOf(shipper.tokens, shipment.id)).to.equal("execution_assigned");
    });

    it("lets the assigned driver record pickup and arrival, and refuses arrival from the shipper", async () => {
      const pickup = await asUser(driver.tokens).post(`${S(shipment.id)}/events`, { eventType: "picked_up" });
      expect(pickup).to.have.status(201);
      expect(pickup.body.data.shipmentStatus).to.equal("in_transit");

      const shipperArrival = await asUser(shipper.tokens).post(`${S(shipment.id)}/events`, {
        eventType: "arrived_destination",
      });
      expect(shipperArrival).to.have.status(403);

      const arrival = await asUser(driver.tokens).post(`${S(shipment.id)}/events`, {
        eventType: "arrived_destination",
      });
      expect(arrival).to.have.status(201);
      expect(arrival.body.data.shipmentStatus).to.equal("arrived");
    });

    it("tells the web app who may record status milestones", async () => {
      const asShipper = await asUser(shipper.tokens).get(S(shipment.id));
      expect(asShipper.body.data.access.can.recordStatusMilestone).to.equal(false);
      expect(asShipper.body.data.access.can.recordEvent).to.equal(true);

      const asCoordinator = await asUser(coordinator.tokens).get(S(shipment.id));
      expect(asCoordinator.body.data.access.can.recordStatusMilestone).to.equal(true);
    });
  });

  describe("A driver who leaves the carrier loses the assignment (F-04)", () => {
    it("keeps access while a member, and loses it, POD included, once removed", async () => {
      const shipper = await loginAs(PERSONAS.SHIPPER);
      const { owner, orgId } = await createOrg("transport");
      const driver = await addFreshMember(owner, orgId, "driver");
      const vehicle = await asUser(owner.tokens).post("/api/v1/vehicles", {
        plateNumber: `AZ${String(Date.now()).slice(-6)}`,
        model: "Test truck",
        type: "truck",
        capacityKg: 30000,
      });
      expect(vehicle).to.have.status(201);

      const shipment = await createShipment(shipper.tokens);
      const id = shipment.id;
      await asUser(shipper.tokens).post(`${S(id)}/submit`);
      await asUser(shipper.tokens).post(`${S(id)}/assign-carrier`, { transportOrgId: orgId });
      await asUser(owner.tokens).post(`${S(id)}/quote`, { amount: 200000 });
      await asUser(shipper.tokens).post(`${S(id)}/approve-quote`);
      await uploadAllMandatoryDocs(shipper.tokens, id);
      const assign = await asUser(owner.tokens).post(`${S(id)}/assign`, {
        vehicleId: vehicle.body.data.vehicle.id,
        driverId: driver.user.id,
        overrideComplianceGate: true,
        overrideReason: "Licence review pending for a new driver",
      });
      expect(assign).to.have.status(200);

      // While still a driver of the carrier
      expect(await asUser(driver.tokens).get(S(id))).to.have.status(200);
      const pickup = await asUser(driver.tokens).post(`${S(id)}/events`, { eventType: "picked_up" });
      expect(pickup).to.have.status(201);
      const arrival = await asUser(owner.tokens).post(`${S(id)}/events`, { eventType: "arrived_destination" });
      expect(arrival).to.have.status(201);

      const removal = await asUser(owner.tokens).delete(
        `/api/v1/organizations/${orgId}/members/${driver.membershipId}`,
      );
      expect(removal).to.have.status(200);

      // After leaving
      expect(await asUser(driver.tokens).get(S(id))).to.have.status(403);
      expect(await asUser(driver.tokens).post(`${S(id)}/events`, { eventType: "checkpoint" })).to.have.status(403);
      expect(await asUser(driver.tokens).post(`${S(id)}/pod`, { podRecipientName: "Receiver" })).to.have.status(403);
      const list = (await asUser(driver.tokens).get("/api/v1/shipments")).body.data.shipments;
      expect(list.map((s) => s.id)).to.not.include(id);

      // The carrier itself can still finish the job
      const pod = await asUser(owner.tokens).post(`${S(id)}/pod`, { podRecipientName: "Receiver" });
      expect(pod).to.have.status(200);
    });
  });

  describe("Owner role and the last owner (F-03)", () => {
    /** The token only ever travels in the email, so tests read it from the outbox. */
    const invitationToken = async (email) => {
      await flushNotifications();
      const message = [...testOutbox].reverse().find((m) => m.to.email === email);
      return message?.text.match(/\/invite\/([a-f0-9]{64})/)?.[1];
    };

    it("refuses a coordinator who adds or invites an owner, and allows other roles", async () => {
      const { owner, orgId } = await createOrg("transport");
      const coordinator = await addFreshMember(owner, orgId, "coordinator");

      const existing = await registerUser();
      const addOwner = await asUser(coordinator.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: existing.user.email,
        role: "owner",
      });
      expect(addOwner).to.have.status(403);
      expect((await membersOf(owner, orgId)).map((m) => m.userId)).to.not.include(existing.user.id);

      const newEmail = uniqueEmail("owner-invite");
      const inviteOwner = await asUser(coordinator.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: newEmail,
        role: "owner",
      });
      expect(inviteOwner).to.have.status(403);
      const open = await asUser(owner.tokens).get(`/api/v1/organizations/${orgId}/invitations`);
      expect(open.body.data.invitations.map((i) => i.email)).to.not.include(newEmail);

      const addMember = await asUser(coordinator.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: existing.user.email,
        role: "member",
      });
      expect(addMember).to.have.status(201);
      const inviteDriver = await asUser(coordinator.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: uniqueEmail("driver-invite"),
        role: "driver",
      });
      expect(inviteDriver).to.have.status(201);
    });

    it("lets an owner add an owner directly and by invitation", async () => {
      const { owner, orgId } = await createOrg("distribution");

      const existing = await registerUser();
      const added = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email: existing.user.email,
        role: "owner",
      });
      expect(added).to.have.status(201);
      expect(added.body.data.member.role).to.equal("owner");

      const email = uniqueEmail("co-owner");
      const invited = await asUser(owner.tokens).post(`/api/v1/organizations/${orgId}/members`, {
        email,
        role: "owner",
      });
      expect(invited).to.have.status(201);
      const token = await invitationToken(email);
      const invitee = await registerUser({ email });
      const accepted = await asUser(invitee.tokens).post(`/api/v1/invitations/${token}/accept`);
      expect(accepted).to.have.status(200);
      expect(accepted.body.data.membership.role).to.equal("owner");
    });

    it("refuses an owner invitation that a non-owner sent before this rule existed", async () => {
      const { owner, orgId } = await createOrg("transport");
      const coordinator = await addFreshMember(owner, orgId, "coordinator");

      // Created directly, as a coordinator could before the API refused it.
      const email = uniqueEmail("legacy-owner");
      const { token } = await createOrRefreshInvitation({
        organizationId: orgId,
        email,
        role: "owner",
        invitedByUserId: coordinator.user.id,
      });

      const invitee = await registerUser({ email });
      const accepted = await asUser(invitee.tokens).post(`/api/v1/invitations/${token}/accept`);
      expect(accepted).to.have.status(403);
      expect((await membersOf(owner, orgId)).map((m) => m.userId)).to.not.include(invitee.user.id);
    });

    it("refuses a coordinator who changes roles or removes the owner", async () => {
      const { owner, orgId } = await createOrg("transport");
      const coordinator = await addFreshMember(owner, orgId, "coordinator");
      const ownerRow = (await membersOf(owner, orgId)).find((m) => m.userId === owner.user.id);

      const demote = await asUser(coordinator.tokens).patch(
        `/api/v1/organizations/${orgId}/members/${ownerRow.id}`,
        { role: "member" },
      );
      expect(demote).to.have.status(403);
      const remove = await asUser(coordinator.tokens).delete(`/api/v1/organizations/${orgId}/members/${ownerRow.id}`);
      expect(remove).to.have.status(403);
    });

    it("never leaves an organization without an active owner", async () => {
      const { owner, orgId } = await createOrg("distribution");
      const ownerRow = (await membersOf(owner, orgId)).find((m) => m.userId === owner.user.id);

      const soloDemotion = await asUser(owner.tokens).patch(
        `/api/v1/organizations/${orgId}/members/${ownerRow.id}`,
        { role: "member" },
      );
      expect(soloDemotion).to.have.status(400);
      expect((await membersOf(owner, orgId)).find((m) => m.id === ownerRow.id).role).to.equal("owner");

      // With a second owner, stepping down and removing owners both work.
      const second = await addFreshMember(owner, orgId, "owner");
      const third = await addFreshMember(owner, orgId, "owner");
      const removeOwner = await asUser(owner.tokens).delete(
        `/api/v1/organizations/${orgId}/members/${third.membershipId}`,
      );
      expect(removeOwner).to.have.status(200);
      const stepDown = await asUser(owner.tokens).patch(
        `/api/v1/organizations/${orgId}/members/${ownerRow.id}`,
        { role: "coordinator" },
      );
      expect(stepDown).to.have.status(200);

      // `second` is now the only owner.
      const secondRow = (await membersOf(second, orgId)).find((m) => m.userId === second.user.id);
      const lastDemotion = await asUser(second.tokens).patch(
        `/api/v1/organizations/${orgId}/members/${secondRow.id}`,
        { role: "member" },
      );
      expect(lastDemotion).to.have.status(400);
    });
  });
});
