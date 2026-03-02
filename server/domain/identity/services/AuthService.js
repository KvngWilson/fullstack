const argon2 = require("argon2");
const { redisClient } = require("../../../config/redis");
const { validateEmail, validatePassword } = require("../../../shared/utils/validate");
const { generateToken } = require("../../../config/auth");
const userRepository = require("../repositories/UserRepository");

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

const LOGIN_LOCK_THRESHOLD = Number.parseInt(process.env.LOGIN_LOCK_THRESHOLD || "5", 10);
const LOGIN_LOCK_WINDOW_SECONDS = Number.parseInt(process.env.LOGIN_LOCK_WINDOW_SECONDS || "900", 10);

function loginAttemptKey(email) {
  return `login_attempts:${email}`;
}

function loginLockKey(email) {
  return `login_lock:${email}`;
}

function lockUntilIso() {
  return new Date(Date.now() + LOGIN_LOCK_WINDOW_SECONDS * 1000).toISOString();
}

async function isLocked(email) {
  if (!redisClient?.isReady) return false;
  const value = await redisClient.get(loginLockKey(email));
  return Boolean(value);
}

async function recordFailedAttempt(email) {
  if (!redisClient?.isReady) return 0;

  const attempts = await redisClient.incr(loginAttemptKey(email));
  await redisClient.expire(loginAttemptKey(email), LOGIN_LOCK_WINDOW_SECONDS);

  if (attempts >= LOGIN_LOCK_THRESHOLD) {
    await redisClient.setEx(loginLockKey(email), LOGIN_LOCK_WINDOW_SECONDS, "locked");
  }

  return attempts;
}

async function clearFailedAttempts(email) {
  if (!redisClient?.isReady) return;
  await redisClient.del([loginAttemptKey(email), loginLockKey(email)]);
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

  const existingUser = await userRepository.findByEmail(normalizedEmail);
  if (existingUser && !existingUser.deleted_at) {
    return {
      user: null,
      token: null,
      alreadyRegistered: true,
    };
  }

  const created = await userRepository.createCustomer({
    email: normalizedEmail,
    password,
  });

  const user = sanitizeUser(created);

  return {
    user,
    token: null,
    alreadyRegistered: false,
  };
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new AuthServiceError("Email and password are required", 400);
  }

  if (await isLocked(normalizedEmail)) {
    throw new AuthServiceError(
      `Too many failed attempts. Account locked until ${lockUntilIso()}`,
      429,
    );
  }

  const userRow = await userRepository.findByEmail(normalizedEmail);

  if (!userRow) {
    await recordFailedAttempt(normalizedEmail);
    throw new AuthServiceError("Invalid credentials", 401);
  }

  if (userRow.deleted_at || userRow.is_active === false) {
    throw new AuthServiceError("Account is inactive", 403);
  }

  const isValidPassword = await argon2.verify(userRow.password_hash, password);
  if (!isValidPassword) {
    const attempts = await recordFailedAttempt(normalizedEmail);

    if (attempts >= LOGIN_LOCK_THRESHOLD) {
      throw new AuthServiceError(
        `Too many failed attempts. Account locked until ${lockUntilIso()}`,
        429,
      );
    }

    throw new AuthServiceError("Invalid credentials", 401);
  }

  await clearFailedAttempts(normalizedEmail);

  await userRepository.updateLastLogin(userRow.id);

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
