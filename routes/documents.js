const express = require("express");
const { query } = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { q, category } = req.query;
    let sql = "SELECT * FROM documents WHERE 1=1";
    const params = [];
    if (category && category !== "All") {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND name ILIKE $${params.length}`;
    }
    sql += " ORDER BY updated_at DESC";
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get("/recent", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM documents ORDER BY updated_at DESC LIMIT 3");
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/", requireAuth(["admin", "editor"]), async (req, res, next) => {
  try {
    const { name, category, file_type, file_url, is_new } = req.body || {};
    if (!name || !category || !file_type) return res.status(400).json({ error: "Name, category and file type are required." });
    const { rows } = await query(
      "INSERT INTO documents (name, category, file_type, file_url, is_new, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [name, category, file_type, file_url || "#", !!is_new, req.user.id]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) { next(e); }
});

router.put("/:id", requireAuth(["admin", "editor"]), async (req, res, next) => {
  try {
    const { name, category, file_type, file_url, is_new } = req.body || {};
    await query(
      `UPDATE documents SET name=$1, category=$2, file_type=$3, file_url=$4, is_new=$5, updated_at=now() WHERE id=$6`,
      [name, category, file_type, file_url || "#", !!is_new, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete("/:id", requireAuth(["admin"]), async (req, res, next) => {
  try {
    await query("DELETE FROM documents WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
