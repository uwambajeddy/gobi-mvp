/**
 * Transactional email through Brevo's HTTP API (no SDK needed).
 *
 * - Tests never send: messages go to an in-memory outbox instead.
 * - EMAIL_REDIRECT_TO sends every message to one inbox (useful for demos,
 *   where the seeded accounts' addresses cannot receive mail).
 * - Without BREVO_API_KEY and BREVO_SENDER_EMAIL, or with EMAIL_ENABLED=false,
 *   sending is skipped.
 *
 * Callers should not await delivery for the user's request; failures are
 * logged and never surface as API errors.
 */

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

/** Messages "sent" while NODE_ENV=test, newest last. */
export const testOutbox = [];

/** "memory" in tests, "brevo" when configured, otherwise "disabled". */
export const emailMode = () => {
  if (process.env.NODE_ENV === "test") return "memory";
  if (process.env.EMAIL_ENABLED === "false") return "disabled";
  return process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL ? "brevo" : "disabled";
};

let warnedDisabled = false;

/**
 * Sends one message to one recipient.
 * @param {{to: {email: string, name?: string}, subject: string, html: string, text: string, tag?: string}} message
 * @returns {Promise<{status: "sent" | "skipped" | "failed", id?: string}>}
 */
export const sendEmail = async ({ to, subject, html, text, tag }) => {
  const mode = emailMode();

  if (mode === "memory") {
    testOutbox.push({ to, subject, html, text, tag });
    return { status: "sent" };
  }
  if (mode === "disabled") {
    if (!warnedDisabled) {
      console.warn("Email is not configured (BREVO_API_KEY / BREVO_SENDER_EMAIL); skipping notifications.");
      warnedDisabled = true;
    }
    return { status: "skipped" };
  }

  const redirect = process.env.EMAIL_REDIRECT_TO;
  const recipient = redirect ? { email: redirect } : to;
  const finalSubject = redirect ? `[for ${to.email}] ${subject}` : subject;

  try {
    const response = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: process.env.BREVO_SENDER_EMAIL,
          name: process.env.BREVO_SENDER_NAME || "Gobi",
        },
        to: [recipient],
        subject: finalSubject,
        htmlContent: html,
        textContent: text,
        ...(tag ? { tags: [tag] } : {}),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`Email to ${recipient.email} failed (${response.status}): ${body.message || "unknown error"}`);
      return { status: "failed" };
    }
    return { status: "sent", id: body.messageId };
  } catch (error) {
    console.error(`Email to ${recipient.email} failed: ${error.message}`);
    return { status: "failed" };
  }
};
