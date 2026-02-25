// src/api/emailNotificationSettings.js
import API from "./api";

/* =========================
   EMAIL NOTIFICATION SETTINGS
   ========================= */

// GET /api/email-notification-settings
// Admin/HR only
// Returns: { ok: true, data: { cto_approval: true, ... } }
export const fetchEmailNotificationSettings = async () => {
  const { data } = await API.get("/email-notification-settings");
  return data;
};

// PUT /api/email-notification-settings/:key
// Admin/HR only
// Body: { enabled: true/false }
// Returns: { ok: true, data: { ...updatedFlags } }
export const updateEmailNotificationSetting = async (key, enabled) => {
  if (!key) throw new Error("Email notification key is required");

  const { data } = await API.put(`/email-notification-settings/${key}`, {
    enabled,
  });

  return data;
};

// Optional helper: toggle by current value
export const toggleEmailNotificationSetting = async (key, currentValue) => {
  const next = !Boolean(currentValue);
  return updateEmailNotificationSetting(key, next);
};
