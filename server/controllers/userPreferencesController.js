// controllers/userPreferences.controller.js
const prefsService = require("../services/userPreferences.service");

function getUserId(req) {
  // Adjust depending on your auth middleware
  // Common: req.user = { id, role, ... }
  return req.user?.id || req.user?._id || req.admin?.id || req.admin?._id;
}

exports.getMyPreferences = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const preferences = await prefsService.getMyPreferences(userId);
    return res.json({ preferences });
  } catch (err) {
    next(err);
  }
};

exports.updateMyPreferences = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const preferences = await prefsService.updateMyPreferences(
      userId,
      req.body,
    );
    return res.json({ message: "Preferences updated.", preferences });
  } catch (err) {
    next(err);
  }
};

exports.resetMyPreferences = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const preferences = await prefsService.resetMyPreferences(userId);
    return res.json({ message: "Preferences reset to defaults.", preferences });
  } catch (err) {
    next(err);
  }
};

// Optional: expose enums to frontend
exports.getPreferenceOptions = async (req, res, next) => {
  try {
    return res.json({
      themes: prefsService.ALLOWED_THEMES,
      accents: prefsService.ALLOWED_ACCENTS,
      defaults: { theme: "system", accent: "blue" },
    });
  } catch (err) {
    next(err);
  }
};
