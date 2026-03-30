const NotificationService = require("../services/notificationService");

class NotificationController {
  static async getMyNotifications(req, res) {
    try {
      const recipientId = req.user._id;

      const result = await NotificationService.getUserNotifications(
        recipientId,
        {
          page: req.query.page,
          limit: req.query.limit,
          isRead: req.query.isRead,
          type: req.query.type,
        },
      );

      return res.status(200).json({
        success: true,
        message: "Notifications fetched successfully.",
        ...result,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch notifications.",
      });
    }
  }

  static async getMyUnreadCount(req, res) {
    try {
      const unreadCount = await NotificationService.getUnreadCount(
        req.user._id,
      );

      return res.status(200).json({
        success: true,
        unreadCount,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch unread count.",
      });
    }
  }

  static async markOneAsRead(req, res) {
    try {
      const notification = await NotificationService.markAsRead(
        req.params.id,
        req.user._id,
      );

      return res.status(200).json({
        success: true,
        message: "Notification marked as read.",
        data: notification,
      });
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: error.message || "Failed to mark notification as read.",
      });
    }
  }

  static async markAllAsRead(req, res) {
    try {
      const result = await NotificationService.markAllAsRead(req.user._id);

      return res.status(200).json({
        success: true,
        message: "All notifications marked as read.",
        modifiedCount: result.modifiedCount || 0,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to mark all notifications as read.",
      });
    }
  }

  static async deleteOne(req, res) {
    try {
      await NotificationService.deleteNotification(req.params.id, req.user._id);

      return res.status(200).json({
        success: true,
        message: "Notification deleted successfully.",
      });
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: error.message || "Failed to delete notification.",
      });
    }
  }
}

module.exports = NotificationController;
