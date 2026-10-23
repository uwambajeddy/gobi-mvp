import statusCodes from "../utils/statusCodes";
import AppError from "../utils/appError";
import catchAsync from "../utils/catchAsync";
import { checkShipmentPolicy, getShipmentAccess } from "../services/shipmentAccess.service";
import { MAX_FILE_BYTES } from "../services/fileStorage.service";
import db from "../database/models";

const { notFound } = statusCodes;
const { shipments, shipment_documents, shipment_payments, shipment_exceptions } = db;

/** Child records addressed by their own id; each belongs to one shipment. */
const CHILD_RECORDS = {
  document: { model: shipment_documents, param: "docId", label: "Document" },
  payment: { model: shipment_payments, param: "paymentId", label: "Payment" },
  exception: { model: shipment_exceptions, param: "exceptionId", label: "Exception" },
};

/** Room for multipart boundaries and text fields on top of the file itself. */
const DISCARD_LIMIT_BYTES = MAX_FILE_BYTES + 1024 * 1024;

/**
 * Reads and throws away a request body nobody parsed, so a refused upload
 * still receives its response instead of a reset connection. Nothing is
 * kept or inspected; a body larger than any allowed upload is cut off.
 */
const discardUnreadBody = (req) =>
  new Promise((resolve) => {
    if (req.complete) return resolve();
    let received = 0;
    req.on("data", (chunk) => {
      received += chunk.length;
      if (received > DISCARD_LIMIT_BYTES) {
        req.destroy();
        resolve();
      }
    });
    req.on("end", resolve);
    req.on("close", resolve);
    req.on("error", resolve);
  });

/**
 * Shipment authorization guard. Use after `protect`.
 *
 * Loads the shipment from `:id`, or from a child record (`from: "document"`,
 * `"payment"`, `"exception"`), computes the caller's access and applies the
 * action's policy (config/shipmentPolicies). On success the handler gets
 * `req.shipment`, `req.access` and, for child routes, `req.document` /
 * `req.payment` / `req.exception`.
 *
 * On upload routes it runs before the file parser: a refused request's
 * file is discarded unread, never buffered, checked or stored.
 *
 * @param {string} action a key of SHIPMENT_POLICIES
 * @param {{from?: "shipment"|"document"|"payment"|"exception", include?: Array}} options
 */
export const authorizeShipment = (action, { from = "shipment", include = [] } = {}) =>
  catchAsync(async (req, res, next) => {
    const refuse = async (error) => {
      await discardUnreadBody(req);
      next(error);
    };

    let shipmentId = req.params.id;

    if (from !== "shipment") {
      const child = CHILD_RECORDS[from];
      const record = await child.model.findByPk(req.params[child.param]);
      if (!record) return refuse(new AppError(`${child.label} not found.`, notFound));
      req[from] = record;
      shipmentId = record.shipmentId;
    }

    const shipment = await shipments.findByPk(shipmentId, { include });
    if (!shipment) return refuse(new AppError("Shipment not found.", notFound));

    const access = getShipmentAccess(shipment, req);
    const denied = checkShipmentPolicy(action, shipment, access);
    if (denied) return refuse(denied);

    req.shipment = shipment;
    req.access = access;
    next();
  });
