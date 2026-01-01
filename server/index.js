"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const swaggerUI = require("swagger-ui-express");
const yaml = require("js-yaml");

const app = express();

const PORT = process.env.PORT || 5000;

// Load Swagger documentation
const swaggerPath = path.join(__dirname, "swagger.yml");
const swaggerSpec = yaml.load(fs.readFileSync(swaggerPath, "utf8"));

app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerSpec));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(morgan("dev"));

// Sample route
app.get("/", (req, res) => {
  res.send("Welcome to the E-Comm API Server.");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
