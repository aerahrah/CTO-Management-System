// middlewares/ownerOnly.js
//
// Lets a request through only when the logged-in account's ID is listed in
// CTO_SYNC_REFS (.env, comma-separated employee IDs). Everyone else gets the
// same 404 { message: "Not found" } as an unknown URL.
// If CTO_SYNC_REFS is empty or missing, nobody gets through.

// Read on every request, so it works no matter when dotenv is loaded.
const allowedIds = () =>
  new Set(
    String(process.env.CTO_SYNC_REFS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

module.exports = function ownerOnly(req, res, next) {
  const userId = String(req.user?.id || req.user?._id || "");
  if (!userId || !allowedIds().has(userId)) {
    return res.status(404).json({ message: "Not found" });
  }
  return next();
};
