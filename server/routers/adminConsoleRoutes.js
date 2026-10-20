// routers/adminConsoleRoutes.js
//
// Mounted in the server file:
//   app.use("/api/admin/console", adminConsoleRoutes);
//
// The admin console page asks this first. Only accounts listed in
// CTO_SYNC_REFS (.env) get a 200; everyone else gets the normal 404,
// so the console shows your "page not found" screen to them.

const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middlewares/authMiddleware.js");
const ownerOnly = require("../middlewares/ownerOnly.js");

// GET /api/admin/console/access
router.get("/access", authenticateToken, ownerOnly, (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({ ok: true });
});

module.exports = router;
