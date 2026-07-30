const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const submitLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10 });

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/", submitLimiter, async (req, res, next) => {
  try {
    const { name, email, message, honeypot } = req.body || {};
    if (honeypot) return res.status(400).json({ error: "Submission rejected." });
    if (!name || !email || !message) return res.status(400).json({ error: "Name, email and message are all required." });
    if (!isValidEmail(email)) return res.status(400).json({ error: "Please enter a valid email address." });
    if (message.length > 5000) return res.status(400).json({ error: "Message is too long." });

    await query("INSERT INTO contact_submissions (name, email, message) VALUES ($1, $2, $3)", [
      name.trim().slice(0, 200),
      email.trim().slice(0, 200),
      message.trim(),
    ]);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.get("/", requireAuth(["admin", "editor"]), async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM contact_submissions ORDER BY created_at DESC");
    res.json(rows);
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth(["admin", "editor"]), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!["new", "read", "archived"].includes(status)) return res.status(400).json({ error: "Invalid status." });
    await query("UPDATE contact_submissions SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
