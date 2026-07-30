const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Locally: add it to .env. On Vercel: set it in " +
    "Project Settings → Environment Variables. Use your Supabase connection-pooling " +
    "URL (port 6543, ?pgbouncer=true) — see README.md."
  );
}

// Supabase requires SSL. In serverless environments each function instance
// should keep at most a small number of connections — Supabase's pooler
// (pgbouncer, transaction mode) is designed for exactly this, so `max` here
// can stay low even under concurrent invocations.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL; a local Postgres (e.g. for testing) usually doesn't
  // support it at all, so allow opting out with PGSSL_DISABLE=true.
  ssl: process.env.PGSSL_DISABLE === "true" ? false : { rejectUnauthorized: false },
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: 10_000,
});

let schemaReady;
function ensureSchema() {
  if (!schemaReady) {
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    schemaReady = pool.query(schema);
  }
  return schemaReady;
}

// Thin query helper — every route awaits this instead of touching `pool` directly,
// and it guarantees the schema exists first (cheap no-op after the first call
// per warm serverless instance).
async function query(text, params) {
  await ensureSchema();
  return pool.query(text, params);
}

module.exports = { query, pool, ensureSchema };
