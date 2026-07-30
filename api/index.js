// Vercel serverless entry point. Vercel's Node runtime accepts a plain
// (req, res) handler — an Express app instance already has that shape,
// so re-exporting it here is all that's needed.
module.exports = require("../server");
