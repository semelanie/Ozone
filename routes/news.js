const express = require("express");
const { query } = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM news ORDER BY published_at DESC");
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/", requireAuth(["admin", "editor"]), async (req, res, next) => {
  try {
    const { title, tag, body } = req.body || {};
    if (!title) return res.status(400).json({ error: "Title is required." });
    const { rows } = await query(
      "INSERT INTO news (title, tag, body, created_by) VALUES ($1, $2, $3, $4) RETURNING id",
      [title, tag || "Ministry News", body || "", req.user.id]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) { next(e); }
});

router.put("/:id", requireAuth(["admin", "editor"]), async (req, res, next) => {
  try {
    const { title, tag, body } = req.body || {};
    await query("UPDATE news SET title=$1, tag=$2, body=$3 WHERE id=$4", [title, tag, body, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth(["admin"]), async (req, res, next) => {
  try {
    await query("DELETE FROM news WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
