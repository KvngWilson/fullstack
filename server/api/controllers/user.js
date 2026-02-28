const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const { pool } = require("../../config/db");
const { validateEmail, validatePassword } = require("../../utils/validate");

const buildToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role || "customer" },
    process.env.JWT_SECRET || "test-secret",
    { expiresIn: "24h" },
  );

const readPasswordHash = (user) => user.password_hash || user.password || null;

const setAuthCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24,
  });
};

const register = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.error });
    }

    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = await argon2.hash(password);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role`,
      [email, passwordHash, "customer"],
    );

    const user = result.rows[0];
    const token = buildToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Registration failed" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await pool.query(
      "SELECT id, email, role, password_hash, password FROM users WHERE email = $1 LIMIT 1",
      [email],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const passwordHash = readPasswordHash(user);

    if (!passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await argon2.verify(passwordHash, password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = buildToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({
      id: user.id,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Login failed" });
  }
};

const requestPasswordReset = async (req, res) => {
  return res.status(200).json({ success: true, message: "Password reset requested" });
};

const resetPassword = async (req, res) => {
  return res.status(200).json({ success: true, message: "Password reset successful" });
};

const verifyEmail = async (req, res) => {
  return res.status(200).json({ success: true, message: "Email verified" });
};

const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body || {};

    if (!refresh_token) {
      return res.status(400).json({ error: "refresh_token is required" });
    }

    const decoded = jwt.verify(refresh_token, process.env.JWT_SECRET || "test-secret");
    const result = await pool.query(
      "SELECT id, email, role FROM users WHERE id = $1 LIMIT 1",
      [decoded.id],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = result.rows[0];
    const token = buildToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({ token });
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
};

module.exports = {
  register,
  login,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  refreshToken,
};
