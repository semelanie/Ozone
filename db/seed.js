// Run once, locally, pointed at your Supabase database:
//   npm run seed
//
// - Ensures REPORTS_ENCRYPTION_KEY / JWT_SECRET exist in your local .env
//   (generates them on first run if missing)
// - IMPORTANT: copy those same two values into Vercel's Environment
//   Variables afterwards — the deployed app and this seed script must use
//   the SAME keys, since they both read/write the same Supabase database.
// - Creates a default admin account (prints the generated password ONCE)
// - Seeds sample documents and news so the site isn't empty on first run

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const ENV_PATH = path.join(__dirname, "..", ".env");

function ensureLocalSecret(varName) {
  let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const re = new RegExp(`^${varName}=.+$`, "m");
  if (re.test(envContent)) return;
  const value = crypto.randomBytes(32).toString("hex");
  envContent += (envContent.endsWith("\n") || envContent === "" ? "" : "\n") + `${varName}=${value}\n`;
  fs.writeFileSync(ENV_PATH, envContent);
  console.log(`✓ Generated ${varName} and wrote it to .env`);
}

if (!fs.existsSync(ENV_PATH)) {
  console.error(
    "\nNo .env file found. Create one first with at least:\n" +
    "  DATABASE_URL=<your Supabase connection-pooling URL>\n" +
    "See README.md for where to find this in your Supabase dashboard.\n"
  );
  process.exit(1);
}

ensureLocalSecret("REPORTS_ENCRYPTION_KEY");
ensureLocalSecret("JWT_SECRET");

require("dotenv").config({ path: ENV_PATH });

if (!process.env.DATABASE_URL) {
  console.error("\nDATABASE_URL is missing from .env — add your Supabase connection string and re-run.\n");
  process.exit(1);
}

const { query, ensureSchema, pool } = require("./pool");
const { encrypt } = require("./crypto");

async function seedAdmin() {
  const existing = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (existing.rows.length) {
    console.log("✓ An admin account already exists — skipping admin creation.");
    return;
  }
  const email = process.env.SEED_ADMIN_EMAIL || "admin@databytes.sc";
  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const hash = bcrypt.hashSync(tempPassword, 12);
  await query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')",
    ["Site Administrator", email, hash]
  );

  console.log("\n==================================================================");
  console.log(" ADMIN ACCOUNT CREATED — copy this password now, it will not be shown again:");
  console.log(` Email:    ${email}`);
  console.log(` Password: ${tempPassword}`);
  console.log(" You will be required to change it on first login.");
  console.log("==================================================================\n");
}

async function seedDocuments() {
  const { rows } = await query("SELECT COUNT(*)::int AS c FROM documents");
  if (rows[0].c > 0) return;
  const docs = [
    ["Environment Protection Act", "Legislation", "PDF", false],
    ["Ozone-Depleting Substances Regulations", "Legislation", "PDF", false],
    ["HFC Import Quota Guidance 2026", "Guidance", "PDF", true],
    ["RAC Technician Certification Handbook", "Guidance", "PDF", false],
    ["Annual Ozone Compliance Report 2025", "Reports", "PDF", false],
    ["Import Permit Application Form", "Forms", "DOCX", false],
  ];
  for (const d of docs) {
    await query(
      "INSERT INTO documents (name, category, file_type, is_new, file_url) VALUES ($1, $2, $3, $4, '#')",
      d
    );
  }
  console.log(`✓ Seeded ${docs.length} sample documents.`);
}

async function seedNews() {
  const { rows } = await query("SELECT COUNT(*)::int AS c FROM news");
  if (rows[0].c > 0) return;
  const items = [
    ["Celebrating Seychelles' Mangroves: Nature's Coastal Guardians", "Environment", "Full story to be added by the content editor."],
    ["Golden Jubilee, Greener Future: June Highlights from MECENR", "Ministry News", "Full story to be added by the content editor."],
    ["Seychelles Showcases Ocean Conservation Leadership at Our Ocean Conference", "International", "Full story to be added by the content editor."],
  ];
  for (const n of items) {
    await query("INSERT INTO news (title, tag, body) VALUES ($1, $2, $3)", n);
  }
  console.log(`✓ Seeded ${items.length} sample news items.`);
}

async function seedSampleReport() {
  const { rows } = await query("SELECT COUNT(*)::int AS c FROM confidential_reports");
  if (rows[0].c > 0) return;
  await query(
    `INSERT INTO confidential_reports (reference, is_anonymous, location_enc, details_enc, contact_enc)
     VALUES ($1, true, $2, $3, NULL)`,
    [
      "OZU-DEMO1",
      encrypt("Providence Industrial Estate (sample record)"),
      encrypt("This is a sample confidential report so you can see how the admin dashboard displays encrypted submissions. Delete it once the site is live."),
    ]
  );
  console.log("✓ Seeded 1 sample confidential report (encrypted at rest).");
}

async function main() {
  await ensureSchema();
  await seedAdmin();
  await seedDocuments();
  await seedNews();
  await seedSampleReport();
  console.log("Seeding complete.");
  await pool.end();
}

main().catch(e => {
  console.error("Seeding failed:", e);
  process.exit(1);
});
