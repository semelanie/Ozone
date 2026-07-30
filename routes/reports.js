const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { query } = require("../db/pool");
const { encrypt, decrypt } = require("../db/crypto");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
const submitLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

function generateReference() {
  return "OZU-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

router.post("/", submitLimiter, async (req, res, next) => {
  try {
    const { location, details, contact, isAnonymous } = req.body || {};
    if (!details || !details.trim()) return res.status(400).json({ error: "Please describe what you saw." });
    if (details.length > 5000) return res.status(400).json({ error: "Description is too long." });

    const reference = generateReference();
    const anon = isAnonymous !== false;

    await query(
      `INSERT INTO confidential_reports (reference, is_anonymous, location_enc, details_enc, contact_enc)
       VALUES ($1, $2, $3, $4, $5)`,
      [reference, anon, encrypt(location || ""), encrypt(details), anon ? null : encrypt(contact || "")]
    );

    res.status(201).json({ reference });
  } catch (e) { next(e); }
});

router.get("/", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM confidential_reports ORDER BY created_at DESC");
    const decrypted = rows.map(r => ({
      id: r.id,
      reference: r.reference,
      is_anonymous: !!r.is_anonymous,
      location: decrypt(r.location_enc),
      details: decrypt(r.details_enc),
      contact: decrypt(r.contact_enc),
      status: r.status,
      created_at: r.created_at,
    }));
    await query("INSERT INTO audit_log (user_id, action, target) VALUES ($1, 'view_reports', NULL)", [req.user.id]);
    res.json(decrypted);
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!["submitted", "under_review", "closed"].includes(status)) return res.status(400).json({ error: "Invalid status." });
    await query("UPDATE confidential_reports SET status = $1 WHERE id = $2", [status, req.params.id]);
    await query("INSERT INTO audit_log (user_id, action, target) VALUES ($1, 'update_report_status', $2)", [req.user.id, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
