// Authentication controller: handles login, registration, logout, token verification
const logger = require("../../../../shared/utils/logger");
const domain = require("../../../../domain");
const AuthenticationService = domain.identity.services.AuthenticationService;

function safeRedirect(target, fallback = "/") {
  if (typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
}

function getAuthenticatedUser(req) {
  const token = req.cookies?.token || req.cookies?.access_token;
  if (!token) {
    return null;
  }

  return AuthenticationService.verifyJWT(token);
}

function renderLogin(req, res) {
  const user = getAuthenticatedUser(req);
  const returnTo = safeRedirect(req.query.returnTo, "/");

  if (user) {
    return res.redirect(returnTo);
  }

  return res.render("auth/login", {
    title: "Login",
    user: null,
    cartCount: 0,
    error_msg: req.query.error || "",
    success_msg: req.query.success || "",
    form: {
      email: req.query.email || "",
      returnTo,
    },
  });
}

function renderRegister(req, res) {
  const user = getAuthenticatedUser(req);
  const returnTo = safeRedirect(req.query.returnTo, "/");

  if (user) {
    return res.redirect(returnTo);
  }

  return res.render("auth/register", {
    title: "Register",
    user: null,
    cartCount: 0,
    error_msg: req.query.error || "",
    success_msg: req.query.success || "",
    form: {
      email: req.query.email || "",
      returnTo,
    },
  });
}

async function postRegister(req, res) {
  const { email, password, confirmPassword, returnTo } = req.body || {};

  if (!password || password !== confirmPassword) {
    return res.status(400).render("auth/register", {
      title: "Register",
      user: null,
      cartCount: 0,
      error_msg: "Passwords do not match",
      success_msg: "",
      form: {
        email: email || "",
        returnTo: safeRedirect(returnTo, "/"),
      },
    });
  }

  try {
    await registerUser({ email, password });

    return res.status(200).render("auth/register", {
      title: "Register",
      user: null,
      cartCount: 0,
      error_msg: "",
      success_msg: "If email is new, check your inbox for registration link",
      form: {
        email: email || "",
        returnTo: safeRedirect(returnTo, "/"),
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).render("auth/register", {
        title: "Register",
        user: null,
        cartCount: 0,
        error_msg: error.message,
        success_msg: "",
        form: {
          email: email || "",
          returnTo: safeRedirect(returnTo, "/"),
        },
      });
    }

    logger.error("Registration failed", { error: error.message });
    return res.status(500).render("auth/register", {
      title: "Register",
      user: null,
      cartCount: 0,
      error_msg: "Registration failed. Please try again.",
      success_msg: "",
      form: {
        email: email || "",
        returnTo: safeRedirect(returnTo, "/"),
      },
    });
  }
}

async function postLogin(req, res) {
  const { email, password, returnTo } = req.body || {};

  try {
    const { token } = await loginUser({ email, password });
    setAuthCookie(res, token);

    return res.redirect(safeRedirect(returnTo, "/"));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).render("auth/login", {
        title: "Login",
        user: null,
        cartCount: 0,
        error_msg: error.message,
        success_msg: "",
        form: {
          email: email || "",
          returnTo: safeRedirect(returnTo, "/"),
        },
      });
    }

    logger.error("Login failed", { error: error.message });
    return res.status(500).render("auth/login", {
      title: "Login",
      user: null,
      cartCount: 0,
      error_msg: "Login failed. Please try again.",
      success_msg: "",
      form: {
        email: email || "",
        returnTo: safeRedirect(returnTo, "/"),
      },
    });
  }
}

function postLogout(req, res) {
  clearAuthCookie(res);
  return res.redirect("/login?success=Signed%20out%20successfully");
}

module.exports = {
  renderLogin,
  renderRegister,
  postRegister,
  postLogin,
  postLogout,
};
