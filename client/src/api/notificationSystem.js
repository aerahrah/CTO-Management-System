// src/api/notificationApi.js
import API from "./api";

export const NOTIFICATION_PAGE_SIZE_OPTIONS = [25, 50, 75, 100];
export const DEFAULT_NOTIFICATION_PAGE_SIZE = 25;

export const NOTIFICATION_TYPES = {
  CTO_APPLICATION_SUBMITTED: "CTO_APPLICATION_SUBMITTED",
  CTO_APPLICATION_APPROVED: "CTO_APPLICATION_APPROVED",
  CTO_APPLICATION_REJECTED: "CTO_APPLICATION_REJECTED",
  CTO_APPLICATION_CANCELLED: "CTO_APPLICATION_CANCELLED",
  CTO_CREDITED: "CTO_CREDITED",
  CTO_ROLLEDBACK: "CTO_ROLLEDBACK",
  GENERAL: "GENERAL",
};

const normalizePage = (page) => {
  const parsed = Number(page);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
};

const normalizeLimit = (limit) => {
  const parsed = Number(limit);
  if (!NOTIFICATION_PAGE_SIZE_OPTIONS.includes(parsed)) {
    return DEFAULT_NOTIFICATION_PAGE_SIZE;
  }
  return parsed;
};

// ==========================
// GET MY NOTIFICATIONS
// supports:
// ?page=1
// ?limit=25|50|75|100
// ?isRead=true|false
// ?type=CTO_APPLICATION_SUBMITTED|CTO_APPLICATION_APPROVED|CTO_APPLICATION_REJECTED|CTO_APPLICATION_CANCELLED|CTO_CREDITED|CTO_ROLLEDBACK|GENERAL
// backend default limit: 25
// ==========================
export const fetchMyNotifications = async (params = {}) => {
  const queryParams = {
    page: normalizePage(params.page ?? 1),
    limit: normalizeLimit(params.limit ?? DEFAULT_NOTIFICATION_PAGE_SIZE),
  };

  if (typeof params.isRead !== "undefined") {
    queryParams.isRead = params.isRead;
  }

  if (params.type) {
    queryParams.type = params.type;
  }

  const { data } = await API.get("/notifications", {
    params: queryParams,
  });

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
