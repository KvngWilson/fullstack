const express = require("express");
const { pool } = require("../config/db");
const argon = require("argon2");
const router = express.Router();
const passport = require("../config/passport");
const { generateToken } = require("../config/auth");

router.get("/login", (req, res) => {
  res.json({ message: "Please POST to /login with email and password" });
});

router.get("/register", (req, res) => {
  res.json({ message: "Please POST to /register with email and password" });
});

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required." });
    }

    const hashedPassword = await argon.hash(password);

    const newUser = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role",
      [email, hashedPassword]
    );
    
    const token = generateToken(newUser.rows[0]);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser.rows[0].id,
        email: newUser.rows[0].email,
        role: newUser.rows[0].role
      },
      token
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ message: info.message || "Authentication failed" });
    }

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      user: { 
        id: user.id, 
        email: user.email,
        role: user.role 
      },
      token
    });
  })(req, res, next);
});

router.get("/logout", (req, res) => {
  res.json({ message: "Logout successful" });
});

module.exports = router;