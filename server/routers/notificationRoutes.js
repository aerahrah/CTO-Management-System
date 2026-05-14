const express = require("express");
const NotificationController = require("../controllers/notificationController");

const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// ==========================
// ALL AUTHENTICATED USERS
// ==========================

router.get(
  "/",
  authenticateToken,

  NotificationController.getMyNotifications,
);

router.get(
  "/unread-count",
  authenticateToken,

  NotificationController.getMyUnreadCount,
);

router.patch(
  "/read-all",
  authenticateToken,

  NotificationController.markAllAsRead,
);

router.patch(
  "/:id/read",
  authenticateToken,

  NotificationController.markOneAsRead,
);

router.delete(
  "/:id",
  authenticateToken,

  NotificationController.deleteOne,
);

module.exports = router;
