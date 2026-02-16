// services/generalSettings.service.js
const GeneralSetting = require("../models/generalSettingsModel");

function toInt(v, fallback = NaN) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toBool(v, fallback = undefined) {
  if (typeof v === "boolean") return v;

  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }

  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }

  return fallback;
}

async function getOrCreateSettingsDoc() {
  // ✅ singleton doc (creates one if none exists)
  return await GeneralSetting.findOneAndUpdate(
    {},
    { $setOnInsert: {} },
    { new: true, upsert: true },
  );
}

function setUpdatedBy(doc, userId) {
  // Safe set (in case schema doesn't have updatedBy)
  try {
    if (doc?.schema?.path?.("updatedBy")) {
      doc.updatedBy = userId || null;
    } else if (userId != null) {
      doc.updatedBy = userId; // works if strict: false or schema has it
    }
  } catch (_) {
    // ignore
  }
}

/* =========================
   SESSION TIMEOUT SETTINGS
   ========================= */

async function getSessionSettings() {
  const doc = await getOrCreateSettingsDoc();
  return {
    sessionTimeoutEnabled: doc.sessionTimeoutEnabled,
    sessionTimeoutMinutes: doc.sessionTimeoutMinutes,
  };
}

async function updateSessionSettings(payload = {}, userId = null) {
  const doc = await getOrCreateSettingsDoc();

  if (payload.sessionTimeoutEnabled !== undefined) {
    const enabled = toBool(payload.sessionTimeoutEnabled, undefined);
    if (enabled === undefined) {
      throw new Error("sessionTimeoutEnabled must be a boolean");
    }
    doc.sessionTimeoutEnabled = enabled;
  }

  if (payload.sessionTimeoutMinutes !== undefined) {
    const minutes = toInt(payload.sessionTimeoutMinutes, NaN);

    if (!Number.isFinite(minutes)) {
      throw new Error("sessionTimeoutMinutes must be a number");
    }
    if (minutes < 1) {
      throw new Error("sessionTimeoutMinutes must be >= 1");
    }
    if (minutes > 60 * 24 * 30) {
      throw new Error("sessionTimeoutMinutes is too large (max 30 days)");
    }

    doc.sessionTimeoutMinutes = minutes;
  }

  // ✅ consistency check
  if (doc.sessionTimeoutEnabled && !doc.sessionTimeoutMinutes) {
    throw new Error(
      "sessionTimeoutMinutes is required when sessionTimeoutEnabled is true",
    );
  }

  setUpdatedBy(doc, userId);
  await doc.save();

  return {
    sessionTimeoutEnabled: doc.sessionTimeoutEnabled,
    sessionTimeoutMinutes: doc.sessionTimeoutMinutes,
  };
}

/* =========================
   WORKING DAYS SETTINGS
   ========================= */

async function getWorkingDaysSettings() {
  const doc = await getOrCreateSettingsDoc();
  return {
    workingDaysEnable: doc.workingDaysEnable,
    workingDaysValue: doc.workingDaysValue,
  };
}

async function updateWorkingDaysSettings(payload = {}, userId = null) {
  const doc = await getOrCreateSettingsDoc();

  if (payload.workingDaysEnable !== undefined) {
    const enabled = toBool(payload.workingDaysEnable, undefined);
    if (enabled === undefined) {
      throw new Error("workingDaysEnable must be a boolean");
    }
    doc.workingDaysEnable = enabled;
  }

  if (payload.workingDaysValue !== undefined) {
    const days = toInt(payload.workingDaysValue, NaN);

    if (!Number.isFinite(days)) {
      throw new Error("workingDaysValue must be a number");
    }
    if (days < 1 || days > 7) {
      throw new Error("workingDaysValue must be between 1 and 7");
    }

    doc.workingDaysValue = days;
  }

  // ✅ consistency check
  if (doc.workingDaysEnable && !doc.workingDaysValue) {
    throw new Error(
      "workingDaysValue is required when workingDaysEnable is true",
    );
  }

  setUpdatedBy(doc, userId);
  await doc.save();

  return {
    workingDaysEnable: doc.workingDaysEnable,
    workingDaysValue: doc.workingDaysValue,
  };
}

module.exports = {
  // session
  getSessionSettings,
  updateSessionSettings,

  // working days
  getWorkingDaysSettings,
  updateWorkingDaysSettings,
};
