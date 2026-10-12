import db from "../database/models";
import { emailMode, sendEmail } from "./email.service";
import { appUrl, renderEmail } from "../utils/emailTemplate";

/**
 * Email notifications for the hand-offs in a shipment's life, plus a few
 * account events. Each rule says who has to act next and tells only them.
 *
 * Notifications run in the background: they never delay or fail the action
 * that triggered them, and the person who acted is never emailed about it.
 */

const {
  shipments,
  organizations,
  organization_members,
  users,
  vehicles,
  shipment_documents,
  shipment_exceptions,
} = db;

const COORDINATOR_ROLES = ["owner", "coordinator"];
const personAttributes = ["id", "firstName", "lastName", "email", "isActive"];

const pending = new Set();

/** Runs `work` in the background and keeps it visible to `flushNotifications`. */
const track = (work) => {
  const task = Promise.resolve()
    .then(work)
    .catch((error) => console.error("Notification failed:", error.message))
    .finally(() => pending.delete(task));
  pending.add(task);
};

/** Resolves once every queued notification has been handled (used by tests). */
export const flushNotifications = async () => {
  while (pending.size) await Promise.allSettled([...pending]);
};

const fullName = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(" ");

const money = (amount, currency = "RWF") => `${currency} ${Number(amount).toLocaleString("en-US")}`;

const humanize = (value = "") => value.replace(/_/g, " ");

const coordinatorsOf = async (organizationId) => {
  if (!organizationId) return [];
  const members = await organization_members.findAll({
    where: { organizationId, active: true, role: COORDINATOR_ROLES },
    include: [{ model: users, as: "user", attributes: personAttributes }],
  });
  return members.map((member) => member.user);
};

const userById = (id) => (id ? users.findByPk(id, { attributes: personAttributes }) : null);

const orgFootnote = (org) => `You're receiving this because you coordinate shipments for ${org?.name} on Gobi.`;

/**
 * Sends one email per recipient. Skips inactive users, duplicates and the
 * person who triggered the notification.
 */
const deliver = async (audiences, { actorUserId, tag }) => {
  const seen = new Set();
  const messages = [];

  for (const audience of audiences) {
    for (const person of audience.to || []) {
      if (!person?.email || person.isActive === false || person.id === actorUserId || seen.has(person.id)) {
        continue;
      }
      seen.add(person.id);
      const { html, text } = renderEmail({
        heading: audience.heading,
        paragraphs: audience.paragraphs,
        code: audience.code,
        details: audience.details,
        cta: audience.cta,
        footnote: audience.footnote,
      });
      messages.push(
        sendEmail({ to: { email: person.email, name: fullName(person) }, subject: audience.subject, html, text, tag }),
      );
    }
  }

  await Promise.all(messages);
};

// ── Shipment events ──────────────────────────────────────────────────────────

const orgAttributes = ["id", "name", "companyType"];

const loadShipment = (shipmentId) =>
  shipments.findByPk(shipmentId, {
    include: [
      { model: organizations, as: "distributionOrg", attributes: orgAttributes },
      { model: organizations, as: "transportOrg", attributes: orgAttributes },
      { model: organizations, as: "clearingAgentOrg", attributes: orgAttributes },
      { model: users, as: "assignedDriver", attributes: personAttributes },
      { model: vehicles, as: "assignedVehicle", attributes: ["id", "plateNumber", "model"] },
    ],
  });

/**
 * One builder per event type. Each returns the audiences to email; an
 * audience is a set of recipients sharing the same message.
 */
