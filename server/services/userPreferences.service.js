// services/userPreferences.service.js
const Employee = require("../models/employeeModel");

const ALLOWED_THEMES = ["system", "light", "dark"];
const ALLOWED_ACCENTS = [
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
];

function sanitizePreferences(payload = {}) {
  const out = {};

  if (payload.theme !== undefined) {
    if (!ALLOWED_THEMES.includes(payload.theme)) {
      const err = new Error("Invalid theme value.");
      err.statusCode = 400;
      throw err;
    }
    out.theme = payload.theme;
  }

  if (payload.accent !== undefined) {
    if (!ALLOWED_ACCENTS.includes(payload.accent)) {
      const err = new Error("Invalid accent value.");
      err.statusCode = 400;
      throw err;
    }
    out.accent = payload.accent;
  }

  return out;
}

async function getMyPreferences(employeeId) {
  const employee = await Employee.findById(employeeId).select("preferences");
  if (!employee) {
    const err = new Error("Employee not found.");
    err.statusCode = 404;
    throw err;
  }

  // Fallbacks for older records (if preferences missing)
  const preferences = {
    theme: employee.preferences?.theme ?? "system",
    accent: employee.preferences?.accent ?? "blue",
  };

  return preferences;
}

async function updateMyPreferences(employeeId, payload) {
  const updates = sanitizePreferences(payload);

  if (Object.keys(updates).length === 0) {
    const err = new Error("No valid fields provided.");
    err.statusCode = 400;
    throw err;
  }

  const $set = {};
  if (updates.theme !== undefined) $set["preferences.theme"] = updates.theme;
  if (updates.accent !== undefined) $set["preferences.accent"] = updates.accent;

  const employee = await Employee.findByIdAndUpdate(
    employeeId,
    { $set },
    { new: true, runValidators: true },
  ).select("preferences");

  if (!employee) {
    const err = new Error("Employee not found.");
    err.statusCode = 404;
    throw err;
  }

  return {
    theme: employee.preferences?.theme ?? "system",
    accent: employee.preferences?.accent ?? "blue",
  };
}

async function resetMyPreferences(employeeId) {
  const employee = await Employee.findByIdAndUpdate(
    employeeId,
    {
      $set: {
        "preferences.theme": "system",
        "preferences.accent": "blue",
      },
    },
    { new: true, runValidators: true },
  ).select("preferences");

  if (!employee) {
    const err = new Error("Employee not found.");
    err.statusCode = 404;
    throw err;
  }

  return {
    theme: employee.preferences?.theme ?? "system",
    accent: employee.preferences?.accent ?? "blue",
  };
}

module.exports = {
  ALLOWED_THEMES,
  ALLOWED_ACCENTS,
  getMyPreferences,
  updateMyPreferences,
  resetMyPreferences,
};
