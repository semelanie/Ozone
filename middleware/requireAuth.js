const jwt = require("jsonwebtoken");

function requireAuth(roles = []) {
  return function (req, res, next) {
    const token = req.cookies?.token || (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated." });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: "Not authorized for this action." });
      }
      req.user = payload;
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }
  };
}

module.exports = requireAuth;
