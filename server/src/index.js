"use strict";

require("dotenv").config();
const { validateEnv } = require("../config/env");
const { createApp } = require("./app");
const { startServer } = require("./setup");

const PORT = process.env.PORT || 5000;
validateEnv();

const app = createApp();

// Start server
startServer({ app, port: PORT });
