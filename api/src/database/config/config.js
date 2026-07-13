const dotenv = require("dotenv");
const path = require("path");

// Load .env.test when running in test environment (before falling back to .env)
if (process.env.NODE_ENV === "test") {
  dotenv.config({
    path: path.resolve(__dirname, "..", "..", "..", ".env.test"),
    override: true,
  });
}
dotenv.config();

const { DATABASE_URL, DATABASE_URL_DEV, DATABASE_URL_TEST } = process.env;

module.exports = {
  development: {
    url: DATABASE_URL_DEV || DATABASE_URL,
    dialect: "postgres",
    logging: false,
  },
  test: {
    url: DATABASE_URL_TEST || DATABASE_URL_DEV,
    dialect: "postgres",
    logging: false,
  },
  production: {
    url: DATABASE_URL,
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
