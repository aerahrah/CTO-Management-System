const mongoose = require("mongoose");
const Notification = require("../models/notificationsModel");

const ALLOWED_PAGE_SIZES = [25, 50, 75, 100];
const DEFAULT_PAGE_SIZE = 25;

class NotificationService {
  static async createNotification(payload) {
    return Notification.create(payload);
  }

  static async createManyNotifications(notifications = []) {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return [];
    }

    return Notification.insertMany(notifications);
  }

  static normalizePagination(options = {}) {
    const page = Math.max(parseInt(options.page, 10) || 1, 1);

    let limit = parseInt(options.limit, 10);
    if (!ALLOWED_PAGE_SIZES.includes(limit)) {
      limit = DEFAULT_PAGE_SIZE;
    }

    const skip = (page - 1) * limit;

    return { page, limit, skip };
  }

  static async getUserNotifications(recipientId, options = {}) {
    const { page, limit, skip } = this.normalizePagination(options);

    const recipientObjectId = new mongoose.Types.ObjectId(recipientId);

    const filter = {
      recipient: recipientObjectId,
    };

    if (typeof options.isRead !== "undefined") {
      filter.isRead = options.isRead === "true" || options.isRead === true;
    }

    if (options.type) {
      filter.type = options.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .populate("actor", "firstName lastName username role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({
        recipient: recipientObjectId,
        isRead: false,
      }),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return {
      data: notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        allowedPageSizes: ALLOWED_PAGE_SIZES,
        defaultPageSize: DEFAULT_PAGE_SIZE,
      },
      unreadCount,
    };
  }

  static async getUnreadCount(recipientId) {
    return Notification.countDocuments({
      recipient: new mongoose.Types.ObjectId(recipientId),
      isRead: false,
    });
  }

  static async markAsRead(notificationId, recipientId) {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: recipientId,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true },
    );

    if (!notification) {
      throw new Error("Notification not found.");
    }

    return notification;
  }

  static async markAllAsRead(recipientId) {
    return Notification.updateMany(
      {
        recipient: recipientId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
    );
  }

  static async deleteNotification(notificationId, recipientId) {
    const deleted = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: recipientId,
    });

    if (!deleted) {
      throw new Error("Notification not found.");
    }

    return deleted;
  }

  // =========================
  // CTO-specific helpers
  // =========================

  static async notifyApproversOnCtoSubmission({
    approverIds = [],
    employee,
    ctoApplication,
  }) {
    if (!approverIds.length) return [];

    const fullName = `${employee.firstName} ${employee.lastName}`;
    const uniqueApproverIds = [...new Set(approverIds.map(String))];

    const notifications = uniqueApproverIds.map((approverId) => ({
      recipient: approverId,
      actor: employee._id,
      type: "CTO_APPLICATION_SUBMITTED",
      title: "New CTO Application",
      message: `${fullName} submitted a CTO application for approval.`,
      link: `/app/cto-approvals/${ctoApplication._id}`,
      priority: "HIGH",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        employeeId: employee._id,
        extra: {
          requestedHours: ctoApplication.requestedHours,
          inclusiveDates: ctoApplication.inclusiveDates,
        },
      },
    }));

    return this.createManyNotifications(notifications);
  }

  static async notifyEmployeeOnCtoSubmissionCreated({
    employee,
    ctoApplication,
  }) {
    return this.createNotification({
      recipient: employee._id,
      actor: employee._id,
      type: "CTO_APPLICATION_SUBMITTED",
      title: "CTO Application Submitted",
      message: "Your CTO application was submitted successfully.",
      link: `/app/cto-apply`,
      priority: "MEDIUM",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        employeeId: employee._id,
        extra: {
          requestedHours: ctoApplication.requestedHours,
          inclusiveDates: ctoApplication.inclusiveDates,
          overallStatus: ctoApplication.overallStatus,
        },
      },
    });
  }

  static async notifyEmployeeOnCtoApproval({
    employeeId,
    approver,
    ctoApplication,
    approvalStep = null,
  }) {
    const fullName = approver
      ? `${approver.firstName} ${approver.lastName}`
      : "Approver";

    return this.createNotification({
      recipient: employeeId,
      actor: approver?._id || null,
      type: "CTO_APPLICATION_APPROVED",
      title: "CTO Application Approved",
      message: `${fullName} approved your CTO application.`,
      link: `/app/cto-apply`,
      priority: "HIGH",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        approvalStepId: approvalStep?._id || null,
        employeeId,
        extra: {
          overallStatus: ctoApplication.overallStatus,
        },
      },
    });
  }

  static async notifyEmployeeOnCtoRejection({
    employeeId,
    approver,
    ctoApplication,
    approvalStep = null,
    remarks = "",
  }) {
    const fullName = approver
      ? `${approver.firstName} ${approver.lastName}`
      : "Approver";

    return this.createNotification({
      recipient: employeeId,
      actor: approver?._id || null,
      type: "CTO_APPLICATION_REJECTED",
      title: "CTO Application Rejected",
      message: remarks
        ? `${fullName} rejected your CTO application. Remarks: ${remarks}`
        : `${fullName} rejected your CTO application.`,
      link: `/app/cto-apply`,
      priority: "HIGH",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        approvalStepId: approvalStep?._id || null,
        employeeId,
        extra: {
          overallStatus: ctoApplication.overallStatus,
          remarks,
        },
      },
    });
  }

  static async notifyEmployeeOnCtoCredit({
    employeeId,
    hrEmployee,
    ctoCredit,
    creditedHours,
  }) {
    const fullName = hrEmployee
      ? `${hrEmployee.firstName} ${hrEmployee.lastName}`
      : "HR";

    return this.createNotification({
      recipient: employeeId,
      actor: hrEmployee?._id || null,
      type: "CTO_CREDITED",
      title: "CTO Credited",
      message: `${fullName} credited ${creditedHours} CTO hour(s) to your balance.`,
      link: `/app/cto-my-credits`,
      priority: "MEDIUM",
      metadata: {
        ctoCreditId: ctoCredit._id,
        employeeId,
        extra: {
          creditedHours,
          memoNo: ctoCredit.memoNo,
        },
      },
    });
  }

  static async notifyEmployeeOnCtoRollback({
    employeeId,
    hrEmployee,
    ctoCredit,
    rolledBackHours = null,
  }) {
    const fullName = hrEmployee
      ? `${hrEmployee.firstName} ${hrEmployee.lastName}`
      : "HR";

    return this.createNotification({
      recipient: employeeId,
      actor: hrEmployee?._id || null,
      type: "CTO_ROLLEDBACK",
      title: "CTO Rolled Back",
      message:
        rolledBackHours !== null
          ? `${fullName} rolled back ${rolledBackHours} CTO hour(s) from your balance.`
          : `${fullName} rolled back a CTO credit from your balance.`,
      link: `/app/cto-my-credits`,
      priority: "HIGH",
      metadata: {
        ctoCreditId: ctoCredit._id,
        employeeId,
        extra: {
          rolledBackHours,
          memoNo: ctoCredit.memoNo,
        },
      },
    });
  }
}

module.exports = NotificationService;