const SHIPMENT_RULES = {
  carrier_assigned: async ({ shipment }) => [
    {
      to: await coordinatorsOf(shipment.transportOrgId),
      subject: `New shipment request: ${shipment.reference}`,
      heading: "You've been asked to carry a shipment",
      paragraphs: [
        `${shipment.distributionOrg?.name} assigned ${shipment.transportOrg?.name} as the carrier for "${shipment.title}". Review the route and cargo, then submit your quote.`,
      ],
      cta: "Review and quote",
      footnote: orgFootnote(shipment.transportOrg),
    },
  ],

  clearing_agent_assigned: async ({ shipment }) => [
    {
      to: await coordinatorsOf(shipment.clearingAgentOrgId),
      subject: `Clearing agent assignment: ${shipment.reference}`,
      heading: "You've been added as the clearing agent",
      paragraphs: [
        `${shipment.distributionOrg?.name} assigned ${shipment.clearingAgentOrg?.name} to handle customs for "${shipment.title}". You can upload customs documents once the quote is approved.`,
      ],
      cta: "Open the shipment",
      footnote: orgFootnote(shipment.clearingAgentOrg),
    },
  ],

  quote_submitted: async ({ shipment }) => [
    {
      to: await coordinatorsOf(shipment.distributionOrgId),
      subject: `Quote received for ${shipment.reference}: ${money(shipment.quoteAmount, shipment.quoteCurrency)}`,
      heading: "A quote is waiting for your approval",
      paragraphs: [
        `${shipment.transportOrg?.name} quoted ${money(shipment.quoteAmount, shipment.quoteCurrency)} for "${shipment.title}". Approving it creates the required-documents checklist.`,
      ],
      cta: "Review the quote",
      footnote: orgFootnote(shipment.distributionOrg),
    },
  ],

  quote_approved: async ({ shipment }) => {
    const message = {
      subject: `Quote approved: ${shipment.reference}`,
      heading: "Quote approved, documents are next",
      paragraphs: [
        `${shipment.distributionOrg?.name} approved the quote of ${money(shipment.quoteAmount, shipment.quoteCurrency)} for "${shipment.title}". The required-documents checklist is ready for uploads.`,
      ],
      cta: "Upload documents",
    };
    return [
      { ...message, to: await coordinatorsOf(shipment.transportOrgId), footnote: orgFootnote(shipment.transportOrg) },
      { ...message, to: await coordinatorsOf(shipment.clearingAgentOrgId), footnote: orgFootnote(shipment.clearingAgentOrg) },
    ];
  },

  document_rejected: async ({ shipment, metadata }) => {
    const document = await shipment_documents.findOne({
      where: { shipmentId: shipment.id, docType: metadata?.docType },
    });
    return [
      {
        to: [await userById(document?.uploadedByUserId)],
        subject: `Document rejected: ${document?.label} (${shipment.reference})`,
        heading: "A document you uploaded was rejected",
        paragraphs: [
          `${document?.label} for "${shipment.title}" was rejected. Upload a corrected file to keep the shipment moving.`,
        ],
        details: [["Reason", metadata?.reason]],
        cta: "Upload a new file",
        footnote: "You're receiving this because you uploaded this document.",
      },
    ];
  },

  documents_complete: async ({ shipment }) => [
    {
      to: await coordinatorsOf(shipment.transportOrgId),
      subject: `Documents complete: ${shipment.reference}`,
      heading: "All mandatory documents are in",
      paragraphs: [
        `Every mandatory document for "${shipment.title}" has been uploaded. Review them, then assign a vehicle and driver.`,
      ],
      cta: "Assign vehicle and driver",
      footnote: orgFootnote(shipment.transportOrg),
    },
  ],

  execution_assigned: async ({ shipment }) => {
    const driver = shipment.assignedDriver;
    const vehicle = shipment.assignedVehicle;
    return [
      {
        to: [driver],
        subject: `New assignment: ${shipment.reference}`,
        heading: "You've been assigned a shipment",
        paragraphs: [
          `${shipment.transportOrg?.name} assigned you to drive "${shipment.title}". Record the pickup on the shipment timeline when you collect the cargo.`,
        ],
        details: [["Vehicle", vehicle ? `${vehicle.plateNumber}${vehicle.model ? ` · ${vehicle.model}` : ""}` : null]],
        cta: "Open the assignment",
        footnote: "You're receiving this because you're the assigned driver.",
      },
      {
        to: await coordinatorsOf(shipment.distributionOrgId),
        subject: `Vehicle and driver assigned: ${shipment.reference}`,
        heading: "Your shipment is ready to move",
        paragraphs: [`${shipment.transportOrg?.name} assigned a vehicle and driver to "${shipment.title}".`],
        details: [
          ["Driver", fullName(driver)],
          ["Vehicle", vehicle?.plateNumber],
        ],
        cta: "Open the shipment",
        footnote: orgFootnote(shipment.distributionOrg),
      },
    ];
  },

  exception_opened: async ({ shipment, metadata, actor }) => {
    const exception = metadata?.exceptionId ? await shipment_exceptions.findByPk(metadata.exceptionId) : null;
    const message = {
      subject: `Exception on ${shipment.reference}: ${humanize(metadata?.type)} (${metadata?.severity})`,
      heading: "An exception was opened",
      paragraphs: [
        `${fullName(actor) || "A shipment party"} reported ${humanize(metadata?.type)} on "${shipment.title}". The shipment can't be completed until it's resolved.`,
      ],
      details: [
        ["Severity", metadata?.severity],
        ["Notes", exception?.notes],
      ],
      cta: "Review the exception",
    };
    return [
      { ...message, to: await coordinatorsOf(shipment.distributionOrgId), footnote: orgFootnote(shipment.distributionOrg) },
      { ...message, to: await coordinatorsOf(shipment.transportOrgId), footnote: orgFootnote(shipment.transportOrg) },
      { ...message, to: await coordinatorsOf(shipment.clearingAgentOrgId), footnote: orgFootnote(shipment.clearingAgentOrg) },
    ];
  },

  pod_captured: async ({ shipment, metadata }) => [
    {
      to: await coordinatorsOf(shipment.distributionOrgId),
      subject: `Delivered: ${shipment.reference}`,
      heading: "Proof of delivery captured",
      paragraphs: [`"${shipment.title}" was delivered. Confirm receipt to complete the shipment.`],
      details: [["Received by", metadata?.podRecipientName]],
      cta: "Confirm and complete",
      footnote: orgFootnote(shipment.distributionOrg),
    },
  ],

  shipment_completed: async ({ shipment }) => {
    const message = {
      subject: `Completed: ${shipment.reference}`,
      heading: "Shipment completed",
      paragraphs: [`${shipment.distributionOrg?.name} confirmed receipt and completed "${shipment.title}".`],
      cta: "Open the shipment",
    };
    return [
      { ...message, to: await coordinatorsOf(shipment.transportOrgId), footnote: orgFootnote(shipment.transportOrg) },
      { ...message, to: await coordinatorsOf(shipment.clearingAgentOrgId), footnote: orgFootnote(shipment.clearingAgentOrg) },
    ];
  },

  shipment_cancelled: async ({ shipment }) => {
    const message = {
      subject: `Cancelled: ${shipment.reference}`,
      heading: "Shipment cancelled",
      paragraphs: [`${shipment.distributionOrg?.name} cancelled "${shipment.title}". No further action is needed.`],
      cta: "Open the shipment",
    };
    return [
      { ...message, to: await coordinatorsOf(shipment.transportOrgId), footnote: orgFootnote(shipment.transportOrg) },
      { ...message, to: await coordinatorsOf(shipment.clearingAgentOrgId), footnote: orgFootnote(shipment.clearingAgentOrg) },
      {
        ...message,
        to: [shipment.assignedDriver],
        footnote: "You're receiving this because you were the assigned driver.",
      },
    ];
  },
};

