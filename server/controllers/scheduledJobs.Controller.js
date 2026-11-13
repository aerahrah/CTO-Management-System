// controllers/scheduledJobs.controller.js
// Endpoints for the Scheduled Jobs settings page.
//
//   GET   /api/scheduled-jobs              → { ok, data: [status, ...] }
//   GET   /api/scheduled-jobs/:jobKey      → { ok, data: status }
//   PATCH /api/scheduled-jobs/:jobKey      ← { enabled?, time?: "17:00", includeWeekends? }
//   POST  /api/scheduled-jobs/:jobKey/run  → runs the job right now
//
// status = { jobKey, enabled, time, includeWeekends, timezone, nextRunAt, nextRunLabel, lastRun }

// ---- Job registry -------------------------------------------------------
// To add a job: add its defaults in services/scheduledJobSettings.service.js,
// then add an entry here with how to read its status and run it now.
// Services are required on first use (not at startup) so a circular import
// in the app can never leave them undefined.
const JOBS = {
  cto_pending_digest: {
    getStatus: () =>
      require("../services/ctoPendingDigest.service").getCtoDigestStatus(),
    runNow: async () => {
      const stats =
        await require("../services/ctoPendingDigest.service").runCtoPendingDigest(
          {
            force: true, // a manual run never uses up today's scheduled run
          },
        );

      if (stats.skipped === "FRONTEND_URL_MISSING") {
        const err = new Error(
          "FRONTEND_URL is not set on the server, so the emails would have no working links.",
        );
        err.statusCode = 400;
        throw err;
      }

      const sent = stats.emailsSent || 0;
      const failed = stats.emailsFailed || 0;
      const message = !stats.approvers
        ? "No approvers have pending CTO applications right now. Nothing was sent."
        : `Sent ${sent} email${sent === 1 ? "" : "s"} to approvers` +
          (failed ? `, ${failed} failed` : "") +
          (stats.skippedNoEmail
            ? `, ${stats.skippedNoEmail} without an email address`
            : "") +
          ".";

      return { message, stats };
    },
  },
};

const running = new Set(); // prevents a double-click from running a job twice

function getJob(jobKey) {
  const job = Object.prototype.hasOwnProperty.call(JOBS, jobKey)
    ? JOBS[jobKey]
    : null;
  if (!job) {
    const err = new Error("Unknown scheduled job.");
    err.statusCode = 404;
    throw err;
  }
  return job;
}

function settingsService() {
  return require("../services/scheduledJobSettings.service");
}

function sendError(res, err, fallbackMessage) {
  const status = err?.statusCode || err?.status || 500;
  if (status >= 500) console.error("[SCHEDULED JOBS]", err);

  // Outside production, show the real cause to make setup easier
  const showDetail = status >= 500 && process.env.NODE_ENV !== "production";

  return res.status(status).json({
    ok: false,
    message:
      status < 500
        ? err.message
        : showDetail
          ? fallbackMessage + " " + (err?.message || "")
          : fallbackMessage,
  });
}

/* =========================
   Handlers
========================= */

async function listScheduledJobsController(req, res) {
  try {
    const data = await Promise.all(
      Object.values(JOBS).map((job) => job.getStatus()),
    );
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, "Failed to load scheduled jobs.");
  }
}

async function getScheduledJobController(req, res) {
  try {
    const data = await getJob(req.params.jobKey).getStatus();
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, "Failed to load the scheduled job.");
  }
}

async function updateScheduledJobController(req, res) {
  try {
    const { jobKey } = req.params;
    const job = getJob(jobKey);
    const userId = req.user?._id || req.user?.id || null;

    const { before, after } = await settingsService().updateJobSettings(
      jobKey,
      req.body || {},
      userId,
    );
    const status = await job.getStatus();

    return res.status(200).json({
      ok: true,
      message: "Scheduled job updated.",
      data: { before, after, ...status },
    });
  } catch (err) {
    return sendError(res, err, "Failed to update the scheduled job.");
  }
}

async function runScheduledJobController(req, res) {
  const { jobKey } = req.params;
  try {
    const job = getJob(jobKey);

    if (running.has(jobKey)) {
      return res.status(409).json({
        ok: false,
        message: "This job is already running. Please wait for it to finish.",
      });
    }

    running.add(jobKey);
    try {
      const { message, stats } = await job.runNow();
      const status = await job.getStatus();
      return res
        .status(200)
        .json({ ok: true, message, data: { ...status, result: stats } });
    } finally {
      running.delete(jobKey);
    }
  } catch (err) {
    return sendError(res, err, "Failed to run the scheduled job.");
  }
}

module.exports = {
  listScheduledJobsController,
  getScheduledJobController,
  updateScheduledJobController,
  runScheduledJobController,
};
