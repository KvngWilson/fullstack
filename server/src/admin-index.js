"use strict";

require("dotenv").config();

const { validateEnv } = require("../config/env");
const { createAdminApp } = require("./admin-app");
const { startServer } = require("./setup");

const PORT = process.env.ADMIN_PORT || process.env.PORT || 5000;

validateEnv();

const adminApp = createAdminApp();

startServer({ app: adminApp, port: PORT });