/** Event types that send email. */
export const NOTIFIED_SHIPMENT_EVENTS = Object.keys(SHIPMENT_RULES);

/**
 * Queues the emails for a shipment event, if the event has a rule.
 * @param {string} eventType a shipment event type, or "quote_submitted"
 */
export const notifyShipmentEvent = (eventType, { shipmentId, actorUserId = null, metadata } = {}) => {
  const rule = SHIPMENT_RULES[eventType];
  if (!rule) return;

  track(async () => {
    const shipment = await loadShipment(shipmentId);
    if (!shipment) return;
    const actor = await userById(actorUserId);
    const audiences = await rule({ shipment, metadata, actor });
    const link = appUrl(`/dashboard/shipments/${shipment.id}`);
    const shipmentDetails = [
      ["Shipment", `${shipment.reference} · ${shipment.title}`],
      ["Route", `${shipment.originAddress} → ${shipment.destinationAddress}`],
    ];

    await deliver(
      audiences.map((audience) => ({
        ...audience,
        details: [...shipmentDetails, ...(audience.details || [])],
        cta: { label: audience.cta, url: link },
      })),
      { actorUserId, tag: eventType },
    );
  });
};

// ── Account events ───────────────────────────────────────────────────────────

const ROLE_LABELS = { owner: "an owner", coordinator: "a coordinator", member: "a member", driver: "a driver" };

/**
 * Emails the code that proves a new sign-up owns its address. Where email
 * isn't configured outside production, the code is logged so local sign-up
 * still works.
 */
