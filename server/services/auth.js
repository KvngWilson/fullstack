const argon2 = require("argon2");
const { pool } = require("../config/db");
const { validateEmail, validatePassword } = require("../utils/validate");
const { generateToken } = require("../config/auth");

class AuthServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AuthServiceError";
    this.status = status;
  }
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function sanitizeUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role || "customer",
  };
}

async function registerUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new AuthServiceError("Email and password are required", 400);
  }

  if (!validateEmail(normalizedEmail)) {
    throw new AuthServiceError("Invalid email format", 400);
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    throw new AuthServiceError(passwordCheck.error, 400);
  }

  const existingUser = await pool.query(
    `SELECT id
     FROM users
     WHERE email = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [normalizedEmail],
  );

  if (existingUser.rows.length > 0) {
    throw new AuthServiceError("User already exists", 409);
  }

  const passwordHash = await argon2.hash(password);

  const created = await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING id, email, role`,
    [normalizedEmail, passwordHash, "customer"],
  );

  const user = sanitizeUser(created.rows[0]);
  const token = generateToken({ id: user.id, email: user.email, role: user.role });

  return { user, token };
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new AuthServiceError("Email and password are required", 400);
  }

  const result = await pool.query(
    `SELECT id, email, role, password_hash, is_active, deleted_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail],
  );

  if (result.rows.length === 0) {
    throw new AuthServiceError("Invalid credentials", 401);
  }

  const userRow = result.rows[0];

  if (userRow.deleted_at || userRow.is_active === false) {
    throw new AuthServiceError("Account is inactive", 403);
  }

  const isValidPassword = await argon2.verify(userRow.password_hash, password);
  if (!isValidPassword) {
    throw new AuthServiceError("Invalid credentials", 401);
  }

  await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [userRow.id]);

  const user = sanitizeUser(userRow);
  const token = generateToken({ id: user.id, email: user.email, role: user.role });

  return { user, token };
}

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24,
  });
}

function clearAuthCookie(res) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
}

module.exports = {
  AuthServiceError,
  registerUser,
  loginUser,
  setAuthCookie,
  clearAuthCookie,
};
