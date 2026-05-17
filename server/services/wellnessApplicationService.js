const WellnessApplication = require("../models/wellnessApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const Employee = require("../models/employeeModel");
const mongoose = require("mongoose");
const { resolveApproversFromRoute } = require("./approvalRoute.service");
const NotificationService = require("./notificationService");

/* =========================
   Helpers
========================= */

const populateApplicationById = async (applicationId, session = null) => {
  return WellnessApplication.findById(applicationId)
    .populate("employee", "firstName lastName position email employeeId")
    .populate({
      path: "approvals",
      populate: {
        path: "approver",
        select: "firstName lastName position email",
      },
      options: { sort: { level: 1 } },
    })
    .session(session);
};

const cancelApprovalSteps = async (
  { applicationId, approvalIds, reason, afterLevel = 0 },
  session = null,
) => {
  // ✅ Explicitly targets ONLY "PENDING" steps.
  // This protects any "APPROVED" or "REJECTED" steps so the approver keeps their credit!
  await ApprovalStep.updateMany(
    {
      _id: { $in: approvalIds },
      status: "PENDING",
      level: { $gt: afterLevel },
      wellnessApplication: applicationId,
    },
    {
      $set: {
        status: "CANCELLED",
        remarks: reason,
        reviewedAt: new Date(),
      },
    },
    { session },
  );
};

const notifyApproversOfCancellation = async ({
  application,
  employee,
  approvalIds = [],
}) => {
  if (!approvalIds.length) return;

  const approvalSteps = await ApprovalStep.find({
    _id: { $in: approvalIds },
  }).select("approver level status");

  const approverIds = [
    ...new Set(
      approvalSteps
        .filter((step) => step?.approver)
        .map((step) => String(step.approver)),
    ),
  ];

  if (!approverIds.length) return;

  const fullName = `${employee.firstName} ${employee.lastName}`;

  await NotificationService.createManyNotifications(
    approverIds.map((approverId) => ({
      recipient: approverId,
      actor: employee._id,
      type: "WELLNESS_APPLICATION_CANCELLED",
      title: "Wellness Leave Cancelled",
      message: `${fullName} cancelled a Wellness Leave application.`,
      link: `/app/wellness-approvals`,
      priority: "MEDIUM",
      metadata: {
        wellnessApplicationId: application._id,
        employeeId: employee._id,
      },
    })),
  );
};

/* =========================
   Services
========================= */

const addWellnessApplicationService = async ({
  userId,
  inclusiveDates,
  reason,
  routeId,
  approvers,
  req, // ✅ Passed for future Audit Logging
}) => {
  if (
    !inclusiveDates ||
    !Array.isArray(inclusiveDates) ||
    inclusiveDates.length === 0 ||
    !reason
  ) {
    throw Object.assign(
      new Error("Inclusive dates array and reason are required."),
      { status: 400 },
    );
  }

  const totalDays = inclusiveDates.length;

  let finalApprovers = [];
  if (routeId) {
    finalApprovers = await resolveApproversFromRoute(routeId);
  } else if (approvers && Array.isArray(approvers)) {
    finalApprovers = approvers.filter(Boolean);
  }

  if (!finalApprovers || finalApprovers.length === 0) {
    throw Object.assign(new Error("At least one approver is required."), {
      status: 400,
    });
  }

  // ✅ Wrap in transaction to prevent balance desyncs
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employee = await Employee.findById(userId).session(session);
    if (!employee) {
      throw Object.assign(new Error("Employee not found."), { status: 404 });
    }

    // Deduct from wellnessDays directly
    if ((employee.balances.wellnessDays || 0) < totalDays) {
      throw Object.assign(
        new Error(
          `Insufficient Wellness Leave balance. Available: ${employee.balances.wellnessDays || 0}`,
        ),
        { status: 400 },
      );
    }

    // Atomically deduct
    const updatedEmployee = await Employee.findOneAndUpdate(
      { _id: userId, "balances.wellnessDays": { $gte: totalDays } },
      { $inc: { "balances.wellnessDays": -totalDays } },
      { new: true, session },
    );

    if (!updatedEmployee) {
      throw Object.assign(
        new Error("Failed to deduct Wellness Leave balance. Please try again."),
        { status: 400 },
      );
    }

    const newApplication = new WellnessApplication({
      employee: employee._id,
      inclusiveDates,
      totalDays,
      reason,
      overallStatus: "PENDING",
    });

    await newApplication.save({ session });

    const approvalSteps = await Promise.all(
      finalApprovers.map((approverId, index) =>
        ApprovalStep.create(
          [
            {
              level: index + 1,
              approver: approverId,
              status: "PENDING",
              wellnessApplication: newApplication._id,
            },
          ],
          { session },
        ).then((res) => res[0]),
      ),
    );

    newApplication.approvals = approvalSteps.map((step) => step._id);
    await newApplication.save({ session });

    await session.commitTransaction();
    session.endSession();

    const populatedApp = await populateApplicationById(newApplication._id);

    // Notify first approver
    const firstStep = approvalSteps.find((s) => s.level === 1);
    if (firstStep) {
      await NotificationService.createNotification({
        recipient: firstStep.approver,
        actor: employee._id,
        type: "WELLNESS_APPROVAL_REQUIRED",
        title: "New Wellness Leave Request",
        message: `${employee.firstName} ${employee.lastName} submitted a Wellness Leave request for ${totalDays} day(s).`,
        link: `/app/wellness-approvals/${populatedApp._id}`,
        priority: "HIGH",
      });
    }

    return populatedApp;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

const getAllWellnessApplicationsService = async (
  { status, from, to, search, employeeId },
  page = 1,
  limit = 10,
) => {
  const query = {};

  if (status) query.overallStatus = status;
  if (employeeId) query.employee = employeeId;
  if (from || to) {
    query.inclusiveDates = {};
    if (from) query.inclusiveDates.$gte = new Date(from);
    if (to) query.inclusiveDates.$lte = new Date(to);
  }

  if (search) {
    const employeeIds = await Employee.find({
      $or: [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();

    query.employee = { $in: employeeIds.map((e) => e._id) };
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.max(1, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  // ✅ Fetch applications with deep populated approvals mapping to frontend requirements
  const applications = await WellnessApplication.find(query)
    .populate("employee", "firstName lastName position email employeeId")
    .populate({
      path: "approvals",
      populate: {
        path: "approver",
        select: "firstName lastName position email",
      },
      options: { sort: { level: 1 } },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  const total = await WellnessApplication.countDocuments(query);

  // ✅ Extract base query without status to calculate overall counts for tabs
  const baseQuery = { ...query };
  delete baseQuery.overallStatus;

  // Execute Status Counts aggregation
  const statusCountsAgg = await WellnessApplication.aggregate([
    { $match: baseQuery },
    {
      $group: {
        _id: "$overallStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  const totalAll = await WellnessApplication.countDocuments(baseQuery);

  const statusCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
    total: totalAll,
  };

  statusCountsAgg.forEach((s) => {
    if (s._id) statusCounts[s._id] = s.count;
  });

  return {
    data: applications,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
    statusCounts,
  };
};

const getWellnessApplicationsByEmployeeService = async (
  employeeId,
  page = 1,
  limit = 20,
  filters = {},
) => {
  if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) {
    const err = new Error("Invalid Employee ID");
    err.status = 400;
    throw err;
  }

  const employeeObjectId = new mongoose.Types.ObjectId(employeeId);
  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(parseInt(limit) || 20, 100);
  const skip = (page - 1) * limit;

  const pipeline = [{ $match: { employee: employeeObjectId } }];

  // 1. Status Filter
  if (filters.status) {
    pipeline.push({
      $match: { overallStatus: String(filters.status).toUpperCase() },
    });
  }

  // 2. Date Range Filter
  if (filters.from && filters.to) {
    pipeline.push({
      $match: {
        createdAt: {
          $gte: new Date(filters.from),
          $lte: new Date(filters.to),
        },
      },
    });
  }

  // 3. Search Filter
  if (filters.search) {
    pipeline.push({
      $match: {
        reason: { $regex: filters.search, $options: "i" },
      },
    });
  }

  // 4. Lookup Approvals
  pipeline.push({
    $lookup: {
      from: "approvalsteps",
      let: { approvalIds: "$approvals" },
      pipeline: [
        { $match: { $expr: { $in: ["$_id", "$$approvalIds"] } } },
        {
          $lookup: {
            from: "employees",
            localField: "approver",
            foreignField: "_id",
            as: "approver",
          },
        },
        { $unwind: { path: "$approver", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            level: 1,
            status: 1,
            reviewedAt: 1,
            remarks: 1,
            approver: {
              _id: "$approver._id",
              firstName: "$approver.firstName",
              lastName: "$approver.lastName",
              position: "$approver.position",
            },
          },
        },
        { $sort: { level: 1 } },
      ],
      as: "approvals",
    },
  });

  // 5. Lookup Employee Details
  pipeline.push({
    $lookup: {
      from: "employees",
      localField: "employee",
      foreignField: "_id",
      as: "employeeDoc",
    },
  });

  pipeline.push({
    $unwind: { path: "$employeeDoc", preserveNullAndEmptyArrays: true },
  });

  pipeline.push({
    $addFields: {
      employee: {
        _id: "$employeeDoc._id",
        firstName: "$employeeDoc.firstName",
        lastName: "$employeeDoc.lastName",
        position: "$employeeDoc.position",
      },
    },
  });

  pipeline.push({ $project: { employeeDoc: 0 } });

  // 6. Sort, Skip, Limit
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  // Execute main query
  let applications = await WellnessApplication.aggregate(pipeline);

  // Execute Total Count query
  const countPipeline = [
    { $match: { employee: employeeObjectId } },
    ...pipeline.filter(
      (stage) =>
        !("$skip" in stage) && !("$limit" in stage) && !("$sort" in stage),
    ),
    { $count: "total" },
  ];

  const totalResult = await WellnessApplication.aggregate(countPipeline);
  const total = totalResult[0]?.total || 0;

  // Execute Status Counts aggregation
  const statusCountsAgg = await WellnessApplication.aggregate([
    { $match: { employee: employeeObjectId } },
    {
      $group: {
        _id: "$overallStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  const totalAll = await WellnessApplication.countDocuments({
    employee: employeeObjectId,
  });

  const statusCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
    total: totalAll,
  };

  statusCountsAgg.forEach((s) => {
    if (s._id) statusCounts[s._id] = s.count;
  });

  return {
    data: applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    statusCounts,
  };
};

const cancelWellnessApplicationService = async ({
  userId,
  applicationId,
  req, // ✅ Passed for future Audit Logging
}) => {
  // ✅ Wrap in transaction to prevent balance desyncs
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const application = await WellnessApplication.findOne({
      _id: applicationId,
      employee: userId,
    }).session(session);

    if (!application) {
      throw Object.assign(new Error("Application not found or unauthorized."), {
        status: 404,
      });
    }

    if (application.overallStatus !== "PENDING") {
      throw Object.assign(
        new Error(`Cannot cancel a ${application.overallStatus} application.`),
        { status: 400 },
      );
    }

    // Restore balance safely within the session
    await Employee.updateOne(
      { _id: userId },
      { $inc: { "balances.wellnessDays": application.totalDays } },
      { session },
    );

    application.overallStatus = "CANCELLED";
    await application.save({ session });

    // Ensure only PENDING steps are cancelled
    await cancelApprovalSteps(
      {
        applicationId,
        approvalIds: application.approvals,
        reason: "Auto-cancelled: The employee cancelled this request.",
        afterLevel: 0,
      },
      session,
    );

    await session.commitTransaction();
    session.endSession();

    const employee = await Employee.findById(userId);
    await notifyApproversOfCancellation({
      application,
      employee,
      approvalIds: application.approvals,
    });

    return populateApplicationById(applicationId);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

module.exports = {
  addWellnessApplicationService,
  getAllWellnessApplicationsService,
  getWellnessApplicationsByEmployeeService,
  cancelWellnessApplicationService,
  populateApplicationById,
};
