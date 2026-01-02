const CtoApplication = require("../models/ctoApplicationModel");
const ApprovalStep = require("../models/approvalStepModel");
const Employee = require("../models/employeeModel");
const CtoCredit = require("../models/ctoCreditModel");
const mongoose = require("mongoose");

const addCtoApplicationService = async ({
  userId,
  requestedHours,
  reason,
  approver1,
  approver2,
  approver3,
  memos, // array of { memoId, uploadedMemo, appliedHours }
  inclusiveDates,
}) => {
  // Validations
  if (!requestedHours || !reason || !memos?.length || !inclusiveDates?.length) {
    const err = new Error(
      "Requested hours, reason, memos, and inclusive dates are required."
    );
    err.status = 400;
    throw err;
  }

  if (!approver1 || !approver2 || !approver3) {
    const err = new Error("All 3 approvers (Level 1, 2, and 3) are required.");
    err.status = 400;
    throw err;
  }

  // Employee check & balance
  const employee = await Employee.findById(userId);
  if (!employee) {
    const err = new Error("Employee not found.");
    err.status = 404;
    throw err;
  }
  if (employee.balances.ctoHours < requestedHours) {
    const err = new Error("Insufficient CTO hours balance.");
    err.status = 400;
    throw err;
  }

  // Validate memos and reserve applied hours
  const memoEntries = [];
  for (const memoEntry of memos) {
    const { memoId, uploadedMemo, appliedHours: hoursToApply } = memoEntry;

    if (!memoId || !uploadedMemo || !hoursToApply) {
      const err = new Error(
        "Each memo must have memoId, uploadedMemo, and appliedHours."
      );
      err.status = 400;
      throw err;
    }

    const memo = await CtoCredit.findById(memoId);
    if (!memo) {
      const err = new Error(`CTO memo not found: ${memoId}`);
      err.status = 404;
      throw err;
    }

    const remainingHours = memo.totalHours - (memo.appliedHours || 0);
    if (hoursToApply > remainingHours) {
      const err = new Error(
        `Cannot apply ${hoursToApply} hours. Remaining hours for memo ${memo.memoNo} is ${remainingHours}.`
      );
      err.status = 400;
      throw err;
    }

    // Temporarily reserve applied hours
    memo.appliedHours = (memo.appliedHours || 0) + hoursToApply;
    await memo.save();

    memoEntries.push({ memoId, uploadedMemo, appliedHours: hoursToApply });
  }

  // Validate approvers
  const approvers = [approver1, approver2, approver3];
  for (const approverId of approvers) {
    const approver = await Employee.findById(approverId);
    if (!approver) {
      const err = new Error(`Approver not found: ${approverId}`);
      err.status = 404;
      throw err;
    }
  }

  // Create CTO application
  const newCtoApplication = new CtoApplication({
    employee: userId,
    requestedHours,
    reason,
    memo: memoEntries, // store array of { memoId, uploadedMemo, appliedHours }
    inclusiveDates,
    overallStatus: "PENDING",
  });

  await newCtoApplication.save();

  // Create approval steps
  const approvalSteps = await Promise.all(
    approvers.map(async (approverId, index) => {
      return await ApprovalStep.create({
        level: index + 1,
        approver: approverId,
        status: "PENDING",
        ctoApplication: newCtoApplication._id,
      });
    })
  );

  newCtoApplication.approvals = approvalSteps.map((step) => step._id);
  await newCtoApplication.save();

  // Populate for return
  const populatedApp = await CtoApplication.findById(newCtoApplication._id)
    .populate({
      path: "approvals",
      populate: { path: "approver", select: "firstName lastName position" },
    })
    .populate("employee", "firstName lastName position")
    .populate("memo.memoId", "memoNo uploadedMemo totalHours appliedHours");

  return populatedApp;
};
const getAllCtoApplicationsService = async (
  filters = {},
  page = 1,
  limit = 20
) => {
  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(parseInt(limit) || 20, 100); // max 100

  const query = {};

  // Apply filters
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

  console.log(filters.search);
  // ---- DEBUG LOGS ----
  console.log("Filters received:", filters);
  // --------------------

  const skip = (page - 1) * limit;

  const [applications, total] = await Promise.all([
    CtoApplication.find(query)
      .select(
        "requestedHours reason overallStatus approvals employee inclusiveDates memo createdAt"
      )
      .populate({
        path: "approvals",
        populate: { path: "approver", select: "firstName lastName position" },
      })
      .populate("employee", "firstName lastName position")
      .populate("memo.memoId", "memoNo uploadedMemo totalHours appliedHours")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    CtoApplication.countDocuments(query),
  ]);

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

  // Build aggregation pipeline
  const pipeline = [{ $match: { employee: employeeObjectId } }];

  // Apply status filter
  if (filters.status) {
    pipeline.push({ $match: { overallStatus: filters.status } });
  }

  // Apply date range filter
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

  // Apply search filter on memoNo
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

  // Populate approvals info
  pipeline.push({
    $lookup: {
      from: "approvalsteps",
      localField: "approvals",
      foreignField: "_id",
      as: "approvals",
    },
  });

  // Sort, skip, limit
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  // Execute aggregation
  let applications = await CtoApplication.aggregate(pipeline);

  // Map memoDetails back to memo.memoId to keep the same structure
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

  // Get total count (without skip/limit)
  const countPipeline = [
    ...pipeline.filter((stage) => !("$skip" in stage || "$limit" in stage)),
    {
      $count: "total",
    },
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
