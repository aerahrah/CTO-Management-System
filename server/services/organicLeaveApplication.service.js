// // services/organicLeaveApplication.service.js
// const mongoose = require("mongoose");
// const OrganicLeaveApplication = require("../models/organicLeaveModel");
// const ApprovalStep = require("../models/approvalStepModel");
// const Employee = require("../models/employeeModel");
// const CtoCredit = require("../models/ctoCreditModel");
// const { resolveApproversFromRoute } = require("./approvalRoute.service");
// const sendEmail = require("../utils/sendEmail");
// const NotificationService = require("./notificationService");

// const EMAIL_KEYS = require("../utils/emailNotificationKeys");
// const { isEmailEnabled } = require("../utils/emailNotificationSettings");
// const { ctoApprovalEmail } = require("../utils/emailTemplates");

// /* =========================
//    Helpers
// ========================= */
// const AUTO_CANCEL_REMARK_REJECT =
//   "Auto-cancelled: A previous approver rejected this request.";

// const AUTO_CANCEL_REMARK_EMPLOYEE =
//   "Auto-cancelled: The employee cancelled this request.";

// function createServiceError(message, statusCode = 400) {
//   const err = new Error(message);
//   err.status = statusCode;
//   err.statusCode = statusCode;
//   return err;
// }

// function assertObjectId(id, label = "ID") {
//   if (!mongoose.isValidObjectId(id)) {
//     throw createServiceError(`Invalid ${label} format.`, 400);
//   }
// }

// function sanitizeSearch(str, limit = 100) {
//   return String(str || "")
//     .replace(/\0/g, "")
//     .trim()
//     .slice(0, limit)
//     .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }

// function sanitizeText(str, limit = 1000) {
//   return String(str || "")
//     .replace(/\0/g, "")
//     .trim()
//     .slice(0, limit);
// }

// function strictNumber(val, fallback = 0) {
//   const parsed = Number(val);
//   return Number.isFinite(parsed) ? parsed : fallback;
// }

// async function safeSendEmail(to, subject, html) {
//   try {
//     await sendEmail(to, subject, html);
//   } catch (e) {
//     console.error("[EMAIL] failed but continuing:", {
//       to,
//       subject,
//       message: e?.message,
//       code: e?.code,
//       response: e?.response,
//     });
//   }
// }

// async function canSend(key) {
//   return await isEmailEnabled(key);
// }

// const populateApplicationById = async (applicationId, session = null) => {
//   assertObjectId(applicationId, "Application ID");

//   const app = await OrganicLeaveApplication.findById(applicationId)
//     .populate("employee", "firstName lastName position email employeeId")
//     .populate({
//       path: "approvals",
//       populate: {
//         path: "approver",
//         select: "firstName lastName position email",
//       },
//       options: { sort: { level: 1 } },
//     })
//     .populate("memo.memoId", "memoNo uploadedMemo duration totalHours")
//     .session(session);

//   // Normalize paths for frontend access
//   if (app?.memo && Array.isArray(app.memo)) {
//     app.memo.forEach((m) => {
//       if (m?.memoId?.uploadedMemo) {
//         m.memoId.uploadedMemo = m.memoId.uploadedMemo.replace(/\\/g, "/");
//       }
//     });
//   }

//   return app;
// };

// const cancelApprovalSteps = async (
//   { applicationId, approvalIds, reason, afterLevel = 0 },
//   session = null,
// ) => {
//   await ApprovalStep.updateMany(
//     {
//       _id: { $in: approvalIds },
//       status: "PENDING",
//       level: { $gt: afterLevel },
//       ctoApplication: applicationId, // Assuming the schema uses ctoApplication as the ref field
//     },
//     {
//       $set: {
//         status: "CANCELLED",
//         remarks: reason,
//         reviewedAt: new Date(),
//       },
//     },
//     { session },
//   );
// };

// const restoreMemoHours = async ({ employeeId, memoItems }, session = null) => {
//   if (!memoItems?.length) return;

//   for (const m of memoItems) {
//     if (!m?.memoId || !m?.appliedHours) continue;

