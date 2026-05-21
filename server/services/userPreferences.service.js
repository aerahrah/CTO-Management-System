// services/userPreferences.service.js
const mongoose = require("mongoose");
const Employee = require("../models/employeeModel");

// Freeze constants to prevent accidental mutation or prototype pollution
const ALLOWED_THEMES = Object.freeze(["system", "light", "dark"]);
const ALLOWED_ACCENTS = Object.freeze([
  "blue",
  "pink",
  "green",
  "violet",
  "amber",
  "teal",
  "indigo",
  "rose",
  "cyan",
  "lime",
  "orange",
]);

const DEFAULT_PREFERENCES = Object.freeze({
  theme: "system",
  accent: "blue",
});

// --- HELPER FUNCTIONS ---

/**
 * Standardizes service-level errors.
 */
function createServiceError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Validates if the provided string is a valid MongoDB ObjectId.
 */
function validateEmployeeId(employeeId) {
  if (!mongoose.isValidObjectId(employeeId)) {
    throw createServiceError("Invalid Employee ID format.", 400);
  }
}

/**
 * Validates and sanitizes incoming preference payloads.
 */
function sanitizePreferences(payload = {}) {
  const out = {};

  if (payload.theme !== undefined) {
    if (!ALLOWED_THEMES.includes(payload.theme)) {
      throw createServiceError("Invalid theme value.", 400);
    }
    out.theme = payload.theme;
  }

  if (payload.accent !== undefined) {
    if (!ALLOWED_ACCENTS.includes(payload.accent)) {
      throw createServiceError("Invalid accent value.", 400);
    }
    out.accent = payload.accent;
  }

  return out;
}

/**
 * Standardizes the output object, applying fallbacks for missing or old data.
 */
function formatPreferences(preferences = {}) {
  return {
    theme: ALLOWED_THEMES.includes(preferences.theme)
      ? preferences.theme
      : DEFAULT_PREFERENCES.theme,
    accent: ALLOWED_ACCENTS.includes(preferences.accent)
      ? preferences.accent
      : DEFAULT_PREFERENCES.accent,
  };
}

// --- SERVICE METHODS ---

async function getMyPreferences(employeeId) {
  validateEmployeeId(employeeId);

  // Use .lean() for faster execution since we only read data, not modify the doc instance
  const employee = await Employee.findById(employeeId)
    .select("preferences")
    .lean();

  if (!employee) {
    throw createServiceError("Employee not found.", 404);
  }

  return formatPreferences(employee.preferences);
}

async function updateMyPreferences(employeeId, payload) {
  validateEmployeeId(employeeId);
  const updates = sanitizePreferences(payload);

  if (Object.keys(updates).length === 0) {
    throw createServiceError("No valid fields provided to update.", 400);
  }

  const $set = {};
  if (updates.theme !== undefined) $set["preferences.theme"] = updates.theme;
  if (updates.accent !== undefined) $set["preferences.accent"] = updates.accent;

  const employee = await Employee.findByIdAndUpdate(
    employeeId,
    { $set },
    { new: true, runValidators: true, lean: true },
  ).select("preferences");

  if (!employee) {
    throw createServiceError("Employee not found.", 404);
  }

  return formatPreferences(employee.preferences);
}

async function resetMyPreferences(employeeId) {
  validateEmployeeId(employeeId);

  const employee = await Employee.findByIdAndUpdate(
    employeeId,
    {
      $set: {
        "preferences.theme": DEFAULT_PREFERENCES.theme,
        "preferences.accent": DEFAULT_PREFERENCES.accent,
      },
    },
    { new: true, runValidators: true, lean: true },
  ).select("preferences");

  if (!employee) {
    throw createServiceError("Employee not found.", 404);
  }

  return formatPreferences(employee.preferences);
}

module.exports = {
  ALLOWED_THEMES,
  ALLOWED_ACCENTS,
  getMyPreferences,
  updateMyPreferences,
  resetMyPreferences,
};
