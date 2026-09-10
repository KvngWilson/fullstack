const { createDbInfraGuard } = require("../../helpers/testHelpers");

describe("createDbInfraGuard", () => {
  const originalIt = global.it;
  const originalDbAvailable = global.__TEST_DB_AVAILABLE;
  const originalDbError = global.__TEST_DB_SETUP_ERROR;

  afterEach(() => {
    global.it = originalIt;
    global.__TEST_DB_AVAILABLE = originalDbAvailable;
    global.__TEST_DB_SETUP_ERROR = originalDbError;
  });

  it("fails explicitly when the test DB is unavailable", async () => {
    const registeredTests = [];
    global.it = (_name, fn) => {
      registeredTests.push(fn);
    };

    global.__TEST_DB_AVAILABLE = false;
    global.__TEST_DB_SETUP_ERROR = new Error("connect ECONNREFUSED");

    const body = jest.fn();
    const { dbTest } = createDbInfraGuard();
    dbTest("requires DB", body);

    await expect(registeredTests[0]()).rejects.toThrow(
      "DB-backed test could not run: connect ECONNREFUSED",
    );
    expect(body).not.toHaveBeenCalled();
  });

  it("fails explicitly when suite setup disables DB-backed tests", async () => {
    const registeredTests = [];
    global.it = (_name, fn) => {
      registeredTests.push(fn);
    };

    global.__TEST_DB_AVAILABLE = true;
    global.__TEST_DB_SETUP_ERROR = null;

    const body = jest.fn();
    const { disable, dbTest } = createDbInfraGuard();
    disable();
    dbTest("requires DB", body);

    await expect(registeredTests[0]()).rejects.toThrow(
      "DB-backed test could not run: DB-backed suite setup did not complete successfully.",
    );
    expect(body).not.toHaveBeenCalled();
  });
});
