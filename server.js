require("dotenv").config();
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const contactRoutes = require("./routes/contact");
const feedbackRoutes = require("./routes/feedback");
const reportRoutes = require("./routes/reports");
const documentRoutes = require("./routes/documents");
const newsRoutes = require("./routes/news");

if (!process.env.JWT_SECRET || !process.env.REPORTS_ENCRYPTION_KEY) {
  console.error(
    "\nMissing JWT_SECRET / REPORTS_ENCRYPTION_KEY.\n" +
    "Locally: run `npm run seed` first — it generates both into your .env file.\n" +
    "On Vercel: set both in Project Settings → Environment Variables (copy the\n" +
    "same values you used locally — see README.md).\n"
  );
  if (!process.env.VERCEL) process.exit(1);
}

const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // the front-end loads fonts/React from CDNs; tighten this for production
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Global rate limit as a baseline, on top of the per-route limits
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

app.use("/api/auth", authRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/news", newsRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve the front-end (public/index.html is the site, public/admin.html is the admin dashboard)
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => res.status(404).json({ error: "Not found." }));

// Basic error handler so uncaught issues don't leak stack traces
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

// Only bind a real port for local dev / IIS (iisnode) — on Vercel this file
// is required by api/index.js and the exported `app` is invoked per-request
// as a serverless function instead.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Ozone Unit website running at http://localhost:${PORT}`);
    console.log(`Admin dashboard at         http://localhost:${PORT}/admin.html`);
  });
}

module.exports = app;
