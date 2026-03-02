// User controller: handles user registration and login (legacy auth endpoints)
const logger = require("../../../../shared/utils/logger");
const { verifyToken, generateToken } = require("../../../../config/auth");
const domain = require("../../../../domain");
const {
  AuthServiceError,
  registerUser,
  loginUser,
  setAuthCookie,
} = domain.identity.services.AuthService;
const userService = domain.identity.services.UserService;

const register = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    await registerUser({ email, password });

    return res.status(200).json({
      message: "If email is new, check your inbox for registration link",
    });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return res.status(error.status).json({ error: error.message });
    }

    logger.error("Registration error", {
      email: req.body?.email,
      error: error.message,
    });

    return res.status(500).json({ error: "Registration failed" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const { user, token } = await loginUser({ email, password });
    setAuthCookie(res, token);

    return res.status(200).json({
      id: user.id,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return res.status(error.status).json({ error: error.message });
    }

    logger.error("Login error", {
      email: req.body?.email,
      error: error.message,
    });

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

    const decoded = verifyToken(refresh_token);
    if (!decoded?.id) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = await userService.getById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
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
