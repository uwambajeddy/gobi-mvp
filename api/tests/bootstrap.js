process.env.NODE_ENV = "test";

const path = require("path");
const dotenv = require("dotenv");

const envTestPath = path.resolve(__dirname, "..", ".env.test");
const result = dotenv.config({ path: envTestPath, override: true });

if (result.error) {
  console.warn(
    "\n⚠️  No .env.test file found. Copy from .env.test.example:\n" +
      "   cp .env.test.example .env.test\n" +
      "   Then edit DATABASE_URL_TEST to point to your local test database.\n",
  );
  console.warn("   Falling back to current environment variables.\n");
}

const defaults = {
  PORT: "8080",
  JWT_ACCESS_SECRET: "test-access-secret",
  JWT_REFRESH_SECRET: "test-refresh-secret",
  JWT_ACCESS_TIME: "15m",
  JWT_REFRESH_TIME: "30d",
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
