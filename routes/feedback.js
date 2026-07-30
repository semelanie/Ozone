const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
const submitLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 15 });

router.post("/", submitLimiter, async (req, res, next) => {
  try {
    const { message, pageUrl } = req.body || {};
    if (!message || !message.trim()) return res.status(400).json({ error: "Feedback message is required." });
    if (message.length > 2000) return res.status(400).json({ error: "Feedback is too long." });
    await query("INSERT INTO feedback (message, page_url) VALUES ($1, $2)", [message.trim(), pageUrl || null]);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.get("/", requireAuth(["admin", "editor"]), async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM feedback ORDER BY created_at DESC");
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
