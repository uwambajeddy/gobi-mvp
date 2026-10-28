import { expect } from "chai";
import { asUser, loginAs, PERSONAS } from "../helpers/auth.helper";
import { driveShipmentTo } from "../helpers/shipment.helper";

const KIGALI = { latitude: -1.9441, longitude: 30.0619 };
const MUHANGA = { latitude: -2.0845, longitude: 29.7566 };

describe("Live tracking API", () => {
  let driver;

  before(async () => {
    driver = await loginAs(PERSONAS.DRIVER_OK);
  });

  it("saves the assigned driver's position in transit and shows it to the shipper", async () => {
    const { shipment, shipper } = await driveShipmentTo("in_transit");

    const first = await asUser(driver.tokens).patch(`/api/v1/shipments/${shipment.id}/location`, KIGALI);
    expect(first).to.have.status(200);
    const second = await asUser(driver.tokens).patch(`/api/v1/shipments/${shipment.id}/location`, MUHANGA);
    expect(second).to.have.status(200);

    const res = await asUser(shipper.tokens).get(`/api/v1/shipments/${shipment.id}/tracking`);
    expect(res).to.have.status(200);
    const { tracking } = res.body.data;
    expect(tracking.currentLocation).to.deep.equal({ lat: MUHANGA.latitude, lng: MUHANGA.longitude });
    expect(tracking.lastLocationUpdate).to.be.a("string");
    expect(tracking.trackingHistory.map((point) => point.lat)).to.deep.equal([
      KIGALI.latitude,
      MUHANGA.latitude,
    ]);
  });

  it("does not count a location ping as an edit of the shipment", async () => {
    const { shipment, shipper } = await driveShipmentTo("in_transit");

    await asUser(driver.tokens).patch(`/api/v1/shipments/${shipment.id}/location`, KIGALI);

    const res = await asUser(shipper.tokens).get(`/api/v1/shipments/${shipment.id}`);
    expect(res.body.data.shipment.updatedAt).to.equal(shipment.updatedAt);
    expect(res.body.data.shipment.currentLocation).to.deep.equal({ lat: KIGALI.latitude, lng: KIGALI.longitude });
  });

  it("tells the web app who may share the location", async () => {
    const { shipment, shipper } = await driveShipmentTo("in_transit");

    const asDriver = await asUser(driver.tokens).get(`/api/v1/shipments/${shipment.id}`);
    expect(asDriver.body.data.access.can.updateLocation).to.equal(true);

    const asShipper = await asUser(shipper.tokens).get(`/api/v1/shipments/${shipment.id}`);
    expect(asShipper.body.data.access.can.updateLocation).to.equal(false);
    expect(asShipper.body.data.access.can.viewTracking).to.equal(true);
  });

  it("refuses locations from anyone but the assigned driver", async () => {
    const { shipment, coordinator } = await driveShipmentTo("in_transit");

    const res = await asUser(coordinator.tokens).patch(`/api/v1/shipments/${shipment.id}/location`, KIGALI);
    expect(res).to.have.status(403);
  });

  it("refuses locations until the driver sets off, then accepts them on the way to pickup", async () => {
    const { shipment } = await driveShipmentTo("execution_assigned");
    const location = `/api/v1/shipments/${shipment.id}/location`;

    const before = await asUser(driver.tokens).patch(location, KIGALI);
    expect(before).to.have.status(400);

    await asUser(driver.tokens).post(`/api/v1/shipments/${shipment.id}/events`, { eventType: "en_route_to_pickup" });

    const after = await asUser(driver.tokens).patch(location, KIGALI);
    expect(after).to.have.status(200);
  });

  it("stops accepting locations once the shipment has arrived", async () => {
    const { shipment } = await driveShipmentTo("arrived");

    const res = await asUser(driver.tokens).patch(`/api/v1/shipments/${shipment.id}/location`, KIGALI);
    expect(res).to.have.status(400);
  });

  it("rejects coordinates outside the valid range", async () => {
    const { shipment } = await driveShipmentTo("in_transit");

    const res = await asUser(driver.tokens).patch(`/api/v1/shipments/${shipment.id}/location`, {
      latitude: 120,
      longitude: KIGALI.longitude,
    });
    expect(res).to.have.status(400);
  });

  it("hides the tracking from organizations outside the shipment", async () => {
    // Domestic shipment: no clearing agent, so the agent is not a party.
    const { shipment } = await driveShipmentTo("in_transit");
    const agent = await loginAs(PERSONAS.AGENT);

    const res = await asUser(agent.tokens).get(`/api/v1/shipments/${shipment.id}/tracking`);
    expect(res).to.have.status(403);
  });
});
