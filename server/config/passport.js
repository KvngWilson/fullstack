const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const JWTStrategy = require("passport-jwt").Strategy;
const ExtractJWT = require("passport-jwt").ExtractJwt;
const argon = require("argon2");
const { pool } = require("./db");

// Local Strategy for email/password authentication
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const results = await pool.query(
          "SELECT * FROM users WHERE email = $1",
          [email]
        );
        const user = results.rows[0];
        
        if (!user) {
          return done(null, false, { message: "Incorrect credentials" });
        }
        
        const isMatched = await argon.verify(user.password_hash, password);
        if (!isMatched) {
          return done(null, false, { message: "Incorrect credentials" });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// JWT Strategy for token-based authentication
passport.use(
  new JWTStrategy(
    {
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || "jwt-secret-key",
    },
    async (jwtPayload, done) => {
      try {
        const results = await pool.query(
          "SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1",
          [jwtPayload.id]
        );
        const user = results.rows[0];
        
        if (!user) {
          return done(null, false);
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

module.exports = passport;
