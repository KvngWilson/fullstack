require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const connectDB = async () => {
  try {
    await pool.connect();
    console.log("PostgreSQL connected!");
  } catch (err) {
    console.error("Connection error", err.stack);
    process.exit(1);
  }
};

module.exports = {
  pool,
  connectDB,
};
