// src/api/notificationApi.js
import API from "./api";

// ==========================
// GET MY NOTIFICATIONS
// supports:
// ?page=1
// ?limit=10|20|50|100
// ?isRead=true|false
// ?type=CTO_APPLICATION_SUBMITTED|CTO_APPLICATION_APPROVED|CTO_APPLICATION_REJECTED|CTO_APPLICATION_CANCELLED|CTO_CREDITED|CTO_ROLLEDBACK|GENERAL
// ==========================
export const fetchMyNotifications = async (params = {}) => {
  const { data } = await API.get("/notifications", { params });
  return data;
};

// ==========================
// GET UNREAD COUNT
// ==========================
export const fetchMyUnreadNotificationCount = async () => {
  const { data } = await API.get("/notifications/unread-count");
  return data;
};

// ==========================
// MARK ONE AS READ
// ==========================
export const markNotificationAsRead = async (id) => {
  const { data } = await API.patch(`/notifications/${id}/read`);
  return data;
};

// ==========================
// MARK ALL AS READ
// ==========================
export const markAllNotificationsAsRead = async () => {
  const { data } = await API.patch("/notifications/read-all");
  return data;
};

// ==========================
// DELETE ONE NOTIFICATION
// ==========================
export const deleteNotification = async (id) => {
  const { data } = await API.delete(`/notifications/${id}`);
  return data;
};
