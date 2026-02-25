// services/ctoApplication.service.js
const CtoApplication = require("../models/ctoApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const Employee = require("../models/employeeModel");
const CtoCredit = require("../models/ctoCreditModel");
const mongoose = require("mongoose");

const sendEmail = require("../utils/sendEmail");

// ✅ NEW: email notification toggles (flags Map doc)
const EMAIL_KEYS = require("../utils/emailNotificationKeys");
const { isEmailEnabled } = require("../utils/emailNotificationSettings");

// ✅ UPDATED: use centralized templates (single file)
const { ctoApprovalEmail } = require("../utils/emailTemplates");

/* =========================
   Helpers
========================= */
const AUTO_CANCEL_REMARK_REJECT =
  "Auto-cancelled: A previous approver rejected this request.";

const AUTO_CANCEL_REMARK_EMPLOYEE =
  "Auto-cancelled: The employee cancelled this request.";

// ✅ Optional: fail-safe wrapper so creating application won't fail if email fails
async function safeSendEmail(to, subject, html) {
  try {
    await sendEmail(to, subject, html);
  } catch (e) {
    console.error("[EMAIL] failed but continuing:", {
      to,
      subject,
      message: e?.message,
      code: e?.code,
      response: e?.response,
    });
  }
}

async function canSend(key) {
  return await isEmailEnabled(key);
}

const populateApplicationById = async (applicationId) => {
  const app = await CtoApplication.findById(applicationId)
    .populate("employee", "firstName lastName position email employeeId")
    .populate({
      path: "approvals",
      populate: {
        path: "approver",
        select: "firstName lastName position email",
      },
      options: { sort: { level: 1 } },
    })
    .populate("memo.memoId", "memoNo uploadedMemo duration totalHours");

  // normalize memoId.uploadedMemo (if present)
  if (app?.memo && Array.isArray(app.memo)) {
    app.memo.forEach((m) => {
      if (m?.memoId?.uploadedMemo) {
        m.memoId.uploadedMemo = m.memoId.uploadedMemo.replace(/\\/g, "/");
      }
    });
  }

  return app;
};

/**
 * Cancels all PENDING approval steps of a CTO application.
 * Optionally cancels only those AFTER a certain level.
 */
const cancelApprovalSteps = async ({
  applicationId,
  approvalIds,
  reason,
  afterLevel = 0,
}) => {
  await ApprovalStep.updateMany(
    {
      _id: { $in: approvalIds },
      status: "PENDING",
      level: { $gt: afterLevel },
      ctoApplication: applicationId,
    },
    {
      $set: {
        status: "CANCELLED",
        remarks: reason,
        reviewedAt: new Date(),
      },
    },
  );
};

/**
 * Restores reserved hours back to remaining hours for employee credits used.
 */
const restoreMemoHours = async ({ employeeId, memoItems }) => {
  if (!memoItems?.length) return;

  for (const m of memoItems) {
    if (!m?.memoId || !m?.appliedHours) continue;

    await CtoCredit.updateOne(
      { _id: m.memoId, "employees.employee": employeeId },
      {
        $inc: {
          "employees.$.reservedHours": -Number(m.appliedHours),
          "employees.$.remainingHours": Number(m.appliedHours),
        },
      },
    );
  }
};

/* =========================
   Services
========================= */
const addCtoApplicationService = async ({
  userId,
  requestedHours,
  reason,
  approvers,
  inclusiveDates,
  memos, // [{ memoId, appliedHours }]
}) => {
  // 1️⃣ Basic validations
  if (!requestedHours || !reason || !inclusiveDates?.length)
    throw Object.assign(
      new Error("Requested hours, reason, and inclusive dates are required."),
      { status: 400 },
    );

  if (!approvers || approvers.length !== 3 || approvers.some((a) => !a))
    throw Object.assign(
      new Error("Three approvers (Level 1, 2, 3) are required."),
      { status: 400 },
    );

  if (!memos || !Array.isArray(memos) || !memos.length)
    throw Object.assign(
      new Error("At least one memo with applied hours must be provided."),
      { status: 400 },
    );

  // 2️⃣ Check employee exists
  const employee = await Employee.findById(userId);
  if (!employee)
    throw Object.assign(new Error("Employee not found."), { status: 404 });

  // 3️⃣ Fetch all memos from DB and validate
  const memoIds = memos.map((m) => m.memoId);
  const credits = await CtoCredit.find({
    _id: { $in: memoIds },
    "employees.employee": employee._id,
    status: "CREDITED",
  });

  if (credits.length !== memoIds.length)
    throw Object.assign(new Error("Some memos are invalid or not credited."), {
      status: 400,
    });

  // 4️⃣ Validate hours and update reserved
  let totalAppliedHours = 0;
  const memoUsage = [];

  for (const input of memos) {
    const credit = credits.find(
      (c) => c._id.toString() === input.memoId.toString(),
    );

    const empCredit = credit.employees.find(
      (e) => e.employee.toString() === employee._id.toString(),
    );

    const availableHours = empCredit.remainingHours || 0;

    if (input.appliedHours <= 0 || input.appliedHours > availableHours)
      throw Object.assign(
        new Error(
          `Invalid applied hours for memo ${credit.memoNo}. Available: ${availableHours}`,
        ),
        { status: 400 },
      );

    // Update reservedHours and remainingHours
    empCredit.reservedHours =
      (empCredit.reservedHours || 0) + input.appliedHours;
    empCredit.remainingHours = empCredit.remainingHours - input.appliedHours;
    empCredit.status = empCredit.status || "ACTIVE";

    await CtoCredit.updateOne(
      { _id: credit._id, "employees.employee": employee._id },
      { $set: { "employees.$": empCredit } },
    );

    memoUsage.push({
      memoId: credit._id,
      uploadedMemo: (credit.uploadedMemo || "").replace(/\\/g, "/"),
      appliedHours: input.appliedHours,
    });

    totalAppliedHours += input.appliedHours;
  }

  if (totalAppliedHours !== requestedHours)
    throw Object.assign(
      new Error(
        `Sum of applied hours (${totalAppliedHours}) does not match requested hours (${requestedHours})`,
      ),
      { status: 400 },
    );

  // 5️⃣ Create CTO application
  const newApplication = new CtoApplication({
    employee: employee._id,
    requestedHours,
    reason,
    inclusiveDates,
    memo: memoUsage,
    overallStatus: "PENDING",
  });

  await newApplication.save();

  // 6️⃣ Create approval steps
  const approvalSteps = await Promise.all(
    approvers.map((approverId, index) =>
      ApprovalStep.create({
        level: index + 1,
        approver: approverId,
        status: "PENDING",
        ctoApplication: newApplication._id,
      }),
    ),
  );

  newApplication.approvals = approvalSteps.map((step) => step._id);
  await newApplication.save();

  // 7️⃣ Populate for frontend
  const populatedApp = await populateApplicationById(newApplication._id);

  // 8️⃣ Notify FIRST approver only (✅ template + ✅ toggle)
  try {
    const firstApproval = approvalSteps.find((a) => a.level === 1);
    const approverUser = await Employee.findById(firstApproval.approver)
      .select("firstName lastName email")
      .lean();

    const applicant = employee;

    const enabled = await canSend(EMAIL_KEYS.CTO_APPROVAL);

    if (approverUser?.email && enabled) {
      const tpl = ctoApprovalEmail({
        approverName: `${approverUser.firstName} ${approverUser.lastName}`,
        employeeName: `${applicant.firstName} ${applicant.lastName}`,
        requestedHours,
        reason,
        level: 1,
        link: `${process.env.FRONTEND_URL}/app/cto-approvals/${newApplication._id}`,
        brandName: "CTO Management System",
      });

      await safeSendEmail(approverUser.email, tpl.subject, tpl.html);
    } else if (approverUser?.email && !enabled) {
      console.log(
        "[EMAIL] skipped (disabled):",
        EMAIL_KEYS.CTO_APPROVAL,
        "to:",
        approverUser.email,
      );
    }
  } catch (err) {
    console.error("Failed to send CTO approval email:", err?.message || err);
  }

  return populatedApp;
};

const cancelCtoApplicationService = async ({ userId, applicationId }) => {
  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    throw Object.assign(new Error("Invalid application ID."), { status: 400 });
  }

  const app = await CtoApplication.findById(applicationId);
  if (!app)
    throw Object.assign(new Error("Application not found."), { status: 404 });

  // Only owner can cancel (adjust if you want admin override)
  if (String(app.employee) !== String(userId)) {
    throw Object.assign(
      new Error("Not authorized to cancel this application."),
      {
        status: 403,
      },
    );
  }

  // Only pending can be cancelled
  if (app.overallStatus !== "PENDING") {
    throw Object.assign(
      new Error("Only PENDING applications can be cancelled."),
      { status: 400 },
    );
  }

  // 1) Set application to CANCELLED
  app.overallStatus = "CANCELLED";
  await app.save();

  // 2) Cancel all pending approval steps + auto remarks
  await cancelApprovalSteps({
    applicationId: app._id,
    approvalIds: app.approvals || [],
    reason: AUTO_CANCEL_REMARK_EMPLOYEE,
    afterLevel: 0,
  });

  // 3) Restore memo hours (reserved -> remaining)
  await restoreMemoHours({
    employeeId: app.employee,
    memoItems: app.memo || [],
  });

  // 4) Return populated
  return populateApplicationById(app._id);
};

