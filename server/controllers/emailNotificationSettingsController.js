// controllers/emailNotificationSettingsController.js
const {
  getEmailNotificationSettings,
  updateEmailNotificationSetting,
} = require("../services/emailNotificationSettings.service");

const getErrMsg = (err, fallback = "Something went wrong") =>
  err?.response?.data?.message || err?.message || fallback;

/* =========================
   EMAIL NOTIF CONTROLLERS
   ========================= */

async function getEmailNotificationSettingsController(req, res) {
  try {
    const data = await getEmailNotificationSettings();
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: getErrMsg(err, "Failed to load email notification settings"),
    });
  }
}

async function updateEmailNotificationSettingController(req, res) {
  try {
    const userId = req.user?.id || req.user?._id || null;
    const { key } = req.params;

    const { before, after } = await updateEmailNotificationSetting(
      key,
      req.body,
      userId,
    );

    // ✅ expose to audit middleware
    res.locals.auditBefore = before;
    res.locals.auditAfter = after;

    return res.json({ ok: true, data: after });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      message: getErrMsg(err, "Failed to update email notification setting"),
    });
  }
}

module.exports = {
  getEmailNotificationSettingsController,
  updateEmailNotificationSettingController,
};
