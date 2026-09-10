/**
 * Identity Domain Controllers
 * Exports profile and employee management controllers
 */

const profile = require("./profile");
const employees = require("./employees");

module.exports = {
  profile,
  employees,
};
