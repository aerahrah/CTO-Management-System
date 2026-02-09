const CtoApplication = require("../models/ctoApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const Employee = require("../models/employeeModel");
const CtoCredit = require("../models/ctoCreditModel");
const mongoose = require("mongoose");
const sendEmail = require("../utils/sendEmail");
const ctoApprovalEmail = require("../emails/ctoApprovalRequest");

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
      uploadedMemo: credit.uploadedMemo.replace(/\\/g, "/"),
      memoNo: credit.memoNo,
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
  const populatedApp = await CtoApplication.findById(newApplication._id)
    .populate("employee", "firstName lastName position email")
    .populate({
      path: "approvals",
      populate: {
        path: "approver",
        select: "firstName lastName position email",
      },
    })
    .populate("memo.memoId", "memoNo uploadedMemo duration");

  // Fix uploadedMemo paths
  if (populatedApp.memo && Array.isArray(populatedApp.memo)) {
    populatedApp.memo.forEach((m) => {
      if (m.memoId?.uploadedMemo) {
        m.memoId.uploadedMemo = m.memoId.uploadedMemo.replace(/\\/g, "/");
      }
    });
  }

  // 8️⃣ Notify FIRST approver only (best practice)
  try {
    const firstApproval = approvalSteps.find((a) => a.level === 1);
    const approverUser = await Employee.findById(firstApproval.approver);
    const applicant = employee;

    console.log(approverUser.email);
    if (approverUser?.email) {
      await sendEmail(
        approverUser.email, // string
        "CTO Approval Request", // subject
        ctoApprovalEmail({
          // html content
          approverName: `${approverUser.firstName} ${approverUser.lastName}`,
          employeeName: `${applicant.firstName} ${applicant.lastName}`,
          requestedHours,
          reason,
          level: 1,
          link: `${process.env.FRONTEND_URL}/app/cto/approvals/${newApplication._id}`,
        }),
      );
    }
  } catch (err) {
    console.error("Failed to send CTO approval email:", err);
  }

  return populatedApp;
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

  // Global total (ALL applications)
  const totalAll = await CtoApplication.countDocuments({});

  const statusCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    total: totalAll,
  };

  statusAgg.forEach((s) => {
    if (s._id) statusCounts[s._id] = s.count;
  });

  // -----------------------------
  // RESPONSE
  // -----------------------------
  return {
    data: transformed,
    pagination: {
      page,
      limit,
      total, // filtered total (table)
      totalPages: Math.ceil(total / limit),
    },
    statusCounts, // global counts (dashboard)
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

  // ---------- Build pipeline for the DATA (this one respects filters/search/pagination) ----------
  const pipeline = [{ $match: { employee: employeeObjectId } }];

  // Apply status filter (if provided)
  if (filters.status) {
    pipeline.push({
      $match: { overallStatus: filters.status.toUpperCase() },
    });
  }

  // Apply date range filter (if provided)
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

  // Lookup memo details (we keep this even if search is not present because we use memoDetails later)
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

  // Apply search on memoNo (if provided)
  if (filters.search) {
    pipeline.push({
      $match: {
        "memoDetails.memoNo": { $regex: filters.search, $options: "i" },
      },
    });
  }

  // Lookup approvals with approver info
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
            approver: {
              _id: "$approver._id",
              firstName: "$approver.firstName",
              lastName: "$approver.lastName",
              position: "$approver.position",
            },
            remarks: 1,
          },
        },
      ],
      as: "approvals",
    },
  });

  // Sort and paginate for data
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  // ---------- Run aggregation to fetch paginated applications ----------
  let applications = await CtoApplication.aggregate(pipeline);

  // Map memoDetails back to memo memoId (match by id to be safe)
  applications = applications.map((app) => {
    if (app.memo && Array.isArray(app.memo)) {
      // make a lookup map for memoDetails by id string
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
    // remove the helper field
    delete app.memoDetails;
    return app;
  });

  // ---------- Total count for pagination (RESPECTS filters/search) ----------
  // Build countPipeline by removing skip/limit/sort from the data pipeline
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

  // ---------- Status counts (IGNORES filters/search/limit) ----------
  // Only filter by employee so status counts are global for the employee
  const statusCountsAgg = await CtoApplication.aggregate([
    { $match: { employee: employeeObjectId } },
    {
      $group: {
        _id: "$overallStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  // Get total across all statuses (not limited/paginated/filtered)
  // Using countDocuments is efficient and straightforward
  const totalAll = await CtoApplication.countDocuments({
    employee: employeeObjectId,
  });

  const statusCounts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    total: totalAll,
  };

  statusCountsAgg.forEach((s) => {
    if (s._id) statusCounts[s._id] = s.count;
  });

  // ---------- Return payload ----------
  return {
    data: applications,
    pagination: {
      page,
      limit,
      total, // <-- pagination total (RESPECTS filters/search)
      totalPages: Math.ceil(total / limit),
    },
    statusCounts, // <-- global counts (IGNORE filters/search/limit)
  };
};

module.exports = {
  addCtoApplicationService,
  getAllCtoApplicationsService,
  getCtoApplicationsByEmployeeService,
};
