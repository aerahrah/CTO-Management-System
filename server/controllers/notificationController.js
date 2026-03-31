const NotificationService = require("../services/notificationService");

function getRecipientId(req) {
  return req?.user?._id || req?.user?.id || null;
}

class NotificationController {
  static async getMyNotifications(req, res) {
    try {
      const recipientId = getRecipientId(req);

      if (!recipientId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

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
      const recipientId = getRecipientId(req);

      if (!recipientId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const unreadCount = await NotificationService.getUnreadCount(recipientId);

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
      const recipientId = getRecipientId(req);

      if (!recipientId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const notification = await NotificationService.markAsRead(
        req.params.id,
        recipientId,
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
      const recipientId = getRecipientId(req);

      if (!recipientId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await NotificationService.markAllAsRead(recipientId);

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
      const recipientId = getRecipientId(req);

      if (!recipientId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      await NotificationService.deleteNotification(req.params.id, recipientId);

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
