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

    // Support legacy string roles temporarily if they exist in the token
    const userRole =
      typeof req.user.role === "string" ? req.user.role : req.user.role.name;

    if (!allowedRoles.includes(userRole)) {
      return res
        .status(403)
        .json({ message: "Access denied: insufficient role" });
    }

    return next();
  };
};

const authorize = (requiredPermission) => {
  return (req, res, next) => {
    if (req.method === "OPTIONS") return next();

    if (!req.user || !req.user.role || !req.user.role.permissions) {
      // Legacy token fallback - if token has old string role, we can't check permissions.
      // They need to log in again.

      return res.status(403).json({
        message:
          "Access denied. Role permissions missing. Please log in again.",
      });
    }

    const permissions = req.user.role.permissions;
    console.log(permissions);
    if (permissions.includes("*")) {
      return next();
    }

    if (!permissions.includes(requiredPermission)) {
      return res.status(403).json({
        message: `Forbidden. Requires permission: ${requiredPermission}`,
      });
    }

    next();
  };
};

module.exports = { authenticateToken, authorizeRoles, authorize };
