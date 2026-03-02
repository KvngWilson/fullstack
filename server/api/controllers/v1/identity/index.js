/**
 * Identity Domain Controllers
 * Exports user, profile, and employee management controllers
 */

const user = require("./user");
const profile = require("./profile");
const employees = require("./employees");

module.exports = {
  user,
  profile,
  employees,
};