const getAllCtoApplicationsService = async (
  filters = {},
  page = 1,
  limit = 20,
) => {
  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(parseInt(limit) || 20, 100);
  const skip = (page - 1) * limit;

  // -----------------------------
  // FILTERED QUERY (for table)
  // -----------------------------
  const query = {};

  if (filters.employeeId) query.employee = filters.employeeId;
  if (filters.status) query.overallStatus = filters.status;
  if (filters.from && filters.to) {
    query.createdAt = {
      $gte: new Date(filters.from),
      $lte: new Date(filters.to),
    };
  }

  // NOTE: This search won't match memoNo reliably because memoId is an ObjectId.
  // Kept as-is (per your existing code).
  if (filters.search) {
    query["memo.memoId.memoNo"] = {
      $regex: filters.search,
      $options: "i",
    };
  }

  // -----------------------------
  // FETCH DATA + PAGINATION TOTAL
  // -----------------------------
  const [applications, total] = await Promise.all([
    CtoApplication.find(query)
      .select(
        "requestedHours reason overallStatus approvals employee inclusiveDates memo createdAt",
      )
      .populate({
        path: "approvals",
        options: { sort: { level: 1 } },
        populate: {
          path: "approver",
          select: "firstName lastName position _id",
        },
      })
      .populate("employee", "firstName lastName position _id")
      .populate("memo.memoId", "memoNo uploadedMemo totalHours appliedHours")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CtoApplication.countDocuments(query),
  ]);

  // -----------------------------
  // TRANSFORM APPROVERS
  // -----------------------------
  const transformed = applications.map((app) => {
    const approvals = app.approvals || [];
    return {
      ...app,
      approver1: approvals[0]?.approver || null,
      approver2: approvals[1]?.approver || null,
      approver3: approvals[2]?.approver || null,
    };
  });

  // -----------------------------
  // GLOBAL STATUS COUNTS (NO FILTERS)
  // -----------------------------
  const statusAgg = await CtoApplication.aggregate([
    {
      $group: {
        _id: "$overallStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  const totalAll = await CtoApplication.countDocuments({});

  const statusCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
    total: totalAll,
  };

  statusAgg.forEach((s) => {
    if (s._id) statusCounts[s._id] = s.count;
  });

  return {
    data: transformed,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    statusCounts,
  };
};

const getCtoApplicationsByEmployeeService = async (
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

  if (filters.status) {
    pipeline.push({
      $match: { overallStatus: String(filters.status).toUpperCase() },
    });
  }

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

  pipeline.push({
    $lookup: {
      from: "ctocredits",
      let: { memoIds: "$memo.memoId", appEmployeeId: "$employee" },
      pipeline: [
        { $match: { $expr: { $in: ["$_id", "$$memoIds"] } } },
        {
          $project: {
            dateApproved: 1,
            createdAt: 1,
            memoNo: 1,
            status: 1,
            employees: 1,
            uploadedMemo: 1,
            duration: 1,
            totalHours: 1,
          },
        },
        {
          $addFields: {
            employee: {
              $first: {
                $filter: {
                  input: "$employees",
                  as: "emp",
                  cond: { $eq: ["$$emp.employee", "$$appEmployeeId"] },
                },
              },
            },
          },
        },
        { $project: { employees: 0 } },
      ],
      as: "memoDetails",
    },
  });

  if (filters.search) {
    pipeline.push({
      $match: {
        "memoDetails.memoNo": { $regex: filters.search, $options: "i" },
      },
    });
  }

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

  // ✅ Include employee name + position
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

  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  let applications = await CtoApplication.aggregate(pipeline);

  applications = applications.map((app) => {
    if (app.memo && Array.isArray(app.memo)) {
      const memoMap = (app.memoDetails || []).reduce((acc, md) => {
        if (md && md._id) acc[md._id.toString()] = md;
        return acc;
      }, {});
      app.memo = app.memo.map((m) => {
        const memoIdStr = m?.memoId ? m.memoId.toString() : null;
        return {
          ...m,
          memoId: memoMap[memoIdStr] || null,
        };
      });
    }
    delete app.memoDetails;
    return app;
  });

  const countPipeline = [
    { $match: { employee: employeeObjectId } },
    ...pipeline.filter(
      (stage) =>
        !("$skip" in stage) && !("$limit" in stage) && !("$sort" in stage),
    ),
    { $count: "total" },
  ];
  const totalResult = await CtoApplication.aggregate(countPipeline);
  const total = totalResult[0]?.total || 0;

  const statusCountsAgg = await CtoApplication.aggregate([
    { $match: { employee: employeeObjectId } },
    {
      $group: {
        _id: "$overallStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  const totalAll = await CtoApplication.countDocuments({
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

module.exports = {
  addCtoApplicationService,
  cancelCtoApplicationService,
  getAllCtoApplicationsService,
  getCtoApplicationsByEmployeeService,
};
