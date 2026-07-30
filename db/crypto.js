const crypto = require("crypto");

// In production this key must come from a secrets manager / env var and be
// rotated periodically. For local/dev use it's generated into .env by
// db/seed.js on first run if not already present.
const KEY_HEX = process.env.REPORTS_ENCRYPTION_KEY;
if (!KEY_HEX || KEY_HEX.length !== 64) {
  throw new Error(
    "REPORTS_ENCRYPTION_KEY missing or invalid (need a 64-char hex string / 32 bytes). " +
    "Run `npm run seed` first, or set it in your .env file."
  );
}
const KEY = Buffer.from(KEY_HEX, "hex");

function encrypt(plaintext) {
  if (plaintext === undefined || plaintext === null || plaintext === "") return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store iv + tag + ciphertext together, base64-encoded
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(payload) {
  if (!payload) return null;
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

module.exports = { encrypt, decrypt };
