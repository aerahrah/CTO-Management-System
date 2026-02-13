const GeneralSetting = require("../models/generalSettingsModel");

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

async function getGeneralSettings() {
  const doc = await GeneralSetting.findOneAndUpdate(
    {},
    { $setOnInsert: {} },
    { new: true, upsert: true },
  );

  return doc;
}
async function updateGeneralSettings(payload = {}, userId = null) {
  const doc = await getGeneralSettings();

  if (payload.sessionTimeoutEnabled !== undefined) {
    doc.sessionTimeoutEnabled = Boolean(payload.sessionTimeoutEnabled);
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

  // optional: if enabled but minutes missing/invalid
  if (doc.sessionTimeoutEnabled && !doc.sessionTimeoutMinutes) {
    throw new Error(
      "sessionTimeoutMinutes is required when sessionTimeoutEnabled is true",
    );
  }

  doc.updatedBy = userId || null;
  await doc.save();
  return doc;
}

module.exports = {
  getGeneralSettings,
  updateGeneralSettings,
};
