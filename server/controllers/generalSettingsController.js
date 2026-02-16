const {
  getSessionSettings,
  updateSessionSettings,
  getWorkingDaysSettings,
  updateWorkingDaysSettings,
} = require("../services/generalSettings.service");

const getErrMsg = (err, fallback = "Something went wrong") =>
  err?.response?.data?.message || err?.message || fallback;

/* =========================
   SESSION CONTROLLERS
   ========================= */

async function getSessionSettingsController(req, res) {
  try {
    const data = await getSessionSettings();
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: getErrMsg(err, "Failed to load session settings"),
    });
  }
}

async function updateSessionSettingsController(req, res) {
  try {
    const userId = req.user?.id || req.user?._id || null;
    const data = await updateSessionSettings(req.body, userId);
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      message: getErrMsg(err, "Failed to update session settings"),
    });
  }
}

/* =========================
   WORKING DAYS CONTROLLERS
   ========================= */

async function getWorkingDaysSettingsController(req, res) {
  try {
    const data = await getWorkingDaysSettings();
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: getErrMsg(err, "Failed to load working days settings"),
    });
  }
}

async function updateWorkingDaysSettingsController(req, res) {
  try {
    const userId = req.user?.id || req.user?._id || null;
    const data = await updateWorkingDaysSettings(req.body, userId);
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      message: getErrMsg(err, "Failed to update working days settings"),
    });
  }
}

module.exports = {
  // session
  getSessionSettingsController,
  updateSessionSettingsController,

  // working days
  getWorkingDaysSettingsController,
  updateWorkingDaysSettingsController,
};
