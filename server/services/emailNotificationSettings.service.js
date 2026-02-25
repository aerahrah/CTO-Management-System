// services/emailNotificationSettings.service.js
const EmailNotificationSetting = require("../models/emailNotificationSettingsModel");
const EMAIL_KEYS = require("../utils/emailNotificationKeys");

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

const ALL_KEYS = Object.values(EMAIL_KEYS);
const VALID_KEYS = new Set(ALL_KEYS);

function defaultFlags() {
  return Object.fromEntries(ALL_KEYS.map((k) => [k, true]));
}

async function getOrCreateEmailNotifDoc() {
  return await EmailNotificationSetting.findOneAndUpdate(
    {},
    { $setOnInsert: { flags: defaultFlags() } },
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

function flagsToObject(flags) {
  if (!flags) return {};
  // Mongoose Map or JS Map
  if (flags instanceof Map) return Object.fromEntries(flags.entries());
  // plain object
  if (typeof flags === "object") return { ...flags };
  return {};
}

function normalize(doc) {
  const defaults = defaultFlags();
  const saved = flagsToObject(doc?.flags);
  return { ...defaults, ...saved };
}

/* =========================
   EMAIL NOTIF SETTINGS
   ========================= */

async function getEmailNotificationSettings() {
  const doc = await getOrCreateEmailNotifDoc();
  return normalize(doc);
}

// Update one key
// updateEmailNotificationSetting("cto_approval", { enabled: false }, userId)
async function updateEmailNotificationSetting(
  key,
  payload = {},
  userId = null,
) {
  if (!VALID_KEYS.has(key)) {
    throw new Error("Invalid email notification key");
  }

  const doc = await getOrCreateEmailNotifDoc();
  const before = normalize(doc);

  if (payload.enabled === undefined) {
    throw new Error("enabled is required");
  }

  const enabled = toBool(payload.enabled, undefined);
  if (enabled === undefined) {
    throw new Error("enabled must be a boolean");
  }

  // ensure flags exists
  if (!doc.flags) doc.flags = defaultFlags();

  // Mongoose Map
  if (doc.flags instanceof Map) {
    doc.flags.set(key, enabled);
  } else {
    doc.flags = { ...flagsToObject(doc.flags), [key]: enabled };
  }

  setUpdatedBy(doc, userId);
  await doc.save();

  const after = normalize(doc);
  return { before, after };
}

module.exports = {
  getEmailNotificationSettings,
  updateEmailNotificationSetting,
};
