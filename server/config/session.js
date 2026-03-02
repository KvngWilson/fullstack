const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { logger } = require("../shared/utils/logger");

function buildSessionConfig() {
  return {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  };
}

function applySessionMiddleware(app) {
  try {
    const { redisClient } = require("./redis");
    app.use(
      session({
        ...buildSessionConfig(),
        store: new RedisStore({ client: redisClient }),
      }),
    );
  } catch (error) {
    logger.warn("Redis not available, using memory store for sessions");
    app.use(session(buildSessionConfig()));
  }
}

module.exports = {
  applySessionMiddleware,
};
