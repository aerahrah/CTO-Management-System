const {
  getGeneralSettings,
  updateGeneralSettings,
} = require("../services/generalSettings.service");

const getErrMsg = (err, fallback = "Something went wrong") =>
  err?.response?.data?.message || err?.message || fallback;

async function getGeneralSettingsController(req, res) {
  try {
    const data = await getGeneralSettings();
    return res.json({ ok: true, data });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: getErrMsg(err, "Failed to load settings") });
  }
}

async function updateGeneralSettingsController(req, res) {
  try {
    const userId = req.user?.id || req.user?._id || null;
    const data = await updateGeneralSettings(req.body, userId);
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      message: getErrMsg(err, "Failed to update settings"),
    });
  }
}

module.exports = {
  getGeneralSettingsController,
  updateGeneralSettingsController,
};
