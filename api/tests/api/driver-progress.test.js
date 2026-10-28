import { expect } from "chai";
import { asUser, loginAs, PERSONAS } from "../helpers/auth.helper";
import { driveShipmentTo } from "../helpers/shipment.helper";

const S = (id) => `/api/v1/shipments/${id}`;

const notificationsAbout = async (tokens, shipmentId) => {
  const res = await asUser(tokens).get("/api/v1/notifications");
  expect(res).to.have.status(200);
  return res.body.data.results.filter((n) => n.entityType === "shipment" && n.entityId === shipmentId);
};

describe("Driver progress milestones", () => {
  let driver;

  before(async () => {
    driver = await loginAs(PERSONAS.DRIVER_OK);
  });

  it("walks the driver's buttons from going to pickup to delivered", async () => {
    const { shipment } = await driveShipmentTo("execution_assigned");
    const record = (eventType) => asUser(driver.tokens).post(`${S(shipment.id)}/events`, { eventType });

    const going = await record("en_route_to_pickup");
    expect(going).to.have.status(201);
    expect(going.body.data.shipmentStatus).to.equal("execution_assigned");

    const atPickup = await record("arrived_pickup");
    expect(atPickup).to.have.status(201);
    expect(atPickup.body.data.shipmentStatus).to.equal("execution_assigned");

    const loaded = await record("picked_up");
    expect(loaded.body.data.shipmentStatus).to.equal("in_transit");

    const arrived = await record("arrived_destination");
    expect(arrived.body.data.shipmentStatus).to.equal("arrived");

    const delivered = await asUser(driver.tokens).post(`${S(shipment.id)}/pod`, { podRecipientName: "Jean Claude" });
    expect(delivered).to.have.status(200);
    expect(delivered.body.data.shipment.status).to.equal("delivered");
  });

  it("stamps the trip start when the driver taps going to pickup", async () => {
    const { shipment, shipper } = await driveShipmentTo("execution_assigned");
    expect(shipment.startTime ?? null).to.equal(null);

    await asUser(driver.tokens).post(`${S(shipment.id)}/events`, { eventType: "en_route_to_pickup" });

    const res = await asUser(shipper.tokens).get(S(shipment.id));
    expect(res.body.data.shipment.startTime).to.be.a("string");
  });

  it("records each step once, so a double tap is refused", async () => {
    const { shipment } = await driveShipmentTo("execution_assigned");
    const record = () => asUser(driver.tokens).post(`${S(shipment.id)}/events`, { eventType: "en_route_to_pickup" });

    expect(await record()).to.have.status(201);
    const again = await record();
    expect(again).to.have.status(400);
    expect(again.body.message).to.include("already been recorded");
  });

  it("leaves the driver's progress to the driver and the carrier's coordinators", async () => {
    const { shipment, shipper, coordinator } = await driveShipmentTo("execution_assigned");

    const asShipper = await asUser(shipper.tokens).post(`${S(shipment.id)}/events`, { eventType: "en_route_to_pickup" });
    expect(asShipper).to.have.status(403);

    const asCoordinator = await asUser(coordinator.tokens).post(`${S(shipment.id)}/events`, {
      eventType: "en_route_to_pickup",
    });
    expect(asCoordinator).to.have.status(201);
  });

  it("refuses arrived at pickup once the cargo is on the road", async () => {
    const { shipment } = await driveShipmentTo("in_transit");

    const res = await asUser(driver.tokens).post(`${S(shipment.id)}/events`, { eventType: "arrived_pickup" });
    expect(res).to.have.status(400);
  });
});

describe("Shipment status notifications", () => {
  let driver;

  before(async () => {
    driver = await loginAs(PERSONAS.DRIVER_OK);
  });

  it("notifies the shipper and the carrier when the driver sets off, but not the driver", async () => {
    const { shipment, shipper, coordinator } = await driveShipmentTo("execution_assigned");

    await asUser(driver.tokens).post(`${S(shipment.id)}/events`, { eventType: "en_route_to_pickup" });

    const [forShipper] = await notificationsAbout(shipper.tokens, shipment.id);
    expect(forShipper.title).to.equal("Driver en route to pickup");
    expect(forShipper.content).to.include(shipment.reference);
    expect(forShipper.isRead).to.equal(false);

    const [forCoordinator] = await notificationsAbout(coordinator.tokens, shipment.id);
    expect(forCoordinator.title).to.equal("Driver en route to pickup");

    const forDriver = await notificationsAbout(driver.tokens, shipment.id);
    expect(forDriver.map((n) => n.title)).to.not.include("En route to pickup");
  });

  it("tells the driver about a new assignment, and every party as the shipment moves", async () => {
    const { shipment, shipper } = await driveShipmentTo("delivered");

    const forDriver = await notificationsAbout(driver.tokens, shipment.id);
    expect(forDriver.map((n) => n.title)).to.include("New assignment");

    const titles = (await notificationsAbout(shipper.tokens, shipment.id)).map((n) => n.title);
    expect(titles).to.include.members([
      "Vehicle and driver assigned",
      "Cargo picked up",
      "Arrived at destination",
      "Shipment delivered",
    ]);
  });

  it("marks notifications read, one at a time or all together", async () => {
    const { shipment, shipper } = await driveShipmentTo("in_transit");
    const [latest] = await notificationsAbout(shipper.tokens, shipment.id);

    const one = await asUser(shipper.tokens).patch(`/api/v1/notifications/read/${latest.id}`);
    expect(one).to.have.status(200);
    const [readOne] = await notificationsAbout(shipper.tokens, shipment.id);
    expect(readOne.isRead).to.equal(true);

    const all = await asUser(shipper.tokens).patch("/api/v1/notifications/read");
    expect(all).to.have.status(200);
    const res = await asUser(shipper.tokens).get("/api/v1/notifications");
    expect(res.body.data.unreadCount).to.equal(0);
  });

  it("never lets one user mark another user's notification read", async () => {
    const { shipment, shipper } = await driveShipmentTo("in_transit");
    const [latest] = await notificationsAbout(shipper.tokens, shipment.id);
    const agent = await loginAs(PERSONAS.AGENT);

    await asUser(agent.tokens).patch(`/api/v1/notifications/read/${latest.id}`);

    const [after] = await notificationsAbout(shipper.tokens, shipment.id);
    expect(after.id).to.equal(latest.id);
    expect(after.isRead).to.equal(false);
  });
});
