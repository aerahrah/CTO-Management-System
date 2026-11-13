// controllers/ctoDigestSchedule.controller.js
// Settings page endpoints for the end-of-day pending CTO approvals digest.
//
//   GET   → { ok, data: { time, includeWeekends, timezone, emailEnabled, nextRunAt, nextRunLabel, lastRun } }
//   PATCH ← { time?: "17:00", includeWeekends?: true }
//
// Mounted in routes/emailNotificationSettingsRoutes.js behind requirePerm("settings.email").

// The services are loaded on first use instead of at startup. If the app has a
// circular import (e.g. notificationService → app → routes → this controller),
// a top-level require could hand us a half-loaded module and leave these
// functions undefined. Loading them at request time avoids that completely.
function loadService(path, fnName) {
  const svc = require(path);
  if (typeof svc?.[fnName] !== "function") {
    const file = path.replace("../", "");
    throw new Error(
      `${fnName} is missing from ${file}.js. Replace that file with the latest version.`,
    );
  }
  return svc[fnName];
}

const getCtoDigestStatus = (...args) =>
  loadService(
    "../services/ctoPendingDigest.service",
    "getCtoDigestStatus",
  )(...args);

const updateCtoDigestSchedule = (...args) =>
  loadService(
    "../services/emailNotificationSettings.service",
    "updateCtoDigestSchedule",
  )(...args);

function sendError(res, err, fallbackMessage) {
  const status = err?.statusCode || err?.status || 500;
  if (status >= 500) console.error("[CTO DIGEST SETTINGS]", err);

  // Outside production, show the real cause on the settings page to make setup easier
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

async function getCtoDigestScheduleController(req, res) {
  try {
    const data = await getCtoDigestStatus();
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, "Failed to load the digest schedule.");
  }
}

async function updateCtoDigestScheduleController(req, res) {
  try {
    const userId = req.user?._id || req.user?.id || null;
    const { before, after } = await updateCtoDigestSchedule(
      req.body || {},
      userId,
    );
    const status = await getCtoDigestStatus();

    return res.status(200).json({
      ok: true,
      message: "Digest schedule updated.",
      data: { before, after, ...status },
    });
  } catch (err) {
    return sendError(res, err, "Failed to update the digest schedule.");
  }
}

module.exports = {
  getCtoDigestScheduleController,
  updateCtoDigestScheduleController,
};
