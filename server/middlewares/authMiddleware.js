// middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");

/**
 * IMPORTANT:
 * - Do NOT call dotenv.config() here if server.js already does it.
 * - Allow OPTIONS preflight to pass.
 * - Read secrets AFTER env is loaded (server.js loads dotenv).
 */

const authenticateToken = (req, res, next) => {
  // ✅ Allow CORS preflight requests through
  if (req.method === "OPTIONS") return next();

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Better fail fast if misconfigured
    return res
      .status(500)
      .json({ message: "Server misconfigured: JWT_SECRET missing." });
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: process.env.JWT_ISSUER || undefined,
      audience: process.env.JWT_AUDIENCE || undefined,
    });

    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // ✅ Allow preflight
    if (req.method === "OPTIONS") return next();

    if (!req.user?.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied: insufficient role" });
    }

    return next();
  };
};

module.exports = { authenticateToken, authorizeRoles };