//     const appliedHours = strictNumber(m.appliedHours);
//     if (appliedHours <= 0) continue;

//     await CtoCredit.updateOne(
//       { _id: m.memoId, "employees.employee": employeeId },
//       {
//         $inc: {
//           "employees.$.reservedHours": -appliedHours,
//           "employees.$.remainingHours": appliedHours,
//         },
//       },
//       { session },
//     );
//   }
// };

// async function notifyApproversOfCancellation({
//   application,
//   employee,
//   approvalIds = [],
// }) {
//   if (!approvalIds.length) return;

//   const approvalSteps = await ApprovalStep.find({
//     _id: { $in: approvalIds },
//   }).select("approver level status");

//   const approverIds = [
//     ...new Set(
//       approvalSteps
//         .filter((step) => step?.approver)
//         .map((step) => String(step.approver)),
//     ),
//   ].filter((id) => mongoose.isValidObjectId(id));

//   if (!approverIds.length) return;

//   const fullName = `${employee.firstName} ${employee.lastName}`;

//   await NotificationService.createManyNotifications(
//     approverIds.map((approverId) => ({
//       recipient: approverId,
//       actor: employee._id,
//       type: "ORGANIC_LEAVE_CANCELLED",
//       title: "Leave Application Cancelled",
//       message: `${fullName} cancelled a ${application.leaveType || "leave"} application.`,
//       link: `/app/organic-approvals`,
//       priority: "MEDIUM",
//       metadata: {
//         applicationId: application._id,
//         employeeId: employee._id,
//         extra: {
//           leaveType: application.leaveType,
//           requestedHours: application.requestedHours,
//           inclusiveDates: application.inclusiveDates,
//           overallStatus: application.overallStatus,
//         },
//       },
//     })),
//   );
// }

// /* =========================
//    Services
// ========================= */

// const addOrganicLeaveService = async ({
//   userId,
//   reason,
//   routeId,
//   approvers,
//   inclusiveDates,
//   leaveType,
//   leaveTypeOthersSpecify,
//   leaveDetails,
//   requestedHours,
//   memos,
//   commutation,
// }) => {
//   console.log("[addOrganicLeaveService] START - Payload:", {
//     userId,
//     leaveType,
//     requestedHours,
//     inclusiveDatesCount: inclusiveDates?.length,
//     memosCount: memos?.length,
//     routeId,
//     approvers,
//   });

//   assertObjectId(userId, "User ID");

//   const strictReqHours = strictNumber(requestedHours);
//   const safeReason = sanitizeText(reason, 1000);
//   const safeLeaveType = sanitizeText(leaveType, 100);

//   // 1. Strictly enforce CTO logic (Hours + Memos required)
//   console.log("[addOrganicLeaveService] Validating inputs...");
//   if (strictReqHours <= 0 || !safeLeaveType || !inclusiveDates?.length) {
//     console.error(
//       "[addOrganicLeaveService] Validation Failed - strictReqHours:",
//       strictReqHours,
//       "safeLeaveType:",
//       safeLeaveType,
//       "inclusiveDates:",
//       inclusiveDates,
//     );
//     throw createServiceError(
//       "Requested hours (>0), leave type, and inclusive dates are required.",
//       400,
//     );
//   }

//   if (!memos || !Array.isArray(memos) || !memos.length) {
//     console.error(
//       "[addOrganicLeaveService] Validation Failed - Memos missing or empty",
//     );
//     throw createServiceError(
//       "At least one memo with applied hours must be provided.",
//       400,
//     );
//   }

//   console.log("[addOrganicLeaveService] Resolving Approvers...");
//   let finalApprovers = [];
//   if (routeId) {
//     assertObjectId(routeId, "Route ID");
//     finalApprovers = await resolveApproversFromRoute(routeId);
//     console.log(
//       "[addOrganicLeaveService] Approvers resolved from route:",
//       finalApprovers,
//     );
//   } else if (approvers && Array.isArray(approvers)) {
//     finalApprovers = approvers.filter((id) => mongoose.isValidObjectId(id));
//     console.log(
//       "[addOrganicLeaveService] Approvers resolved from input array:",
//       finalApprovers,
//     );
//   }

