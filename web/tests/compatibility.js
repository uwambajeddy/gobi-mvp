// Cross-browser smoke walkthrough of the deployed Gobi web app.
// Usage (from web/): npm run test:compat   (writes to docs/testing/compatibility)
// Needs the Playwright browsers once: npx playwright install firefox webkit
const { chromium, firefox, webkit, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "https://gobi-mvp.netlify.app";
const OUT = process.argv[2] || path.join(__dirname, "..", "..", "docs", "testing", "compatibility");
fs.mkdirSync(OUT, { recursive: true });

const TARGETS = [
  { name: "Chrome (Windows 11)", slug: "chrome", type: chromium, launch: { channel: "chrome" }, ctx: { viewport: { width: 1366, height: 768 } } },
  { name: "Edge (Windows 11)", slug: "edge", type: chromium, launch: { channel: "msedge" }, ctx: { viewport: { width: 1366, height: 768 } } },
  { name: "Firefox (Windows 11)", slug: "firefox", type: firefox, launch: {}, ctx: { viewport: { width: 1366, height: 768 } } },
  { name: "WebKit / Safari engine", slug: "webkit", type: webkit, launch: {}, ctx: { viewport: { width: 1366, height: 768 } } },
  { name: "Android phone (Pixel 7, Chromium)", slug: "android", type: chromium, launch: {}, ctx: devices["Pixel 7"] },
  { name: "iPhone 14 (WebKit)", slug: "iphone", type: webkit, launch: {}, ctx: devices["iPhone 14"] },
];

const run = async (t) => {
  const result = { target: t.name, steps: [], consoleErrors: [], pageErrors: [] };
  const browser = await t.type.launch({ headless: true, ...t.launch });
  result.version = browser.version();
  const context = await browser.newContext(t.ctx);
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && result.consoleErrors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => result.pageErrors.push(String(e.message).slice(0, 200)));

  const step = async (label, fn) => {
    const started = Date.now();
    try {
      await fn();
      result.steps.push({ label, ok: true, ms: Date.now() - started });
    } catch (err) {
      result.steps.push({ label, ok: false, ms: Date.now() - started, error: err.message.split("\n")[0] });
      throw err;
    }
  };
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${t.slug}-${name}.jpg`), type: "jpeg", quality: 60 });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  try {
    await step("Landing page loads", async () => {
      await page.goto(BASE, { waitUntil: "load", timeout: 60000 });
      await page.getByRole("link", { name: /sign in/i }).first().waitFor({ timeout: 20000 });
      await shot("1-landing");
    });
    await step("Sign in as shipper", async () => {
      await page.goto(`${BASE}/signin`, { waitUntil: "load" });
      await page.locator('input[type="email"]').fill("shipper@gobi.rw");
      await page.locator('input[type="password"]').fill("Password123!");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });
      await page.getByText(/GB-2026-/).first().waitFor({ timeout: 30000 });
      await shot("2-dashboard");
    });
    await step("Shipments list and filter", async () => {
      await page.goto(`${BASE}/dashboard/shipments`, { waitUntil: "load" });
      await page.locator("text=GB-2026-0002 >> visible=true").first().waitFor({ timeout: 30000 });
    });
    await step("Open cross-border shipment", async () => {
      await page.locator("text=GB-2026-0002 >> visible=true").first().click();
      await page.waitForURL(/\/dashboard\/shipments\/\d+/, { timeout: 30000 });
      await page.getByRole("tab", { name: /timeline/i }).or(page.getByText("Timeline", { exact: true })).first().waitFor({ timeout: 30000 });
    });
    result.consoleErrors.length = 0;
    result.pageErrors.length = 0;
    await step("Route measured (Google Maps)", async () => {
      await page.getByText(/km by road/).first().waitFor({ timeout: 25000 });
      await page.waitForTimeout(3000);
      await shot("3-shipment");
    }).catch(() => {});
    await step("Timeline and Documents tabs", async () => {
      await page.getByRole("tab", { name: /timeline/i }).or(page.getByText("Timeline", { exact: true })).first().click();
      await page.waitForTimeout(800);
      await page.getByRole("tab", { name: /documents/i }).or(page.getByText("Documents", { exact: true })).first().click();
      await page.waitForTimeout(800);
      await shot("4-documents");
    });
    result.horizontalOverflowPx = await overflow();
  } catch {
    await shot("failure").catch(() => {});
  } finally {
    await browser.close();
  }
  result.passed = result.steps.length === 6 && result.steps.every((s) => s.ok);
  return result;
};

(async () => {
  const results = [];
  for (const t of TARGETS) {
    const r = await run(t);
    results.push(r);
    console.log(`${r.passed ? "PASS" : "FAIL"}  ${r.target}  v${r.version}  steps=${r.steps.map((s) => `${s.ok ? "ok" : "X"}:${s.ms}ms`).join(",")}  overflow=${r.horizontalOverflowPx}  consoleErrors=${r.consoleErrors.length} pageErrors=${r.pageErrors.length}`);
    const failed = r.steps.find((s) => !s.ok);
    if (failed) console.log(`      failed at "${failed.label}": ${failed.error}`);
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
})();
