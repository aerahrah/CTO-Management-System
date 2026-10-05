// services/notification.service.js
const mongoose = require("mongoose");
const Notification = require("../models/notificationsModel");
const { sendNotificationSms } = require("./smsService");

// Freeze arrays to prevent accidental mutation or prototype pollution
const ALLOWED_PAGE_SIZES = Object.freeze([25, 50, 75, 100]);
const DEFAULT_PAGE_SIZE = 25;

// --- HELPER FUNCTIONS ---

function createServiceError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id, fieldName = "ID") {
  if (!mongoose.isValidObjectId(id)) {
    throw createServiceError(`Invalid ${fieldName} format.`, 400);
  }
}

/**
 * Returns "First Last" for a person object, or the fallback if missing.
 */
function nameOf(person, fallback = "Someone") {
  if (!person) return fallback;
  const name = `${person.firstName || ""} ${person.lastName || ""}`.trim();
  return name || fallback;
}

/**
 * Merges explicit IDs with IDs from recipient objects into a unique, valid list.
 */
function uniqueRecipientIds(ids = [], people = []) {
  const combined = [...ids, ...people.map((p) => p?._id || p)];
  return [...new Set(combined.filter(Boolean).map(String))].filter((id) =>
    mongoose.isValidObjectId(id),
  );
}

/**
 * Safely dispatches a fire-and-forget SMS if the recipient object contains a phone number.
 */
function dispatchSmsSafely(recipientObj, messageText, clientRef) {
  // Targets recipientObj.phone to match your Employee schema
  if (recipientObj && recipientObj.phone) {
    sendNotificationSms(recipientObj.phone, messageText, clientRef).catch(
      (err) =>
        console.error(`[SMS Dispatch Failed] Ref: ${clientRef}`, err.message),
    );
  }
}

