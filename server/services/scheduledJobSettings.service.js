// services/scheduledJobSettings.service.js
// Settings for scheduled (cron) jobs: on/off, time of day, weekends.
// Each job has a key and its defaults below. To add a job later, add an entry
// to JOB_DEFAULTS and register it in controllers/scheduledJobs.controller.js.
const mongoose = require("mongoose");
const ScheduledJobSetting = require("../models/scheduledJobSettingModel");

const JOB_KEYS = Object.freeze({
  CTO_PENDING_DIGEST: "cto_pending_digest",
});

const JOB_DEFAULTS = Object.freeze({
  [JOB_KEYS.CTO_PENDING_DIGEST]: Object.freeze({
    enabled: true,
    time: "17:00",
    includeWeekends: false,
  }),
});

const VALID_JOB_KEYS = Object.freeze(new Set(Object.keys(JOB_DEFAULTS)));

/* =========================
   Helpers
========================= */

function createServiceError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function toBool(v, fallback = undefined) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return fallback;
}

/**
 * Accepts "17:00", "5:30" or "17:00:00" (what <input type="time"> may send)
 * and returns "HH:MM". Returns null when invalid.
 */
function parseTime24(value) {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;

  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;

  return String(hour).padStart(2, "0") + ":" + m[2];
}

function assertJobKey(jobKey) {
  if (typeof jobKey !== "string" || !VALID_JOB_KEYS.has(jobKey)) {
    throw createServiceError("Unknown scheduled job.", 404);
  }
}

function normalize(jobKey, doc) {
  const defaults = JOB_DEFAULTS[jobKey];
  const saved = doc && typeof doc === "object" ? doc : {};

  return {
    jobKey,
    enabled: toBool(saved.enabled, defaults.enabled),
    time: parseTime24(saved.time) || defaults.time,
    includeWeekends: toBool(saved.includeWeekends, defaults.includeWeekends),
    options:
      saved.options && typeof saved.options === "object" ? saved.options : {},
    updatedAt: saved.updatedAt || null,
  };
}

/* =========================
   Service methods
========================= */

/**
 * Read-only on purpose: jobs poll this every minute, so it never writes.
 * Returns the defaults when nothing has been saved yet.
 */
async function getJobSettings(jobKey) {
  assertJobKey(jobKey);
  const doc = await ScheduledJobSetting.findOne({ jobKey }).lean();
  return normalize(jobKey, doc);
}

async function listJobSettings() {
  const docs = await ScheduledJobSetting.find({
    jobKey: { $in: [...VALID_JOB_KEYS] },
  }).lean();
  const byKey = new Map(docs.map((d) => [d.jobKey, d]));
  return [...VALID_JOB_KEYS].map((key) => normalize(key, byKey.get(key)));
}

/**
 * payload: { enabled?, time?: "17:00", includeWeekends? }. Any field may be sent alone.
 * Returns { before, after }.
 */
async function updateJobSettings(jobKey, payload = {}, userId = null) {
  assertJobKey(jobKey);

  const $set = {};

  if (payload.enabled !== undefined) {
    const enabled = toBool(payload.enabled);
    if (enabled === undefined) {
      throw createServiceError(
        "The 'enabled' field must be a valid boolean.",
        400,
      );
    }
    $set.enabled = enabled;
  }

  if (payload.time !== undefined) {
    const time = parseTime24(payload.time);
    if (!time) {
      throw createServiceError(
        "The 'time' field must be in 24-hour HH:MM format, e.g. 17:00.",
        400,
      );
    }
    $set.time = time;
  }

  if (payload.includeWeekends !== undefined) {
    const includeWeekends = toBool(payload.includeWeekends);
    if (includeWeekends === undefined) {
      throw createServiceError(
        "The 'includeWeekends' field must be a valid boolean.",
        400,
      );
    }
    $set.includeWeekends = includeWeekends;
  }

  if (Object.keys($set).length === 0) {
    throw createServiceError(
      "Provide at least one of 'enabled', 'time' or 'includeWeekends'.",
      400,
    );
  }

  if (userId) {
    if (!mongoose.isValidObjectId(userId)) {
      throw createServiceError("Invalid User ID format.", 400);
    }
    $set.updatedBy = userId;
  }

  const before = await getJobSettings(jobKey);

  const updatedDoc = await ScheduledJobSetting.findOneAndUpdate(
    { jobKey },
    { $set }, // upsert copies jobKey from the filter on first save
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      lean: true,
    },
  );

  return { before, after: normalize(jobKey, updatedDoc) };
}

module.exports = {
  JOB_KEYS,
  JOB_DEFAULTS,
  getJobSettings,
  listJobSettings,
  updateJobSettings,
  parseTime24,
};