//   if (!finalApprovers || finalApprovers.length === 0) {
//     console.error(
//       "[addOrganicLeaveService] Validation Failed - No valid approvers found",
//     );
//     throw createServiceError(
//       "At least one valid approver is required (via route template or custom selection).",
//       400,
//     );
//   }

//   console.log("[addOrganicLeaveService] Sanitizing memos...");
//   const sanitizedMemos = memos.map((m) => {
//     const hours = strictNumber(m.appliedHours);
//     if (hours <= 0) {
//       console.error(
//         "[addOrganicLeaveService] Validation Failed - Memo applied hours <= 0:",
//         m,
//       );
//       throw createServiceError("Applied hours must be a positive number.", 400);
//     }
//     assertObjectId(m.memoId, "Memo ID");
//     return { ...m, appliedHours: hours };
//   });

//   // Start Transaction
//   console.log("[addOrganicLeaveService] Starting DB Transaction...");
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     console.log(`[addOrganicLeaveService] Fetching employee ${userId}...`);
//     const employee = await Employee.findById(userId).session(session).lean();
//     if (!employee) {
//       console.error(
//         `[addOrganicLeaveService] Employee ${userId} not found in DB`,
//       );
//       throw createServiceError("Employee not found.", 404);
//     }

//     const memoIds = sanitizedMemos.map((m) => m.memoId);
//     console.log(
//       "[addOrganicLeaveService] Fetching CTO Credits for memo IDs:",
//       memoIds,
//     );
//     const credits = await CtoCredit.find({
//       _id: { $in: memoIds },
//       "employees.employee": employee._id,
//       status: "CREDITED",
//     }).session(session);

//     if (credits.length !== memoIds.length) {
//       console.error(
//         "[addOrganicLeaveService] Mismatch in credits found vs requested memos. Found:",
//         credits.length,
//         "Expected:",
//         memoIds.length,
//       );
//       throw createServiceError("Some memos are invalid or not credited.", 400);
//     }

//     let totalAppliedHours = 0;
//     const memoUsage = [];

//     // 2. Process CTO Memos and deduct hours
//     console.log(
//       "[addOrganicLeaveService] Processing memos and deducting hours...",
//     );
//     for (const input of sanitizedMemos) {
//       const credit = credits.find(
//         (c) => String(c._id) === String(input.memoId),
//       );

//       if (!credit) {
//         console.error(
//           `[addOrganicLeaveService] Credit not found for memoId: ${input.memoId}`,
//         );
//         throw createServiceError(
//           `Credit not found for memoId ${input.memoId}`,
//           400,
//         );
//       }

//       const empCredit = credit.employees.find(
//         (e) => String(e.employee) === String(employee._id),
//       );

//       if (!empCredit) {
//         console.error(
//           `[addOrganicLeaveService] Employee credit record not found in memo: ${credit.memoNo}`,
//         );
//         throw createServiceError(
//           `Employee credit record not found for memo ${credit.memoNo}`,
//           400,
//         );
//       }

//       const availableHours = strictNumber(empCredit.remainingHours);
//       console.log(
//         `[addOrganicLeaveService] Memo ${credit.memoNo} - Requested: ${input.appliedHours}, Available: ${availableHours}`,
//       );

//       if (input.appliedHours <= 0 || input.appliedHours > availableHours) {
//         console.error(
//           `[addOrganicLeaveService] Invalid applied hours for memo ${credit.memoNo}`,
//         );
//         throw createServiceError(
//           `Invalid applied hours for memo ${credit.memoNo}. Available: ${availableHours}`,
//           400,
//         );
//       }

//       empCredit.reservedHours =
//         (empCredit.reservedHours || 0) + input.appliedHours;
//       empCredit.remainingHours = empCredit.remainingHours - input.appliedHours;
//       empCredit.status = empCredit.status || "ACTIVE";

//       console.log(
//         `[addOrganicLeaveService] Updating CTO Credit Document ${credit._id}...`,
//       );
//       const updateResult = await CtoCredit.updateOne(
//         {
//           _id: credit._id,
//           "employees.employee": employee._id,
//           "employees.remainingHours": { $gte: input.appliedHours },
//         },
//         { $set: { "employees.$": empCredit } },
//         { session },
//       );

