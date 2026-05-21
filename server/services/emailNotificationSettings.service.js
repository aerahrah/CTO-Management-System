// services/emailNotificationSettings.service.js
const mongoose = require("mongoose");
const EmailNotificationSetting = require("../models/emailNotificationSettingsModel");
const EMAIL_KEYS = require("../utils/emailNotificationKeys");

// --- CONSTANTS & IMMUTABILITY ---

// Freeze allowed keys to prevent accidental mutation or prototype pollution
const ALL_KEYS = Object.freeze(Object.values(EMAIL_KEYS));
const VALID_KEYS = Object.freeze(new Set(ALL_KEYS));

// --- HELPER FUNCTIONS ---

/**
 * Standardizes service-level errors with HTTP status codes.
 */
function createServiceError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Safely parses various input types into a strict boolean.
 */
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
 * Generates the default flags object (all notifications enabled by default).
 */
function defaultFlags() {
  return Object.fromEntries(ALL_KEYS.map((k) => [k, true]));
}

/**
 * Normalizes Mongoose Maps/Objects into a standard, prototype-safe JS object.
 */
function flagsToObject(flags) {
  if (!flags) return {};
  if (flags instanceof Map) return Object.fromEntries(flags.entries());

  // Strict typeof check excluding arrays and nulls
  if (typeof flags === "object" && !Array.isArray(flags)) {
    return flags;
  }

  return {};
}

/**
 * Merges saved database flags with the default schema.
 * Strictly enforces that only known, valid keys are returned to the application.
 */
function normalize(doc) {
  const defaults = defaultFlags();
  const saved = flagsToObject(doc?.flags);

  // Use Object.create(null) to prevent prototype pollution
  const result = Object.create(null);

  for (const key of ALL_KEYS) {
    // If the key exists in DB, strictly parse it to boolean. Otherwise use default.
    if (saved[key] !== undefined) {
      result[key] = toBool(saved[key], defaults[key]);
    } else {
      result[key] = defaults[key];
    }
  }

  return result;
}

/**
 * Ensures a singleton settings document exists in the database.
 * Uses .lean() for faster execution and sort() for singleton consistency.
 */
async function getOrCreateEmailNotifDoc() {
  return EmailNotificationSetting.findOneAndUpdate(
    {},
    { $setOnInsert: { flags: defaultFlags() } },
    {
      new: true,
      upsert: true,
      lean: true,
      sort: { _id: 1 }, // Consistency lock: always target the oldest document if >1 exists
    },
  );
}

// --- SERVICE METHODS ---

async function getEmailNotificationSettings() {
  const doc = await getOrCreateEmailNotifDoc();
  return normalize(doc);
}

async function updateEmailNotificationSetting(
  key,
  payload = {},
  userId = null,
) {
  // 1. Strict Input Validation
  if (!key || typeof key !== "string" || !VALID_KEYS.has(key)) {
    throw createServiceError("Invalid email notification key.", 400);
  }

  if (payload.enabled === undefined) {
    throw createServiceError("The 'enabled' field is required.", 400);
  }

  const enabled = toBool(payload.enabled);
  if (enabled === undefined) {
    throw createServiceError(
      "The 'enabled' field must be a valid boolean.",
      400,
    );
  }

  // 2. Fetch 'before' state safely
  const currentDoc = await getOrCreateEmailNotifDoc();
  const before = normalize(currentDoc);

  // 3. Build Atomic Update Query
  const updatePayload = {
    $set: {
      [`flags.${key}`]: enabled,
    },
  };

  // 4. Safely validate and append userId if provided
  if (userId) {
    if (!mongoose.isValidObjectId(userId)) {
      throw createServiceError("Invalid User ID format.", 400);
    }
    updatePayload.$set.updatedBy = userId;
  }

  // 5. Execute Atomic Update
  const updatedDoc = await EmailNotificationSetting.findOneAndUpdate(
    {},
    updatePayload,
    {
      new: true,
      runValidators: true,
      lean: true,
      sort: { _id: 1 },
    },
  );

  const after = normalize(updatedDoc);

  return { before, after };
}

module.exports = {
  getEmailNotificationSettings,
  updateEmailNotificationSetting,
};
