const CtoApplication = require("../models/ctoApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const Employee = require("../models/employeeModel");
const CtoCredit = require("../models/ctoCreditModel");
const mongoose = require("mongoose");

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
      { status: 400 }
    );

  if (!approvers || approvers.length !== 3 || approvers.some((a) => !a))
    throw Object.assign(
      new Error("Three approvers (Level 1,2,3) are required."),
      { status: 400 }
    );

  if (!memos || !Array.isArray(memos) || !memos.length)
    throw Object.assign(
      new Error("At least one memo with applied hours must be provided."),
      { status: 400 }
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
      (c) => c._id.toString() === input.memoId.toString()
    );
    const empCredit = credit.employees.find(
      (e) => e.employee.toString() === employee._id.toString()
    );

    // ✅ Fix: use only remainingHours
    const availableHours = empCredit.remainingHours || 0;

    if (input.appliedHours <= 0 || input.appliedHours > availableHours)
      throw Object.assign(
        new Error(
          `Invalid applied hours for memo ${credit.memoNo}. Available: ${availableHours}`
        ),
        { status: 400 }
      );

    // Update reservedHours and remainingHours
    empCredit.reservedHours =
      (empCredit.reservedHours || 0) + input.appliedHours;
    empCredit.remainingHours = empCredit.remainingHours - input.appliedHours;
    empCredit.status = empCredit.status || "ACTIVE";

    await CtoCredit.updateOne(
      { _id: credit._id, "employees.employee": employee._id },
      { $set: { "employees.$": empCredit } }
    );

    memoUsage.push({
      memoId: credit._id,
      employee: employee._id,
      hoursReserved: input.appliedHours,
      uploadedMemo: credit.uploadedMemo.replace(/\\/g, "/"),
      memoNo: credit.memoNo,
      totalHours:
        empCredit.usedHours +
        empCredit.reservedHours +
        empCredit.remainingHours,
    });

    totalAppliedHours += input.appliedHours;
  }

  if (totalAppliedHours !== requestedHours)
    throw Object.assign(
      new Error(
        `Sum of applied hours (${totalAppliedHours}) does not match requested hours (${requestedHours})`
      ),
      { status: 400 }
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
      })
    )
  );

  newApplication.approvals = approvalSteps.map((step) => step._id);
  await newApplication.save();

  // 7️⃣ Populate for frontend
  const populatedApp = await CtoApplication.findById(newApplication._id)
    .populate("employee", "firstName lastName position")
    .populate({
      path: "approvals",
      populate: { path: "approver", select: "firstName lastName" },
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

  return populatedApp;
};

const getAllCtoApplicationsService = async (
  filters = {},
  page = 1,
  limit = 20
) => {
  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(parseInt(limit) || 20, 100);

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
    query["memo.memoId.memoNo"] = { $regex: filters.search, $options: "i" };
  }

  const skip = (page - 1) * limit;

  const [applications, total] = await Promise.all([
    CtoApplication.find(query)
      .select(
        "requestedHours reason overallStatus approvals employee inclusiveDates memo createdAt"
      )
      .populate({
        path: "approvals",
        options: { sort: { level: 1 } }, // ensure Level 1 → Level 3 order
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

  // Transform approvals into approver1, approver2, approver3 for easier frontend consumption
  const transformed = applications.map((app) => {
    const sortedApprovals = app.approvals || [];
    return {
      ...app,
      approver1: sortedApprovals[0]?.approver || null,
      approver2: sortedApprovals[1]?.approver || null,
      approver3: sortedApprovals[2]?.approver || null,
    };
  });

  return {
    data: transformed,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getCtoApplicationsByEmployeeService = async (
  employeeId,
  page = 1,
  limit = 20,
  filters = {}
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

  if (filters.status)
    pipeline.push({ $match: { overallStatus: filters.status } });
  if (filters.from && filters.to) {
    pipeline.push({
      $match: {
        createdAt: { $gte: new Date(filters.from), $lte: new Date(filters.to) },
      },
    });
  }

  // Lookup memo info
  pipeline.push({
    $lookup: {
      from: "ctocredits",
      localField: "memo.memoId",
      foreignField: "_id",
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

  // Populate employee info
  pipeline.push({
    $lookup: {
      from: "employees",
      localField: "employee",
      foreignField: "_id",
      as: "employee",
    },
  });
  pipeline.push({
    $unwind: { path: "$employee", preserveNullAndEmptyArrays: true },
  });

  // Populate approvals and only select firstName & lastName of approver
  pipeline.push({
    $lookup: {
      from: "approvalsteps",
      localField: "approvals",
      foreignField: "_id",
      as: "approvals",
    },
  });

  // Nested lookup for approver info (only firstName & lastName)
  pipeline.push({
    $lookup: {
      from: "employees",
      localField: "approvals.approver",
      foreignField: "_id",
      as: "approverDetails",
    },
  });

  // Map approverDetails into approvals array
  pipeline.push({
    $addFields: {
      approvals: {
        $map: {
          input: "$approvals",
          as: "appr",
          in: {
            level: "$$appr.level",
            status: "$$appr.status",
            approver: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$approverDetails",
                    cond: { $eq: ["$$this._id", "$$appr.approver"] },
                  },
                },
                0,
              ],
            },
          },
        },
      },
    },
  });

  // Only keep firstName & lastName in approver
  pipeline.push({
    $addFields: {
      approvals: {
        $map: {
          input: "$approvals",
          as: "a",
          in: {
            level: "$$a.level",
            status: "$$a.status",
            approver: {
              firstName: "$$a.approver.firstName",
              lastName: "$$a.approver.lastName",
              position: "$$a.approver.position",
              _id: "$$a.approver._id",
            },
          },
        },
      },
    },
  });

  // Sort, skip, limit
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  let applications = await CtoApplication.aggregate(pipeline);

  // Map memoDetails back to memo.memoId
  applications = applications.map((app) => {
    if (app.memo && Array.isArray(app.memo)) {
      app.memo = app.memo.map((m, i) => ({
        ...m,
        memoId: app.memoDetails[i] || null,
      }));
    }
    delete app.memoDetails;
    return app;
  });

  // Total count
  const countPipeline = [
    { $match: { employee: employeeObjectId } },
    ...pipeline.filter(
      (stage) => !("$skip" in stage || "$limit" in stage || "$sort" in stage)
    ),
    { $count: "total" },
  ];
  const totalResult = await CtoApplication.aggregate(countPipeline);
  const total = totalResult[0]?.total || 0;

  return {
    data: applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

module.exports = {
  addCtoApplicationService,
  getAllCtoApplicationsService,
  getCtoApplicationsByEmployeeService,
};