// --- SERVICE CLASS ---

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
    assertObjectId(recipientId, "Recipient ID");

    const { page, limit, skip } = this.normalizePagination(options);
    const filter = { recipient: recipientId };

    if (typeof options.isRead !== "undefined") {
      filter.isRead = options.isRead === "true" || options.isRead === true;
    }

    if (options.type) {
      filter.type = options.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .populate("actor", "firstName lastName email role")
        .select("-__v") // Exclude internal version key
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({
        recipient: recipientId,
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
    assertObjectId(recipientId, "Recipient ID");

    return Notification.countDocuments({
      recipient: recipientId,
      isRead: false,
    });
  }

  static async markAsRead(notificationId, recipientId) {
    assertObjectId(notificationId, "Notification ID");
    assertObjectId(recipientId, "Recipient ID");

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
      { new: true, runValidators: true },
    )
      .select("-__v")
      .lean();

    if (!notification) {
      throw createServiceError("Notification not found.", 404);
    }

    return notification;
  }

  static async markAllAsRead(recipientId) {
    assertObjectId(recipientId, "Recipient ID");

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
      { runValidators: true },
    );
  }

  static async deleteNotification(notificationId, recipientId) {
    assertObjectId(notificationId, "Notification ID");
    assertObjectId(recipientId, "Recipient ID");

    const deleted = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: recipientId,
    })
      .select("_id")
      .lean();

    if (!deleted) {
      throw createServiceError("Notification not found.", 404);
    }

    return deleted;
  }

  // =========================
  // CTO-specific helpers
  // =========================

  static async notifyApproversOnCtoSubmission({
    approverIds = [],
    approvers = [], // Array of objects containing .phone
    employee,
    ctoApplication,
  }) {
    if (!approverIds.length && !approvers.length) return [];

    const messageText = `${nameOf(employee, "An employee")} submitted a CTO application for approval.`;

    const notifications = uniqueRecipientIds(approverIds, approvers).map(
      (approverId) => ({
        recipient: approverId,
        actor: employee._id,
        type: "CTO_APPROVAL_REQUIRED",
        title: "New CTO Application",
        message: messageText,
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
      }),
    );

    const created = await this.createManyNotifications(notifications);

    approvers.forEach((approver) => {
      dispatchSmsSafely(
        approver,
        messageText,
        `cto-sub-req-${ctoApplication._id}-${approver._id || approver}`,
      );
    });

    return created;
  }

  static async notifyApproverOnCtoRequired({
    approverId,
    approver, // Object with .phone
    employee,
    ctoApplication,
  }) {
    const messageText = `${nameOf(employee, "An employee")} submitted a CTO application that needs your approval.`;

    const notification = await this.createNotification({
      recipient: approverId || approver?._id,
      actor: employee?._id || null,
      type: "CTO_APPROVAL_REQUIRED",
      title: "CTO Application Needs Approval",
      message: messageText,
      link: `/app/cto-approvals/${ctoApplication._id}`,
      priority: "HIGH",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        employeeId: employee?._id,
      },
    });

    dispatchSmsSafely(
      approver,
      messageText,
      `cto-req-${ctoApplication._id}-${approverId || approver?._id}`,
    );

    return notification;
  }

  static async notifyEmployeeOnCtoSubmissionCreated({
    employee,
    ctoApplication,
  }) {
    const messageText = "Your CTO application was submitted successfully.";

    const notification = await this.createNotification({
      recipient: employee._id,
      actor: employee._id,
      type: "CTO_APPROVAL_REQUIRED",
      title: "CTO Application Submitted",
      message: messageText,
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

    dispatchSmsSafely(employee, messageText, `cto-sub-${ctoApplication._id}`);

    return notification;
  }

  static async notifyEmployeeOnCtoApproval({
    employeeId,
    employee,
    approver,
    ctoApplication,
    approvalStep = null,
  }) {
    const messageText = `${nameOf(approver, "Approver")} approved your CTO application.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: approver?._id || null,
      type: "CTO_APPLICATION_APPROVED",
      title: "CTO Application Approved",
      message: messageText,
      link: `/app/cto-apply`,
      priority: "HIGH",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        approvalStepId: approvalStep?._id || null,
        employeeId: employeeId || employee?._id,
        extra: {
          overallStatus: ctoApplication.overallStatus,
        },
      },
    });

    dispatchSmsSafely(
      employee,
      messageText,
      `cto-apprv-${ctoApplication._id}-${approvalStep?._id || "final"}`,
    );

    return notification;
  }

  static async notifyEmployeeOnCtoRejection({
    employeeId,
    employee,
    approver,
    ctoApplication,
    approvalStep = null,
    remarks = "",
  }) {
    const approverName = nameOf(approver, "Approver");

    const messageText = remarks
      ? `${approverName} rejected your CTO application. Remarks: ${remarks}`
      : `${approverName} rejected your CTO application.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: approver?._id || null,
      type: "CTO_APPLICATION_REJECTED",
      title: "CTO Application Rejected",
      message: messageText,
      link: `/app/cto-apply`,
      priority: "HIGH",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        approvalStepId: approvalStep?._id || null,
        employeeId: employeeId || employee?._id,
        extra: {
          overallStatus: ctoApplication.overallStatus,
          remarks,
        },
      },
    });

    dispatchSmsSafely(employee, messageText, `cto-rej-${ctoApplication._id}`);

    return notification;
  }

  static async notifyApproversOnCtoCancellation({
    approverIds = [],
    approvers = [],
    employee,
    ctoApplication,
  }) {
    if (!approverIds.length && !approvers.length) return [];

    const messageText = `${nameOf(employee, "An employee")} cancelled a CTO application.`;

    const notifications = uniqueRecipientIds(approverIds, approvers).map(
      (approverId) => ({
        recipient: approverId,
        actor: employee._id,
        type: "CTO_APPLICATION_CANCELLED",
        title: "CTO Application Cancelled",
        message: messageText,
        link: `/app/cto-approvals`,
        priority: "MEDIUM",
        metadata: {
          ctoApplicationId: ctoApplication._id,
          employeeId: employee._id,
        },
      }),
    );

    const created = await this.createManyNotifications(notifications);

    approvers.forEach((approver) => {
      dispatchSmsSafely(
        approver,
        messageText,
        `cto-cxl-${ctoApplication._id}-${approver._id || approver}`,
      );
    });

    return created;
  }

  // =========================
  // CTO — Tagged / Notified Employees (Passive Observers - FYI Only)
  // =========================

  static async notifyTaggedEmployeesOnCtoSubmission({
    notifiedIds = [],
    notifiedEmployees = [],
    employee,
    ctoApplication,
  }) {
    if (!notifiedIds.length && !notifiedEmployees.length) return [];

    const messageText = `FYI: ${nameOf(employee, "An employee")} submitted a CTO application for ${ctoApplication.requestedHours} hour(s).`;

    const notifications = uniqueRecipientIds(
      notifiedIds,
      notifiedEmployees,
    ).map((recipientId) => ({
      recipient: recipientId,
      actor: employee?._id || null,
      type: "CTO_APPROVAL_REQUIRED",
      title: "CTO Application Submitted (FYI)",
      message: messageText,
      link: `/app/cto-approvals/${ctoApplication._id}`,
      priority: "MEDIUM",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        employeeId: employee?._id,
        extra: {
          isPassiveNotification: true,
          requestedHours: ctoApplication.requestedHours,
          inclusiveDates: ctoApplication.inclusiveDates,
        },
      },
    }));

    const created = await this.createManyNotifications(notifications);

    notifiedEmployees.forEach((emp) => {
      dispatchSmsSafely(
        emp,
        messageText,
        `cto-fyi-sub-${ctoApplication._id}-${emp?._id || emp}`,
      );
    });

    return created;
  }

  static async notifyTaggedEmployeesOnCtoFinalApproval({
    notifiedIds = [],
    notifiedEmployees = [],
    employee,
    approver,
    ctoApplication,
  }) {
    if (!notifiedIds.length && !notifiedEmployees.length) return [];

    const messageText = `FYI: ${nameOf(employee, "An employee")}'s CTO application for ${ctoApplication.requestedHours} hour(s) has been fully approved.`;

    const notifications = uniqueRecipientIds(
      notifiedIds,
      notifiedEmployees,
    ).map((recipientId) => ({
      recipient: recipientId,
      actor: approver?._id || null,
      type: "CTO_APPLICATION_APPROVED",
      title: "CTO Application Approved (FYI)",
      message: messageText,
      link: `/app/cto-approvals/${ctoApplication._id}`,
      priority: "MEDIUM",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        employeeId: employee?._id,
        extra: {
          isPassiveNotification: true,
          overallStatus: ctoApplication.overallStatus,
          requestedHours: ctoApplication.requestedHours,
        },
      },
    }));

    const created = await this.createManyNotifications(notifications);

    notifiedEmployees.forEach((emp) => {
      dispatchSmsSafely(
        emp,
        messageText,
        `cto-fyi-apprv-${ctoApplication._id}-${emp?._id || emp}`,
      );
    });

    return created;
  }

  static async notifyTaggedEmployeesOnCtoRejection({
    notifiedIds = [],
    notifiedEmployees = [],
    employee,
    approver,
    ctoApplication,
    approvalStep = null,
    remarks = "",
  }) {
    if (!notifiedIds.length && !notifiedEmployees.length) return [];

    const applicantName = nameOf(employee, "An employee");
    const approverName = nameOf(approver, "an approver");

    const messageText = remarks
      ? `FYI: ${applicantName}'s CTO application was rejected by ${approverName}. Remarks: ${remarks}`
      : `FYI: ${applicantName}'s CTO application was rejected by ${approverName}.`;

    const notifications = uniqueRecipientIds(
      notifiedIds,
      notifiedEmployees,
    ).map((recipientId) => ({
      recipient: recipientId,
      actor: approver?._id || null,
      type: "CTO_APPLICATION_REJECTED",
      title: "CTO Application Rejected (FYI)",
      message: messageText,
      link: `/app/cto-approvals/${ctoApplication._id}`,
      priority: "MEDIUM",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        approvalStepId: approvalStep?._id || null,
        employeeId: employee?._id,
        extra: {
          isPassiveNotification: true,
          overallStatus: ctoApplication.overallStatus,
          remarks,
        },
      },
    }));

    const created = await this.createManyNotifications(notifications);

    notifiedEmployees.forEach((emp) => {
      dispatchSmsSafely(
        emp,
        messageText,
        `cto-fyi-rej-${ctoApplication._id}-${emp?._id || emp}`,
      );
    });

    return created;
  }

  static async notifyTaggedEmployeesOnCtoCancellation({
    notifiedIds = [],
    notifiedEmployees = [],
    employee,
    ctoApplication,
  }) {
    if (!notifiedIds.length && !notifiedEmployees.length) return [];

    const messageText = `FYI: ${nameOf(employee, "An employee")} cancelled their CTO application.`;

    const notifications = uniqueRecipientIds(
      notifiedIds,
      notifiedEmployees,
    ).map((recipientId) => ({
      recipient: recipientId,
      actor: employee?._id || null,
      type: "CTO_APPLICATION_CANCELLED",
      title: "CTO Application Cancelled (FYI)",
      message: messageText,
      link: `/app/cto-approvals`,
      priority: "MEDIUM",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        employeeId: employee?._id,
        extra: {
          isPassiveNotification: true,
        },
      },
    }));

    const created = await this.createManyNotifications(notifications);

    notifiedEmployees.forEach((emp) => {
      dispatchSmsSafely(
        emp,
        messageText,
        `cto-fyi-cxl-${ctoApplication._id}-${emp?._id || emp}`,
      );
    });

    return created;
  }

  static async notifyApproverOnCtoFollowUp({
    approverId,
    approver,
    employee,
    ctoApplication,
  }) {
    const messageText = `${nameOf(employee, "An employee")} has requested a follow-up on their pending CTO application.`;

    const notification = await this.createNotification({
      recipient: approverId || approver?._id,
      actor: employee._id,
      type: "CTO_FOLLOW_UP",
      title: "Reminder: CTO Approval Pending",
      message: messageText,
      link: `/app/cto-approvals/${ctoApplication._id}`,
      priority: "HIGH",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        employeeId: employee._id,
      },
    });

    dispatchSmsSafely(approver, messageText, `cto-fu-${ctoApplication._id}`);

    return notification;
  }

  static async notifyEmployeeOnCtoCredit({
    employeeId,
    employee,
    hrEmployee,
    ctoCredit,
    creditedHours,
  }) {
    const messageText = `${nameOf(hrEmployee, "HR")} credited ${creditedHours} CTO hour(s) to your balance.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: hrEmployee?._id || null,
      type: "CTO_CREDITED",
      title: "CTO Credited",
      message: messageText,
      link: `/app/cto-my-credits`,
      priority: "MEDIUM",
      metadata: {
        ctoCreditId: ctoCredit._id,
        employeeId: employeeId || employee?._id,
        extra: {
          creditedHours,
          memoNo: ctoCredit.memoNo,
        },
      },
    });

    dispatchSmsSafely(employee, messageText, `cto-cred-${ctoCredit._id}`);

    return notification;
  }

  static async notifyEmployeeOnCtoRollback({
    employeeId,
    employee,
    hrEmployee,
    ctoCredit,
    rolledBackHours = null,
  }) {
    const hrName = nameOf(hrEmployee, "HR");

    const messageText =
      rolledBackHours !== null
        ? `${hrName} rolled back ${rolledBackHours} CTO hour(s) from your balance.`
        : `${hrName} rolled back a CTO credit from your balance.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: hrEmployee?._id || null,
      type: "CTO_ROLLEDBACK",
      title: "CTO Rolled Back",
      message: messageText,
      link: `/app/cto-my-credits`,
      priority: "HIGH",
      metadata: {
        ctoCreditId: ctoCredit._id,
        employeeId: employeeId || employee?._id,
        extra: {
          rolledBackHours,
          memoNo: ctoCredit.memoNo,
        },
      },
    });

    dispatchSmsSafely(employee, messageText, `cto-rb-${ctoCredit._id}`);

    return notification;
  }

  // =========================
  // CTO Revocations
  // =========================

  static async notifyHrOnCtoRevocationRequest({
    hrIds = [],
    hrs = [], // Array of HR objects with .phone
    employee,
    ctoApplication,
  }) {
    if (!hrIds.length && !hrs.length) return [];

    const messageText = `${nameOf(employee, "An employee")} requested to revoke an approved CTO application.`;

    const notifications = uniqueRecipientIds(hrIds, hrs).map((hrId) => ({
      recipient: hrId,
      actor: employee._id,
      type: "CTO_REVOCATION_REQUESTED",
      title: "CTO Revocation Request",
      message: messageText,
      link: `/app/leave-revocations/${ctoApplication._id}`,
      priority: "HIGH",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        employeeId: employee._id,
      },
    }));

    const created = await this.createManyNotifications(notifications);

    hrs.forEach((hr) => {
      dispatchSmsSafely(
        hr,
        messageText,
        `cto-rev-req-${ctoApplication._id}-${hr._id || hr}`,
      );
    });

    return created;
  }

  static async notifyHrOnCtoRevocationCancelled({
    hrIds = [],
    hrs = [],
    employee,
    ctoApplication,
  }) {
    if (!hrIds.length && !hrs.length) return [];

    const messageText = `${nameOf(employee, "An employee")} withdrew their CTO revocation request.`;

    const notifications = uniqueRecipientIds(hrIds, hrs).map((hrId) => ({
      recipient: hrId,
      actor: employee._id,
      type: "CTO_REVOCATION_CANCELLED",
      title: "CTO Revocation Withdrawn",
      message: messageText,
      link: `/app/leave-revocations`,
      priority: "MEDIUM",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        employeeId: employee._id,
      },
    }));

    const created = await this.createManyNotifications(notifications);

    hrs.forEach((hr) => {
      dispatchSmsSafely(
        hr,
        messageText,
        `cto-rev-cxl-${ctoApplication._id}-${hr._id || hr}`,
      );
    });

    return created;
  }

  static async notifyEmployeeOnCtoRevocationApproved({
    employeeId,
    employee,
    hrEmployee,
    ctoApplication,
    restoredHours,
  }) {
    const messageText = `${nameOf(hrEmployee, "HR")} approved your CTO revocation. ${restoredHours} hour(s) have been restored.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: hrEmployee?._id || null,
      type: "CTO_REVOCATION_APPROVED",
      title: "CTO Revocation Approved",
      message: messageText,
      link: `/app/cto-apply`,
      priority: "HIGH",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        employeeId: employeeId || employee?._id,
      },
    });

    dispatchSmsSafely(
      employee,
      messageText,
      `cto-rev-apprv-${ctoApplication._id}`,
    );

    return notification;
  }

  static async notifyEmployeeOnCtoRevocationRejected({
    employeeId,
    employee,
    hrEmployee,
    ctoApplication,
    remarks,
  }) {
    const hrName = nameOf(hrEmployee, "HR");

    const messageText = remarks
      ? `${hrName} rejected your CTO revocation request. Reason: ${remarks}`
      : `${hrName} rejected your CTO revocation request.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: hrEmployee?._id || null,
      type: "CTO_REVOCATION_REJECTED",
      title: "CTO Revocation Rejected",
      message: messageText,
      link: `/app/cto-apply`,
      priority: "HIGH",
      metadata: {
        ctoApplicationId: ctoApplication._id,
        employeeId: employeeId || employee?._id,
      },
    });

    dispatchSmsSafely(
      employee,
      messageText,
      `cto-rev-rej-${ctoApplication._id}`,
    );

    return notification;
  }

  // =========================
  // Wellness-specific helpers
  // =========================

  static async notifyApproverOnWellnessSubmission({
    approverId,
    approver,
    employee,
    wellnessApplication,
    totalDays,
  }) {
    const messageText = `${nameOf(employee, "An employee")} submitted a Wellness Leave request for ${totalDays} day(s).`;

    const notification = await this.createNotification({
      recipient: approverId || approver?._id,
      actor: employee._id,
      type: "WELLNESS_APPROVAL_REQUIRED",
      title: "New Wellness Leave Request",
      message: messageText,
      link: `/app/wellness-approvals/${wellnessApplication._id}`,
      priority: "HIGH",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employee._id,
      },
    });

    dispatchSmsSafely(
      approver,
      messageText,
      `well-req-${wellnessApplication._id}-${approverId || approver?._id}`,
    );

    return notification;
  }

  static async notifyEmployeeOnWellnessApproval({
    employeeId,
    employee,
    approver,
    wellnessApplication,
    allApproved = false,
  }) {
    const messageText = allApproved
      ? `Your Wellness Leave request has been fully approved.`
      : `${nameOf(approver, "Approver")} approved your Wellness Leave request.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: approver?._id || null,
      type: "WELLNESS_APPLICATION_APPROVED",
      title: allApproved
        ? "Wellness Leave Fully Approved"
        : "Wellness Leave Step Approved",
      message: messageText,
      link: `/app/wellness-apply`,
      priority: "HIGH",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employeeId || employee?._id,
        extra: {
          overallStatus: wellnessApplication.overallStatus,
        },
      },
    });

    dispatchSmsSafely(
      employee,
      messageText,
      `well-apprv-${wellnessApplication._id}-${allApproved ? "final" : "step"}`,
    );

    return notification;
  }

  static async notifyApproverOnWellnessRequired({
    approverId,
    approver,
    employee,
    wellnessApplication,
  }) {
    const messageText = `${nameOf(employee, "An employee")} submitted a Wellness Leave request that needs your approval.`;

    const notification = await this.createNotification({
      recipient: approverId || approver?._id,
      actor: employee?._id || null,
      type: "WELLNESS_APPROVAL_REQUIRED",
      title: "Wellness Leave Request Needs Approval",
      message: messageText,
      link: `/app/wellness-approvals/${wellnessApplication._id}`,
      priority: "HIGH",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employee?._id,
      },
    });

    dispatchSmsSafely(
      approver,
      messageText,
      `well-req2-${wellnessApplication._id}-${approverId || approver?._id}`,
    );

    return notification;
  }

  static async notifyEmployeeOnWellnessRejection({
    employeeId,
    employee,
    approver,
    wellnessApplication,
    remarks = "",
  }) {
    const approverName = nameOf(approver, "Approver");

    const messageText = remarks
      ? `${approverName} rejected your Wellness Leave request. Remarks: ${remarks}`
      : `${approverName} rejected your Wellness Leave request.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: approver?._id || null,
      type: "WELLNESS_APPLICATION_REJECTED",
      title: "Wellness Leave Rejected",
      message: messageText,
      link: `/app/wellness-apply`,
      priority: "HIGH",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employeeId || employee?._id,
        extra: {
          overallStatus: wellnessApplication.overallStatus,
          remarks,
        },
      },
    });

    dispatchSmsSafely(
      employee,
      messageText,
      `well-rej-${wellnessApplication._id}`,
    );

    return notification;
  }

  static async notifyApproversOnWellnessCancellation({
    approverIds = [],
    approvers = [],
    employee,
    wellnessApplication,
  }) {
    if (!approverIds.length && !approvers.length) return [];

    const messageText = `${nameOf(employee, "An employee")} cancelled a Wellness Leave application.`;

    const notifications = uniqueRecipientIds(approverIds, approvers).map(
      (approverId) => ({
        recipient: approverId,
        actor: employee._id,
        type: "WELLNESS_APPLICATION_CANCELLED",
        title: "Wellness Leave Cancelled",
        message: messageText,
        link: `/app/wellness-approvals`,
        priority: "MEDIUM",
        metadata: {
          wellnessApplicationId: wellnessApplication._id,
          employeeId: employee._id,
        },
      }),
    );

    const created = await this.createManyNotifications(notifications);

    approvers.forEach((approver) => {
      dispatchSmsSafely(
        approver,
        messageText,
        `well-cxl-${wellnessApplication._id}-${approver._id || approver}`,
      );
    });

    return created;
  }

  // =========================
  // Wellness — Tagged / Notified Employees (Passive Observers - FYI Only)
  // =========================

  static async notifyTaggedEmployeesOnWellnessSubmission({
    notifiedIds = [],
    notifiedEmployees = [],
    employee,
    wellnessApplication,
    totalDays,
  }) {
    if (!notifiedIds.length && !notifiedEmployees.length) return [];

    const days = totalDays ?? wellnessApplication.totalDays;
    const messageText = `FYI: ${nameOf(employee, "An employee")} submitted a Wellness Leave application for ${days} day(s).`;

    const notifications = uniqueRecipientIds(
      notifiedIds,
      notifiedEmployees,
    ).map((recipientId) => ({
      recipient: recipientId,
      actor: employee?._id || null,
      type: "WELLNESS_APPROVAL_REQUIRED",
      title: "Wellness Leave Submitted (FYI)",
      message: messageText,
      link: `/app/wellness-approvals/${wellnessApplication._id}`,
      priority: "MEDIUM",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employee?._id,
        extra: {
          isPassiveNotification: true,
          totalDays: days,
          inclusiveDates: wellnessApplication.inclusiveDates,
        },
      },
    }));

    const created = await this.createManyNotifications(notifications);

    notifiedEmployees.forEach((emp) => {
      dispatchSmsSafely(
        emp,
        messageText,
        `well-fyi-sub-${wellnessApplication._id}-${emp?._id || emp}`,
      );
    });

    return created;
  }

  static async notifyTaggedEmployeesOnWellnessFinalApproval({
    notifiedIds = [],
    notifiedEmployees = [],
    employee,
    approver,
    wellnessApplication,
  }) {
    if (!notifiedIds.length && !notifiedEmployees.length) return [];

    const messageText = `FYI: ${nameOf(employee, "An employee")}'s Wellness Leave for ${wellnessApplication.totalDays} day(s) has been fully approved.`;

    const notifications = uniqueRecipientIds(
      notifiedIds,
      notifiedEmployees,
    ).map((recipientId) => ({
      recipient: recipientId,
      actor: approver?._id || null,
      type: "WELLNESS_APPLICATION_APPROVED",
      title: "Wellness Leave Approved (FYI)",
      message: messageText,
      link: `/app/wellness-approvals/${wellnessApplication._id}`,
      priority: "MEDIUM",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employee?._id,
        extra: {
          isPassiveNotification: true,
          overallStatus: wellnessApplication.overallStatus,
          totalDays: wellnessApplication.totalDays,
        },
      },
    }));

    const created = await this.createManyNotifications(notifications);

    notifiedEmployees.forEach((emp) => {
      dispatchSmsSafely(
        emp,
        messageText,
        `well-fyi-apprv-${wellnessApplication._id}-${emp?._id || emp}`,
      );
    });

    return created;
  }

  static async notifyTaggedEmployeesOnWellnessRejection({
    notifiedIds = [],
    notifiedEmployees = [],
    employee,
    approver,
    wellnessApplication,
    remarks = "",
  }) {
    if (!notifiedIds.length && !notifiedEmployees.length) return [];

    const applicantName = nameOf(employee, "An employee");
    const approverName = nameOf(approver, "an approver");

    const messageText = remarks
      ? `FYI: ${applicantName}'s Wellness Leave was rejected by ${approverName}. Remarks: ${remarks}`
      : `FYI: ${applicantName}'s Wellness Leave was rejected by ${approverName}.`;

    const notifications = uniqueRecipientIds(
      notifiedIds,
      notifiedEmployees,
    ).map((recipientId) => ({
      recipient: recipientId,
      actor: approver?._id || null,
      type: "WELLNESS_APPLICATION_REJECTED",
      title: "Wellness Leave Rejected (FYI)",
      message: messageText,
      link: `/app/wellness-approvals/${wellnessApplication._id}`,
      priority: "MEDIUM",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employee?._id,
        extra: {
          isPassiveNotification: true,
          overallStatus: wellnessApplication.overallStatus,
          remarks,
        },
      },
    }));

    const created = await this.createManyNotifications(notifications);

    notifiedEmployees.forEach((emp) => {
      dispatchSmsSafely(
        emp,
        messageText,
        `well-fyi-rej-${wellnessApplication._id}-${emp?._id || emp}`,
      );
    });

    return created;
  }

  static async notifyTaggedEmployeesOnWellnessCancellation({
    notifiedIds = [],
    notifiedEmployees = [],
    employee,
    wellnessApplication,
  }) {
    if (!notifiedIds.length && !notifiedEmployees.length) return [];

    const messageText = `FYI: ${nameOf(employee, "An employee")} cancelled their Wellness Leave application.`;

    const notifications = uniqueRecipientIds(
      notifiedIds,
      notifiedEmployees,
    ).map((recipientId) => ({
      recipient: recipientId,
      actor: employee?._id || null,
      type: "WELLNESS_APPLICATION_CANCELLED",
      title: "Wellness Leave Cancelled (FYI)",
      message: messageText,
      link: `/app/wellness-approvals`,
      priority: "MEDIUM",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employee?._id,
        extra: {
          isPassiveNotification: true,
        },
      },
    }));

    const created = await this.createManyNotifications(notifications);

    notifiedEmployees.forEach((emp) => {
      dispatchSmsSafely(
        emp,
        messageText,
        `well-fyi-cxl-${wellnessApplication._id}-${emp?._id || emp}`,
      );
    });

    return created;
  }

  static async notifyApproverOnWellnessFollowUp({
    approverId,
    approver,
    employee,
    wellnessApplication,
  }) {
    const messageText = `${nameOf(employee, "An employee")} has requested a follow-up on their pending Wellness Leave application.`;

    const notification = await this.createNotification({
      recipient: approverId || approver?._id,
      actor: employee._id,
      type: "WELLNESS_FOLLOW_UP",
      title: "Reminder: Wellness Leave Pending Approval",
      message: messageText,
      link: `/app/wellness-approvals/${wellnessApplication._id}`,
      priority: "HIGH",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employee._id,
      },
    });

    dispatchSmsSafely(
      approver,
      messageText,
      `well-fu-${wellnessApplication._id}`,
    );

    return notification;
  }

  static async notifyEmployeeOnWellnessCredit({
    employeeId,
    employee,
    hrEmployee,
    wellnessCredit,
    creditedDays,
  }) {
    const messageText = `${nameOf(hrEmployee, "HR")} credited ${creditedDays} Wellness Leave day(s) to your balance.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: hrEmployee?._id || null,
      type: "WELLNESS_CREDITED",
      title: "Wellness Leave Credited",
      message: messageText,
      link: `/app/wellness-apply`,
      priority: "MEDIUM",
      metadata: {
        wellnessCreditId: wellnessCredit._id,
        employeeId: employeeId || employee?._id,
        extra: {
          creditedDays,
        },
      },
    });

    dispatchSmsSafely(employee, messageText, `well-cred-${wellnessCredit._id}`);

    return notification;
  }

  static async notifyEmployeeOnWellnessRollback({
    employeeId,
    employee,
    hrEmployee,
    wellnessCredit,
    rolledBackDays = null,
  }) {
    const hrName = nameOf(hrEmployee, "HR");

    const messageText =
      rolledBackDays !== null
        ? `${hrName} rolled back ${rolledBackDays} Wellness Leave day(s) from your balance.`
        : `${hrName} rolled back a Wellness Leave credit from your balance.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: hrEmployee?._id || null,
      type: "WELLNESS_ROLLEDBACK",
      title: "Wellness Leave Rolled Back",
      message: messageText,
      link: `/app/wellness-apply`,
      priority: "HIGH",
      metadata: {
        wellnessCreditId: wellnessCredit._id,
        employeeId: employeeId || employee?._id,
        extra: {
          rolledBackDays,
        },
      },
    });

    dispatchSmsSafely(employee, messageText, `well-rb-${wellnessCredit._id}`);

    return notification;
  }

  // =========================
  // Wellness Revocations
  // =========================

  static async notifyHrOnWellnessRevocationRequest({
    hrIds = [],
    hrs = [],
    employee,
    wellnessApplication,
  }) {
    if (!hrIds.length && !hrs.length) return [];

    const messageText = `${nameOf(employee, "An employee")} requested to revoke an approved Wellness Leave.`;

    const notifications = uniqueRecipientIds(hrIds, hrs).map((hrId) => ({
      recipient: hrId,
      actor: employee._id,
      type: "WELLNESS_REVOCATION_REQUESTED",
      title: "Wellness Revocation Request",
      message: messageText,
      link: `/app/leave-revocations/${wellnessApplication._id}?type=WELLNESS`,
      priority: "HIGH",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employee._id,
      },
    }));

    const created = await this.createManyNotifications(notifications);

    hrs.forEach((hr) => {
      dispatchSmsSafely(
        hr,
        messageText,
        `well-rev-req-${wellnessApplication._id}-${hr._id || hr}`,
      );
    });

    return created;
  }

  static async notifyHrOnWellnessRevocationCancelled({
    hrIds = [],
    hrs = [],
    employee,
    wellnessApplication,
  }) {
    if (!hrIds.length && !hrs.length) return [];

    const messageText = `${nameOf(employee, "An employee")} withdrew their Wellness Leave revocation request.`;

    const notifications = uniqueRecipientIds(hrIds, hrs).map((hrId) => ({
      recipient: hrId,
      actor: employee._id,
      type: "WELLNESS_REVOCATION_CANCELLED",
      title: "Wellness Revocation Withdrawn",
      message: messageText,
      link: `/app/leave-revocations`,
      priority: "MEDIUM",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employee._id,
      },
    }));

    const created = await this.createManyNotifications(notifications);

    hrs.forEach((hr) => {
      dispatchSmsSafely(
        hr,
        messageText,
        `well-rev-cxl-${wellnessApplication._id}-${hr._id || hr}`,
      );
    });

    return created;
  }

  static async notifyEmployeeOnWellnessRevocationApproved({
    employeeId,
    employee,
    hrEmployee,
    wellnessApplication,
    restoredDays,
  }) {
    const messageText = `${nameOf(hrEmployee, "HR")} approved your Wellness revocation. ${restoredDays} day(s) have been restored.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: hrEmployee?._id || null,
      type: "WELLNESS_REVOCATION_APPROVED",
      title: "Wellness Revocation Approved",
      message: messageText,
      link: `/app/wellness-apply`,
      priority: "HIGH",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employeeId || employee?._id,
      },
    });

    dispatchSmsSafely(
      employee,
      messageText,
      `well-rev-apprv-${wellnessApplication._id}`,
    );

    return notification;
  }

  static async notifyEmployeeOnWellnessRevocationRejected({
    employeeId,
    employee,
    hrEmployee,
    wellnessApplication,
    remarks,
  }) {
    const hrName = nameOf(hrEmployee, "HR");

    const messageText = remarks
      ? `${hrName} rejected your Wellness revocation request. Reason: ${remarks}`
      : `${hrName} rejected your Wellness revocation request.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: hrEmployee?._id || null,
      type: "WELLNESS_REVOCATION_REJECTED",
      title: "Wellness Revocation Rejected",
      message: messageText,
      link: `/app/wellness-apply`,
      priority: "HIGH",
      metadata: {
        wellnessApplicationId: wellnessApplication._id,
        employeeId: employeeId || employee?._id,
      },
    });

    dispatchSmsSafely(
      employee,
      messageText,
      `well-rev-rej-${wellnessApplication._id}`,
    );

    return notification;
  }

  // =========================
  // Regular Leave Credit helpers (VL / SL)
  // =========================

  static async notifyEmployeeOnLeaveCredit({
    employeeId,
    employee,
    hrEmployee,
    leaveCredit,
    creditedDays,
    leaveType,
  }) {
    const messageText = `${nameOf(hrEmployee, "HR")} credited ${creditedDays} ${leaveType} day(s) to your balance.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: hrEmployee?._id || null,
      type: "LEAVE_CREDITED",
      title: `${leaveType} Leave Credited`,
      message: messageText,
      link: `/app/leave-balances`,
      priority: "MEDIUM",
      metadata: {
        leaveCreditId: leaveCredit._id,
        employeeId: employeeId || employee?._id,
        extra: {
          creditedDays,
          leaveType,
        },
      },
    });

    dispatchSmsSafely(employee, messageText, `leave-cred-${leaveCredit._id}`);

    return notification;
  }

  static async notifyEmployeeOnLeaveRollback({
    employeeId,
    employee,
    hrEmployee,
    leaveCredit,
    rolledBackDays = null,
  }) {
    const hrName = nameOf(hrEmployee, "HR");
    const leaveType = leaveCredit?.leaveType || "Leave";

    const messageText =
      rolledBackDays !== null
        ? `${hrName} rolled back ${rolledBackDays} ${leaveType} day(s) from your balance.`
        : `${hrName} rolled back a ${leaveType} credit from your balance.`;

    const notification = await this.createNotification({
      recipient: employeeId || employee?._id,
      actor: hrEmployee?._id || null,
      type: "LEAVE_ROLLEDBACK",
      title: `${leaveType} Leave Rolled Back`,
      message: messageText,
      link: `/app/leave-balances`,
      priority: "HIGH",
      metadata: {
        leaveCreditId: leaveCredit._id,
        employeeId: employeeId || employee?._id,
        extra: {
          rolledBackDays,
          leaveType,
        },
      },
    });

    dispatchSmsSafely(employee, messageText, `leave-rb-${leaveCredit._id}`);

    return notification;
  }
}

module.exports = NotificationService;