//       if (updateResult.modifiedCount === 0) {
//         console.error(
//           `[addOrganicLeaveService] Concurrency error updating memo ${credit.memoNo}. updateResult:`,
//           updateResult,
//         );
//         throw createServiceError(
//           `Failed to reserve hours for memo ${credit.memoNo}. Concurrency mismatch.`,
//           400,
//         );
//       }

//       memoUsage.push({
//         memoId: credit._id,
//         uploadedMemo: (credit.uploadedMemo || "").replace(/\\/g, "/"),
//         appliedHours: input.appliedHours,
//       });

//       totalAppliedHours += input.appliedHours;
//     }

//     console.log(
//       `[addOrganicLeaveService] Total applied hours calculated: ${totalAppliedHours}, Requested: ${strictReqHours}`,
//     );
//     if (totalAppliedHours !== strictReqHours) {
//       console.error(
//         "[addOrganicLeaveService] Sum of applied hours does not match requested hours.",
//       );
//       throw createServiceError(
//         `Sum of applied hours (${totalAppliedHours}) does not match requested hours (${strictReqHours})`,
//         400,
//       );
//     }

//     // 3. Save using the Organic Leave Model
//     console.log(
//       "[addOrganicLeaveService] Creating OrganicLeaveApplication document...",
//     );
//     const newApplication = new OrganicLeaveApplication({
//       employee: employee._id,
//       leaveType: safeLeaveType,
//       leaveTypeOthersSpecify: sanitizeText(leaveTypeOthersSpecify, 150),
//       leaveDetails,
//       requestedHours: strictReqHours,
//       reason: safeReason,
//       inclusiveDates,
//       memo: memoUsage,
//       commutation: commutation || "Not Requested",
//       overallStatus: "PENDING",
//     });

//     await newApplication.save({ session });
//     console.log(
//       `[addOrganicLeaveService] Application saved with ID: ${newApplication._id}`,
//     );

//     // 4. Create Approval Steps
//     console.log("[addOrganicLeaveService] Creating ApprovalSteps...");
//     const approvalSteps = await Promise.all(
//       finalApprovers.map((approverId, index) =>
//         ApprovalStep.create(
//           [
//             {
//               level: index + 1,
//               approver: approverId,
//               status: "PENDING",
//               ctoApplication: newApplication._id,
//             },
//           ],
//           { session },
//         ).then((res) => res[0]),
//       ),
//     );

//     newApplication.approvals = approvalSteps.map((step) => step._id);
//     await newApplication.save({ session });
//     console.log(
//       "[addOrganicLeaveService] ApprovalSteps linked to application.",
//     );

//     // Commit Transaction
//     console.log("[addOrganicLeaveService] Committing Transaction...");
//     await session.commitTransaction();
//     session.endSession();

//     console.log(
//       "[addOrganicLeaveService] Populating application details for return...",
//     );
//     const populatedApp = await populateApplicationById(newApplication._id);

//     // Notifications (Outside Transaction)
//     console.log("[addOrganicLeaveService] Firing Notifications...");
//     try {
//       await NotificationService.notifyApproversOnCtoSubmission({
//         approverIds: finalApprovers,
//         employee,
//         ctoApplication: newApplication,
//       });

//       await NotificationService.notifyEmployeeOnCtoSubmissionCreated({
//         employee,
//         ctoApplication: newApplication,
//       });
//     } catch (err) {
//       console.error(
//         "[addOrganicLeaveService] Non-fatal Error creating submission notifications:",
//         err?.message || err,
//       );
//     }

//     // Email to first approver
//     console.log("[addOrganicLeaveService] Sending email to first approver...");
//     try {
//       const firstApproval = approvalSteps.find((a) => a.level === 1);
//       const approverUser = await Employee.findById(firstApproval.approver)
//         .select("firstName lastName email")
//         .lean();

//       const enabled = await canSend(EMAIL_KEYS.CTO_APPROVAL);

