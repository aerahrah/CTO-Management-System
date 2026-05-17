const express = require("express");
const NotificationController = require("../controllers/notificationController");

const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// =============================
// HELPERS
// =============================
const authOnly = [authenticateToken];

// =============================
// NOTIFICATIONS (Self-Service)
// =============================
// All logged-in users have access to their own notifications without needing a specific permission role.

// Get own notifications
router.get("/", ...authOnly, NotificationController.getMyNotifications);

// Get unread notification count
router.get(
  "/unread-count",
  ...authOnly,
  NotificationController.getMyUnreadCount,
);

// Mark all own notifications as read
router.patch("/read-all", ...authOnly, NotificationController.markAllAsRead);

// Mark a specific notification as read
router.patch("/:id/read", ...authOnly, NotificationController.markOneAsRead);

// Delete a specific notification
router.delete("/:id", ...authOnly, NotificationController.deleteOne);

module.exports = router;
