const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env.test"),
  quiet: true,
});

const {
  alignDatabaseEnv,
  verifyCurrentTestSchema,
} = require("../scripts/verify-test-db-schema");

alignDatabaseEnv();

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-for-testing-only";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "test-session-secret-key-for-testing-only-123456";

global.console = {
  ...console,
  log: jest.fn(),
};

jest.setTimeout(10000);

global.__TEST_DB_AVAILABLE = true;
global.__TEST_DB_SETUP_ERROR = null;

function currentTestNeedsDb() {
  const testFile = expect.getState().testPath || "";
  return (
    testFile.includes("/integration/") ||
    testFile.includes("/e2e/") ||
    testFile.includes("/security/")
  );
}

function isMockedDbPool(pool) {
  return Boolean(pool?.query && jest.isMockFunction(pool.query));
}

function isTestDbUnavailableError(error) {
  return [
    "ECONNREFUSED",
    "ENOTFOUND",
    "28P01",
    "28000",
    "3D000",
    "57P03",
  ].includes(error?.code);
}

beforeAll(async () => {
  const { pool } = require("../config/db");
  const requireTestDb = process.env.REQUIRE_TEST_DB === "true";

  if (isMockedDbPool(pool)) {
    return;
  }

  try {
    await pool.query("SELECT 1");
    await verifyCurrentTestSchema(pool);
  } catch (error) {
    global.__TEST_DB_AVAILABLE = false;
    global.__TEST_DB_SETUP_ERROR = error;

    if (requireTestDb) {
      throw new Error(
        `REQUIRE_TEST_DB=true but test DB setup failed: ${error.message}`,
      );
    }
    // Only surface DB unavailability for integration/e2e suites; unit tests
    // mock everything and do not need the database.
    if (currentTestNeedsDb()) {
      process.stderr.write(`Test DB setup unavailable: ${error.message}\n`);
    }
  }
});

beforeEach(async () => {
  if (!global.__TEST_DB_AVAILABLE || !currentTestNeedsDb()) {
    return;
  }

  const { pool } = require("../config/db");
  if (isMockedDbPool(pool)) {
    return;
  }

  try {
    await pool.query(
      "DELETE FROM users WHERE email IN ('other@test.com', 'other2@test.com', 'profile@test.com', 'payment@test.com', 'nopay@test.com')",
    );
  } catch (error) {
    if (isTestDbUnavailableError(error)) {
      global.__TEST_DB_AVAILABLE = false;
      global.__TEST_DB_SETUP_ERROR = global.__TEST_DB_SETUP_ERROR || error;
      return;
    }

    process.stderr.write(`Test cleanup warning: ${error.message}\n`);
  }
});

afterAll(async () => {});
