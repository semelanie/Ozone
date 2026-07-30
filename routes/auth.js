const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { query } = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const { rows } = await query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid email or password." });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password." });

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    await query("INSERT INTO audit_log (user_id, action, target) VALUES ($1, 'login', $2)", [user.id, user.email]);

    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 8 * 60 * 60 * 1000,
      })
      .json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (e) { next(e); }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token").json({ ok: true });
});

router.get("/me", requireAuth(), (req, res) => {
  res.json(req.user);
});

router.post("/change-password", requireAuth(), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || newPassword.length < 10) {
      return res.status(400).json({ error: "New password must be at least 10 characters." });
    }
    const { rows } = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    const user = rows[0];
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }
    const hash = bcrypt.hashSync(newPassword, 12);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.user.id]);
    await query("INSERT INTO audit_log (user_id, action) VALUES ($1, 'password_change')", [req.user.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Admin-only: create additional editor/admin accounts
router.post("/users", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email and password are required." });
    if (password.length < 10) return res.status(400).json({ error: "Password must be at least 10 characters." });
    const hash = bcrypt.hashSync(password, 12);
    const finalRole = role === "admin" ? "admin" : "editor";
    try {
      const { rows } = await query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
        [name, email.toLowerCase().trim(), hash, finalRole]
      );
      res.status(201).json({ id: rows[0].id, name, email, role: finalRole });
    } catch (e) {
      if (e.code === "23505") return res.status(409).json({ error: "That email is already registered." });
      throw e;
    }
  } catch (e) { next(e); }
});

module.exports = router;
