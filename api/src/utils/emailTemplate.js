/**
 * One branded layout for every notification. Table-based with inline styles
 * so it renders in email clients; every dynamic value is HTML-escaped.
 */

const COLORS = {
  canvas: "#F4F5F7",
  surface: "#FFFFFF",
  line: "#E6E8EC",
  ink: "#0F1A33",
  muted: "#5F6B7E",
  action: "#C74A2E",
};

const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );

/** Absolute link into the web app, e.g. appUrl("/dashboard/shipments/7"). */
export const appUrl = (path = "/dashboard") =>
  `${(process.env.WEB_APP_URL || "http://localhost:3000").replace(/\/+$/, "")}${path}`;

/**
 * Absolute URL of a file in the web app's public folder. Mail clients fetch
 * images from the internet, so EMAIL_ASSET_URL can point at a public host
 * while WEB_APP_URL is still localhost.
 */
const assetUrl = (path) =>
  `${(process.env.EMAIL_ASSET_URL || process.env.WEB_APP_URL || "http://localhost:3000").replace(/\/+$/, "")}${path}`;

// PNG, not SVG: Gmail and Outlook do not render SVG images. Drawn at 3x.
const LOGO = { path: "/brand/logo-email.png", width: 68, height: 32 };

/**
 * @param {object} content
 * @param {string} content.heading
 * @param {string[]} content.paragraphs plain text, escaped here
 * @param {string} [content.code] one-time code, shown large after the paragraphs
 * @param {Array<[string, string]>} [content.details] label/value rows
 * @param {{label: string, url: string}} [content.cta]
 * @param {string} [content.footnote] why the recipient got this email
 * @returns {{html: string, text: string}}
 */
export const renderEmail = ({ heading, paragraphs = [], code, details = [], cta, footnote }) => {
  const detailRows = details
    .filter(([, value]) => value)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 0;color:${COLORS.muted};font-size:13px;width:120px;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:${COLORS.ink};font-size:13px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.canvas};font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.canvas};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:0 4px 16px;">
          <a href="${escapeHtml(appUrl("/"))}" style="text-decoration:none;">
            <img src="${escapeHtml(assetUrl(LOGO.path))}" width="${LOGO.width}" height="${LOGO.height}" alt="Gobi" style="display:block;border:0;outline:none;width:${LOGO.width}px;height:${LOGO.height}px;color:${COLORS.ink};font-family:${FONT};font-size:20px;font-weight:700;line-height:${LOGO.height}px;">
          </a>
        </td></tr>
        <tr><td style="background:${COLORS.surface};border:1px solid ${COLORS.line};border-radius:18px;padding:28px;">
          <h1 style="margin:0 0 12px;color:${COLORS.ink};font-size:20px;line-height:28px;font-weight:600;">${escapeHtml(heading)}</h1>
          ${paragraphs
            .map((text) => `<p style="margin:0 0 12px;color:${COLORS.muted};font-size:14px;line-height:22px;">${escapeHtml(text)}</p>`)
            .join("")}
          ${
            code
              ? `<div style="margin:16px 0 8px;padding:16px 0;background:${COLORS.canvas};border:1px solid ${COLORS.line};border-radius:12px;text-align:center;color:${COLORS.ink};font-family:'SFMono-Regular', Consolas, 'Liberation Mono', monospace;font-size:30px;font-weight:700;letter-spacing:10px;">${escapeHtml(code)}</div>`
              : ""
          }
          ${
            detailRows
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border-top:1px solid ${COLORS.line};border-bottom:1px solid ${COLORS.line};padding:6px 0;">${detailRows}</table>`
              : ""
          }
          ${
            cta
              ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr><td style="background:${COLORS.action};border-radius:10px;">
                  <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:11px 20px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(cta.label)}</a>
                </td></tr></table>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:16px 4px 0;color:${COLORS.muted};font-size:12px;line-height:18px;">
          ${footnote ? `${escapeHtml(footnote)}<br>` : ""}Gobi · Shipment coordination
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    heading,
    "",
    ...paragraphs,
    ...(code ? ["", `Your code: ${code}`] : []),
    ...(details.some(([, value]) => value) ? ["", ...details.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`)] : []),
    ...(cta ? ["", `${cta.label}: ${cta.url}`] : []),
    "",
    ...(footnote ? [footnote] : []),
    "Gobi · Shipment coordination",
  ].join("\n");

  return { html, text };
};