export const notifyVerificationCode = ({ email, firstName, code, expiresInMinutes }) =>
  track(async () => {
    if (emailMode() === "disabled" && process.env.NODE_ENV !== "production") {
      console.info(`[dev] Email is off. Verification code for ${email}: ${code}`);
      return;
    }
    await deliver(
      [
        {
          // Not a user yet, so the address stands in for the id when de-duplicating.
          to: [{ id: `signup:${email}`, email, firstName }],
          subject: `${code} is your Gobi verification code`,
          heading: "Confirm your email",
          paragraphs: [
            `Hi ${firstName}, enter this code on the sign-up page to finish creating your Gobi account.`,
            `It expires in ${expiresInMinutes} minutes.`,
          ],
          code,
          footnote: `You're receiving this because someone started creating a Gobi account with ${email}. If it wasn't you, you can ignore this email; no account is created without the code.`,
        },
      ],
      { tag: "verify_email" },
    );
  });

/** Welcome email after registration. */
export const notifyWelcome = (user) =>
  track(() =>
    deliver(
      [
        {
          to: [user],
          subject: "Welcome to Gobi",
          heading: `Welcome to Gobi, ${user.firstName}`,
          paragraphs: [
            "Your account is ready. Set up your company's workspace, or ask an owner or coordinator to add you to theirs using this email address.",
          ],
          cta: { label: "Open Gobi", url: appUrl("/dashboard") },
          footnote: "You're receiving this because you created a Gobi account.",
        },
      ],
      { tag: "welcome" },
    ),
  );

/** Tells a user they were added to an organization. */
export const notifyMemberAdded = ({ userId, organizationId, role, actorUserId }) =>
  track(async () => {
    const [user, organization, actor] = await Promise.all([
      userById(userId),
      organizations.findByPk(organizationId, { attributes: orgAttributes }),
      userById(actorUserId),
    ]);
    await deliver(
      [
        {
          to: [user],
          subject: `You've been added to ${organization?.name}`,
          heading: `You're now part of ${organization?.name}`,
          paragraphs: [
            `${fullName(actor) || "An administrator"} added you to ${organization?.name} as ${ROLE_LABELS[role] || role}. Sign in to see its shipments.`,
          ],
          cta: { label: "Open Gobi", url: appUrl("/dashboard") },
          footnote: `You're receiving this because you were added to ${organization?.name} on Gobi.`,
        },
      ],
      { actorUserId, tag: "member_added" },
    );
  });

/**
 * Emails an invitation: to someone without a Gobi account yet, or to an
 * existing account asked to be a driver (`hasAccount`), who accepts it to join.
 */
export const notifyInvitation = ({ email, token, organizationId, role, expiresAt, actorUserId, hasAccount = false }) =>
  track(async () => {
    const [organization, actor] = await Promise.all([
      organizations.findByPk(organizationId, { attributes: orgAttributes }),
      userById(actorUserId),
    ]);
    const inviter = fullName(actor) || "An administrator";
    await deliver(
      [
        {
          // The invitee may not be a user yet, so the address stands in for the id when de-duplicating.
          to: [{ id: `invite:${email}`, email }],
          subject: `${inviter} invited you to ${organization?.name} on Gobi`,
          heading: `Join ${organization?.name} on Gobi`,
          paragraphs: [
            `${inviter} invited you to join ${organization?.name} as ${ROLE_LABELS[role] || role}.`,
            hasAccount
              ? "Sign in to Gobi with this email address and accept the invitation. Nothing changes until you do."
              : "Create your Gobi account with this email address, then accept the invitation to see the company's shipments.",
          ],
          details: [
            ["Organization", organization?.name],
            ["Role", humanize(role)],
            ["Expires", new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })],
          ],
          cta: { label: "View invitation", url: appUrl(`/invite/${token}`) },
          footnote: `You're receiving this because ${inviter} invited ${email} to ${organization?.name} on Gobi. If you weren't expecting it, you can ignore this email.`,
        },
      ],
      { actorUserId, tag: "member_invited" },
    );
  });

/** Tells a driver the result of their licence review. */
export const notifyDriverProfileReviewed = ({ userId, status, actorUserId }) =>
  track(async () => {
    const approved = status === "approved";
    await deliver(
      [
        {
          to: [await userById(userId)],
          subject: approved ? "Your driver licence was approved" : "Your driver licence needs attention",
          heading: approved ? "Your licence was approved" : "Your licence was not approved",
          paragraphs: [
            approved
              ? "Your licence details passed review, so carriers can now assign you to shipments."
              : "A Gobi administrator couldn't approve your licence details. Check them and submit them again.",
          ],
          cta: { label: "Open My licence", url: appUrl("/dashboard/licence") },
          footnote: "You're receiving this because you submitted your licence on Gobi.",
        },
      ],
      { actorUserId, tag: approved ? "driver_approved" : "driver_rejected" },
    );
  });
