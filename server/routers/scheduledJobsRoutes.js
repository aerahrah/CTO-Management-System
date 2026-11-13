const express = require("express");
const {
  listScheduledJobsController,
  getScheduledJobController,
  updateScheduledJobController,
  runScheduledJobController,
} = require("../controllers/scheduledJobs.Controller");

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];

// Who can open the Scheduled Jobs page (see validPermissions in models/roleModel.js).
// The frontend uses the same value in Sidebar.jsx and App.jsx.
const PERM = "settings.scheduled_jobs";

// =============================
// SCHEDULED JOBS
// Mounted at /api/scheduled-jobs
// =============================

// List every scheduled job with its settings, next run and last run
router.get("/", ...requirePerm(PERM), listScheduledJobsController);

// One job
// GET /api/scheduled-jobs/cto_pending_digest
router.get("/:jobKey", ...requirePerm(PERM), getScheduledJobController);

// Change a job's settings
// PATCH /api/scheduled-jobs/cto_pending_digest
// body: { "enabled": true, "time": "17:00", "includeWeekends": false }  (any of them)
router.patch("/:jobKey", ...requirePerm(PERM), updateScheduledJobController);

// Run a job right now (does not use up today's scheduled run)
// POST /api/scheduled-jobs/cto_pending_digest/run
router.post("/:jobKey/run", ...requirePerm(PERM), runScheduledJobController);

module.exports = router;
