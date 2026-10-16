import { asUser } from "./auth.helper";
import { testOutbox } from "../../src/services/email.service";
import { flushNotifications } from "../../src/services/notifications.service";

/** The latest invitation token emailed to `email` (the test outbox stands in for the inbox). */
export const invitationToken = async (email) => {
  await flushNotifications();
  const message = [...testOutbox]
    .reverse()
    .find((m) => m.to.email === email && m.tag === "member_invited");
  return message?.text.match(/\/invite\/([a-f0-9]{64})/)?.[1];
};

/**
 * Makes `person` (an existing account) a driver of the organization the way
 * a real driver joins: `actor` invites them, then they accept.
 * Returns the accepted membership.
 */
export const enrollDriver = async (actor, organizationId, person) => {
  const invited = await asUser(actor.tokens).post(`/api/v1/organizations/${organizationId}/members`, {
    email: person.user.email,
    role: "driver",
  });
  if (invited.status !== 201 || !invited.body.data.invitation) {
    throw new Error(`Driver invitation failed: ${JSON.stringify(invited.body)}`);
  }

  const token = await invitationToken(person.user.email);
  const accepted = await asUser(person.tokens).post(`/api/v1/invitations/${token}/accept`);
  if (accepted.status !== 200) {
    throw new Error(`Driver acceptance failed: ${JSON.stringify(accepted.body)}`);
  }
  return accepted.body.data.membership;
};
