const express = require("express");
const NotificationController = require("../controllers/notificationController");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// ==========================
// ALL AUTHENTICATED USERS
// ==========================

router.get(
  "/",
  authenticateToken,
  authorizeRoles("employee", "supervisor", "hr", "admin"),
  NotificationController.getMyNotifications,
);

router.get(
  "/unread-count",
  authenticateToken,
  authorizeRoles("employee", "supervisor", "hr", "admin"),
  NotificationController.getMyUnreadCount,
);

router.patch(
  "/read-all",
  authenticateToken,
  authorizeRoles("employee", "supervisor", "hr", "admin"),
  NotificationController.markAllAsRead,
);

router.patch(
  "/:id/read",
  authenticateToken,
  authorizeRoles("employee", "supervisor", "hr", "admin"),
  NotificationController.markOneAsRead,
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("employee", "supervisor", "hr", "admin"),
  NotificationController.deleteOne,
);

module.exports = router;