//       if (approverUser?.email && enabled) {
//         const tpl = ctoApprovalEmail({
//           approverName: `${approverUser.firstName} ${approverUser.lastName}`,
//           employeeName: `${employee.firstName} ${employee.lastName}`,
//           requestedHours: strictReqHours,
//           reason: safeLeaveType,
//           level: 1,
//           link: `${process.env.FRONTEND_URL}/app/organic-approvals/${newApplication._id}`,
//           brandName: "Leave Management System",
//         });

//         await safeSendEmail(approverUser.email, tpl.subject, tpl.html);
//         console.log(
//           `[addOrganicLeaveService] Email sent to: ${approverUser.email}`,
//         );
//       } else {
//         console.log(
//           `[addOrganicLeaveService] Email skipped. Approver email exists: ${!!approverUser?.email}, Email enabled: ${enabled}`,
//         );
//       }
//     } catch (err) {
//       console.error(
//         "[addOrganicLeaveService] Non-fatal Error sending approval email:",
//         err?.message || err,
//       );
//     }

//     console.log("[addOrganicLeaveService] DONE! Returning populated app.");
//     return populatedApp;
//   } catch (err) {
//     console.error(
//       "[addOrganicLeaveService] FATAL ERROR. Aborting transaction.",
//       err,
//     );
//     await session.abortTransaction();
//     session.endSession();
//     throw err;
//   }
// };

