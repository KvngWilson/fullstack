const session = require("express-session");
const { RedisStore } = require("connect-redis");
const { logger } = require("../shared/utils/logger");
const { redisClient } = require("./redis");

function buildSessionConfig(options = {}) {
  const {
    cookieName,
    cookie = {},
  } = options;

  return {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    ...(cookieName ? { name: cookieName } : {}),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      ...cookie,
    },
  };
}

function applySessionMiddleware(app, options = {}) {
  try {
    app.use(
      session({
        ...buildSessionConfig(options),
        store: new RedisStore({ client: redisClient }),
      }),
    );
    logger.info("Using Redis store for sessions");
  } catch (error) {
    logger.warn("Redis store unavailable, using memory store for sessions", {
      error: error.message,
    });
    app.use(session(buildSessionConfig(options)));
  }
}

module.exports = {
  applySessionMiddleware,
};
