// services/generalSettings.service.js
const GeneralSetting = require("../models/generalSettingsModel");

const MAX_BACKDATE_DAYS = 30; // keep in sync with the model's `max`

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
  return await GeneralSetting.findOneAndUpdate(
    {},
    { $setOnInsert: {} },
    { new: true, upsert: true },
  );
}

function setUpdatedBy(doc, userId) {
  try {
    if (doc?.schema?.path?.("updatedBy")) {
      doc.updatedBy = userId || null;
    } else if (userId != null) {
      doc.updatedBy = userId;
    }
  } catch (_) {
    // ignore
  }
}

function pickWorkingDaysSettings(settings) {
  return {
    workingDaysEnable: settings.workingDaysEnable,
    workingDaysValue: settings.workingDaysValue,
    hoursPerDay: settings.hoursPerDay,
    activeWorkingDays: settings.activeWorkingDays,
    lateFilingAttachmentRequired: settings.lateFilingAttachmentRequired,
    lateFilingBackdateEnabled: settings.lateFilingBackdateEnabled,
    lateFilingBackdateDays: settings.lateFilingBackdateDays,
    computationMode: settings.computationMode,
  };
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

  const before = {
    sessionTimeoutEnabled: doc.sessionTimeoutEnabled,
    sessionTimeoutMinutes: doc.sessionTimeoutMinutes,
  };

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

  // consistency check
  if (doc.sessionTimeoutEnabled && !doc.sessionTimeoutMinutes) {
    throw new Error(
      "sessionTimeoutMinutes is required when sessionTimeoutEnabled is true",
    );
  }

  setUpdatedBy(doc, userId);
  await doc.save();

  const after = {
    sessionTimeoutEnabled: doc.sessionTimeoutEnabled,
    sessionTimeoutMinutes: doc.sessionTimeoutMinutes,
  };

  return { before, after };
}

/* =========================
   WORKING DAYS & LATE FILING SETTINGS
   ========================= */

async function getWorkingDaysSettings() {
  let settings = await GeneralSetting.findOne();
  if (!settings) {
    settings = await GeneralSetting.create({});
  }
  return pickWorkingDaysSettings(settings);
}

async function updateWorkingDaysSettings(payload = {}, userId = null) {
  let settings = await GeneralSetting.findOne();
  if (!settings) {
    settings = new GeneralSetting();
  }

  const before = pickWorkingDaysSettings(settings);

  // Update fields if they exist in the payload
  if (typeof payload.workingDaysEnable === "boolean") {
    settings.workingDaysEnable = payload.workingDaysEnable;
  }
  if (payload.workingDaysValue !== undefined) {
    settings.workingDaysValue = payload.workingDaysValue;
  }
  if (payload.hoursPerDay !== undefined) {
    settings.hoursPerDay = payload.hoursPerDay;
  }
  if (payload.activeWorkingDays !== undefined) {
    settings.activeWorkingDays = payload.activeWorkingDays;
  }

  // LATE FILING ATTACHMENT
  if (payload.lateFilingAttachmentRequired !== undefined) {
    const isRequired = toBool(payload.lateFilingAttachmentRequired);
    if (isRequired !== undefined) {
      settings.lateFilingAttachmentRequired = isRequired;
    }
  }

  // LATE FILING BACKDATE (on/off)
  if (payload.lateFilingBackdateEnabled !== undefined) {
    const enabled = toBool(payload.lateFilingBackdateEnabled);
    if (enabled === undefined) {
      throw new Error("lateFilingBackdateEnabled must be a boolean");
    }
    settings.lateFilingBackdateEnabled = enabled;
  }

  // LATE FILING BACKDATE (how many days back)
  if (payload.lateFilingBackdateDays !== undefined) {
    const days = toInt(payload.lateFilingBackdateDays, NaN);
    if (!Number.isFinite(days)) {
      throw new Error("lateFilingBackdateDays must be a number");
    }
    if (days < 0 || days > MAX_BACKDATE_DAYS) {
      throw new Error(
        "lateFilingBackdateDays must be between 0 and " + MAX_BACKDATE_DAYS,
      );
    }
    settings.lateFilingBackdateDays = days;
  }

  // COMPUTATION MODE
  if (payload.computationMode !== undefined) {
    if (!["Working Days", "Calendar Days"].includes(payload.computationMode)) {
      throw new Error(
        "computationMode must be 'Working Days' or 'Calendar Days'",
      );
    }
    settings.computationMode = payload.computationMode;
  }

  setUpdatedBy(settings, userId);
  await settings.save();

  const after = pickWorkingDaysSettings(settings);

  return { before, after };
}

module.exports = {
  getSessionSettings,
  updateSessionSettings,
  getWorkingDaysSettings,
  updateWorkingDaysSettings,
};