// const cancelOrganicLeaveService = async ({ userId, applicationId }) => {
//   assertObjectId(userId, "User ID");
//   assertObjectId(applicationId, "Application ID");

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const app = await OrganicLeaveApplication.findOne({
//       _id: applicationId,
//       employee: userId,
//     }).session(session);

//     if (!app) {
//       throw createServiceError("Application not found or unauthorized.", 404);
//     }

//     if (app.overallStatus !== "PENDING") {
//       throw createServiceError(
//         "Only PENDING applications can be cancelled.",
//         400,
//       );
//     }

//     app.overallStatus = "CANCELLED";
//     await app.save({ session });

//     await cancelApprovalSteps(
//       {
//         applicationId: app._id,
//         approvalIds: app.approvals || [],
//         reason: AUTO_CANCEL_REMARK_EMPLOYEE,
//         afterLevel: 0,
//       },
//       session,
//     );

//     // Strictly restore memos
//     await restoreMemoHours(
//       {
//         employeeId: userId,
//         memoItems: app.memo || [],
//       },
//       session,
//     );

//     // Commit Transaction
//     await session.commitTransaction();
//     session.endSession();

//     // Notifications (Outside Transaction)
//     try {
//       const employee = await Employee.findById(userId).select(
//         "firstName lastName email",
//       );
//       if (employee) {
//         await notifyApproversOfCancellation({
//           application: app,
//           employee,
//           approvalIds: app.approvals || [],
//         });
//       }
//     } catch (err) {
//       console.error(
//         "Failed to create cancellation notifications:",
//         err?.message || err,
//       );
//     }

//     return populateApplicationById(app._id);
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     throw err;
//   }
// };

// const getAllOrganicLeavesService = async (
//   filters = {},
//   page = 1,
//   limit = 20,
// ) => {
//   page = Math.max(parseInt(page) || 1, 1);
//   limit = Math.min(parseInt(limit) || 20, 100);
//   const skip = (page - 1) * limit;

//   const query = {};

//   if (filters.employeeId) {
//     assertObjectId(filters.employeeId, "Employee ID");
//     query.employee = filters.employeeId;
//   }

//   if (filters.status)
//     query.overallStatus = String(filters.status).toUpperCase();
//   if (filters.leaveType) query.leaveType = String(filters.leaveType);

//   if (filters.from && filters.to) {
//     query.createdAt = {
//       $gte: new Date(filters.from),
//       $lte: new Date(filters.to),
//     };
//   }

//   if (filters.search) {
//     const safeSearch = sanitizeSearch(filters.search, 100);
//     query.$or = [
//       { leaveType: { $regex: safeSearch, $options: "i" } },
//       { reason: { $regex: safeSearch, $options: "i" } },
//       { "memo.memoId.memoNo": { $regex: safeSearch, $options: "i" } },
//     ];
//   }

//   const [applications, total] = await Promise.all([
//     OrganicLeaveApplication.find(query)
//       .select(
//         "leaveType requestedHours reason overallStatus approvals employee inclusiveDates memo createdAt commutation",
//       )
//       .populate({
//         path: "approvals",
//         options: { sort: { level: 1 } },
//         populate: {
//           path: "approver",
//           select: "firstName lastName position _id",
//         },
//       })
//       .populate("employee", "firstName lastName position _id employeeId")
//       .populate(
//         "memo.memoId",
//         "memoNo uploadedMemo duration totalHours appliedHours",
//       )
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean(),
//     OrganicLeaveApplication.countDocuments(query),
//   ]);

//   const transformed = applications.map((app) => {
//     const approvals = app.approvals || [];
//     return {
//       ...app,
//       approver1: approvals[0]?.approver || null,
//       approver2: approvals[1]?.approver || null,
//       approver3: approvals[2]?.approver || null,
//     };
//   });

//   const baseQuery = { ...query };
//   delete baseQuery.overallStatus;

//   const statusAgg = await OrganicLeaveApplication.aggregate([
//     { $match: baseQuery },
//     {
//       $group: {
//         _id: "$overallStatus",
//         count: { $sum: 1 },
//       },
//     },
//   ]);

//   const totalAll = await OrganicLeaveApplication.countDocuments(baseQuery);

//   const statusCounts = {
//     PENDING: 0,
//     APPROVED: 0,
//     REJECTED: 0,
//     CANCELLED: 0,
//     total: totalAll,
//   };

//   statusAgg.forEach((s) => {
//     if (s._id) statusCounts[s._id] = s.count;
//   });

//   return {
//     data: transformed,
//     pagination: {
//       page,
//       limit,
//       total,
//       totalPages: Math.ceil(total / limit),
//     },
//     statusCounts,
//   };
// };

// const getOrganicLeavesByEmployeeService = async (
//   employeeId,
//   page = 1,
//   limit = 20,
//   filters = {},
// ) => {
//   assertObjectId(employeeId, "Employee ID");
//   const employeeObjectId = new mongoose.Types.ObjectId(employeeId);

//   page = Math.max(parseInt(page) || 1, 1);
//   limit = Math.min(parseInt(limit) || 20, 100);
//   const skip = (page - 1) * limit;

//   const pipeline = [{ $match: { employee: employeeObjectId } }];

//   if (filters.status) {
//     pipeline.push({
//       $match: { overallStatus: String(filters.status).toUpperCase() },
//     });
//   }

//   if (filters.leaveType) {
//     pipeline.push({
//       $match: { leaveType: String(filters.leaveType) },
//     });
//   }

//   if (filters.from && filters.to) {
//     pipeline.push({
//       $match: {
//         createdAt: {
//           $gte: new Date(filters.from),
//           $lte: new Date(filters.to),
//         },
//       },
//     });
//   }

//   // Inject CTO Credit Lookup
//   pipeline.push({
//     $lookup: {
//       from: "ctocredits",
//       let: { memoIds: "$memo.memoId", appEmployeeId: "$employee" },
//       pipeline: [
//         { $match: { $expr: { $in: ["$_id", "$$memoIds"] } } },
//         {
//           $project: {
//             dateApproved: 1,
//             createdAt: 1,
//             memoNo: 1,
//             status: 1,
//             employees: 1,
//             uploadedMemo: 1,
//             duration: 1,
//             totalHours: 1,
//           },
//         },
//         {
//           $addFields: {
//             employee: {
//               $first: {
//                 $filter: {
//                   input: "$employees",
//                   as: "emp",
//                   cond: { $eq: ["$$emp.employee", "$$appEmployeeId"] },
//                 },
//               },
//             },
//           },
//         },
//         { $project: { employees: 0 } },
//       ],
//       as: "memoDetails",
//     },
//   });

//   if (filters.search) {
//     const safeSearch = sanitizeSearch(filters.search, 100);
//     pipeline.push({
//       $match: {
//         $or: [
//           { leaveType: { $regex: safeSearch, $options: "i" } },
//           { reason: { $regex: safeSearch, $options: "i" } },
//           { "memoDetails.memoNo": { $regex: safeSearch, $options: "i" } },
//         ],
//       },
//     });
//   }

//   pipeline.push({
//     $lookup: {
//       from: "approvalsteps",
//       let: { approvalIds: "$approvals" },
//       pipeline: [
//         { $match: { $expr: { $in: ["$_id", "$$approvalIds"] } } },
//         {
//           $lookup: {
//             from: "employees",
//             localField: "approver",
//             foreignField: "_id",
//             as: "approver",
//           },
//         },
//         { $unwind: { path: "$approver", preserveNullAndEmptyArrays: true } },
//         {
//           $project: {
//             level: 1,
//             status: 1,
//             reviewedAt: 1,
//             remarks: 1,
//             approver: {
//               _id: "$approver._id",
//               firstName: "$approver.firstName",
//               lastName: "$approver.lastName",
//               position: "$approver.position",
//             },
//           },
//         },
//         { $sort: { level: 1 } },
//       ],
//       as: "approvals",
//     },
//   });

//   pipeline.push({
//     $lookup: {
//       from: "employees",
//       localField: "employee",
//       foreignField: "_id",
//       as: "employeeDoc",
//     },
//   });

//   pipeline.push({
//     $unwind: { path: "$employeeDoc", preserveNullAndEmptyArrays: true },
//   });

//   pipeline.push({
//     $addFields: {
//       employee: {
//         _id: "$employeeDoc._id",
//         firstName: "$employeeDoc.firstName",
//         lastName: "$employeeDoc.lastName",
//         position: "$employeeDoc.position",
//         employeeId: "$employeeDoc.employeeId",
//       },
//     },
//   });

//   pipeline.push({ $project: { employeeDoc: 0 } });
//   pipeline.push({ $sort: { createdAt: -1 } });
//   pipeline.push({ $skip: skip });
//   pipeline.push({ $limit: limit });

//   let applications = await OrganicLeaveApplication.aggregate(pipeline);

//   // Map CTO memos back to frontend friendly structure
//   applications = applications.map((app) => {
//     if (app.memo && Array.isArray(app.memo)) {
//       const memoMap = (app.memoDetails || []).reduce((acc, md) => {
//         if (md && md._id) acc[md._id.toString()] = md;
//         return acc;
//       }, {});

//       app.memo = app.memo.map((m) => {
//         const memoIdStr = m?.memoId ? m.memoId.toString() : null;
//         return {
//           ...m,
//           memoId: memoMap[memoIdStr] || null,
//         };
//       });
//     }

//     delete app.memoDetails;
//     return app;
//   });

//   const countPipeline = [
//     { $match: { employee: employeeObjectId } },
//     ...pipeline.filter(
//       (stage) =>
//         !("$skip" in stage) && !("$limit" in stage) && !("$sort" in stage),
//     ),
//     { $count: "total" },
//   ];

//   const totalResult = await OrganicLeaveApplication.aggregate(countPipeline);
//   const total = totalResult[0]?.total || 0;

//   const statusCountsAgg = await OrganicLeaveApplication.aggregate([
//     { $match: { employee: employeeObjectId } },
//     {
//       $group: {
//         _id: "$overallStatus",
//         count: { $sum: 1 },
//       },
//     },
//   ]);

//   const totalAll = await OrganicLeaveApplication.countDocuments({
//     employee: employeeObjectId,
//   });

//   const statusCounts = {
//     PENDING: 0,
//     APPROVED: 0,
//     REJECTED: 0,
//     CANCELLED: 0,
//     total: totalAll,
//   };

//   statusCountsAgg.forEach((s) => {
//     if (s._id) statusCounts[s._id] = s.count;
//   });

//   return {
//     data: applications,
//     pagination: {
//       page,
//       limit,
//       total,
//       totalPages: Math.ceil(total / limit),
//     },
//     statusCounts,
//   };
// };

// module.exports = {
//   addOrganicLeaveService,
//   cancelOrganicLeaveService,
//   getAllOrganicLeavesService,
//   getOrganicLeavesByEmployeeService,
// };
