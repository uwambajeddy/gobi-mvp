/**
 * Load test for the core read and auth paths.
 *
 *   API_URL=https://gobi-api-production.up.railway.app npm run test:load
 *
 * Defaults to the local API. Signs in as the seeded coordinator once, then
 * drives each scenario with autocannon and prints latency percentiles,
 * throughput and the error count. Read-only apart from the login scenario,
 * so it is safe to run against the demo deployment.
 */
const autocannon = require("autocannon");

const API_URL = (process.env.API_URL || "http://localhost:8080").replace(/\/$/, "");
const CONNECTIONS = Number(process.env.CONNECTIONS || 20);
const DURATION = Number(process.env.DURATION || 15);
const CREDENTIALS = { email: "coordinator@gobi.rw", password: "Password123!" };

const login = async () => {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CREDENTIALS),
  });
  if (!res.ok) throw new Error(`Login failed with ${res.status}`);
  const { data } = await res.json();
  return data.tokens.accessToken;
};

const run = (title, options) =>
  new Promise((resolve, reject) => {
    autocannon(
      { url: `${API_URL}${options.path}`, connections: CONNECTIONS, duration: DURATION, ...options },
      (err, result) => (err ? reject(err) : resolve({ title, result })),
    );
  });

const summarize = ({ title, result }) => ({
  scenario: title,
  requests: result.requests.total,
  "req/s": Math.round(result.requests.average),
  "p50 ms": result.latency.p50,
  "p90 ms": result.latency.p90,
  "p99 ms": result.latency.p99,
  "non-2xx": result.non2xx,
  errors: result.errors + result.timeouts,
});

const main = async () => {
  const token = await login();
  const auth = { authorization: `Bearer ${token}` };

  console.log(`Load test against ${API_URL}: ${CONNECTIONS} connections × ${DURATION}s per scenario\n`);

  const scenarios = [
    ["List shipments", { path: "/api/v1/shipments", headers: auth }],
    ["Shipment detail", { path: "/api/v1/shipments/2", headers: auth }],
    ["Shipment timeline", { path: "/api/v1/shipments/2/events", headers: auth }],
    [
      "Login (bcrypt)",
      {
        path: "/api/v1/auth/login",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(CREDENTIALS),
        connections: Math.min(CONNECTIONS, 10),
      },
    ],
  ];

  const rows = [];
  for (const [title, options] of scenarios) {
    rows.push(summarize(await run(title, options)));
  }
  console.table(rows);
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
