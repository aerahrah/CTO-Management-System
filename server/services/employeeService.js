// services/employeeService.js
const mongoose = require("mongoose");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const Employee = require("../models/employeeModel");
const Project = require("../models/projectModel");
const Designation = require("../models/designationModel");
const Role = require("../models/roleModel");
const CtoCredit = require("../models/ctoCreditModel");

const { getSessionSettings } = require("./generalSettings.service");
const sendEmail = require("../utils/sendEmail");
const { employeeWelcomeEmail } = require("../utils/emailTemplates");

const EMAIL_KEYS = require("../utils/emailNotificationKeys");
const { isEmailEnabled } = require("../utils/emailNotificationSettings");

// Freeze constants to prevent mutation and prototype pollution
const ALLOWED_LIMITS = Object.freeze([10, 20, 50, 100]);
const MAX_SESSION_MINUTES = 60 * 24 * 30; // 30 days

// Explicit allowlists to prevent mass assignment vulnerabilities
const ALLOWED_PROFILE_UPDATES = Object.freeze([
  "firstName",
  "lastName",
  "email",
  "phone",
  "position",
  "division",
  "project",
  "address",
  "emergencyContact",
]);

const ALLOWED_ADMIN_UPDATES = Object.freeze([
  ...ALLOWED_PROFILE_UPDATES,
  "contractType",
  "status",
]);

// --- HELPER FUNCTIONS ---

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Sanitizes input strings by removing null bytes and escaping regex characters.
 * Explicitly limits length to prevent ReDoS (Regular Expression Denial of Service).
 */
function sanitizeSearch(str, limit = 100) {
  return String(str || "")
    .replace(/\0/g, "") // Prevent Null Byte Injection
    .slice(0, limit)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeToStringId(value) {
  if (!value) return null;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

function parsePage(v) {
  return Math.max(parseInt(v, 10) || 1, 1);
}

function parseLimit(v, def = 20) {
  const lim = parseInt(v, 10);
  if (!Number.isFinite(lim)) return def;
  return ALLOWED_LIMITS.includes(lim) ? lim : def;
}

async function resolveProjectIdOrThrow(projectInput) {
  const val = normalizeToStringId(projectInput);
  if (!val || !val.trim()) throw httpError("Project is required", 400);

  if (mongoose.isValidObjectId(val)) {
    const p = await Project.findById(val).select("_id status name").lean();
    if (!p) throw httpError("Selected project not found", 400);
    return p._id;
  }

  const safeVal = sanitizeSearch(val.trim(), 100);
  const p = await Project.findOne({
    name: { $regex: new RegExp(`^${safeVal}$`, "i") },
  })
    .select("_id status name")
    .lean();

  if (!p) throw httpError("Selected project not found", 400);
  return p._id;
}

async function resolveProjectIdForFilter(projectInput) {
  const val = normalizeToStringId(projectInput);
  if (!val || !val.trim()) return null;
  if (mongoose.isValidObjectId(val)) return val;

  const safeVal = sanitizeSearch(val.trim(), 100);
  const p = await Project.findOne({
    name: { $regex: new RegExp(`^${safeVal}$`, "i") },
  })
    .select("_id")
    .lean();

  return p ? p._id : null;
}

async function resolveDesignationIdOrThrow(designationInput) {
  const val = normalizeToStringId(designationInput);
  if (!val || !val.trim()) throw httpError("Designation is required", 400);

  if (mongoose.isValidObjectId(val)) {
    const d = await Designation.findById(val).select("_id status name").lean();
    if (!d) throw httpError("Selected designation not found", 400);
    if (d.status !== "Active")
      throw httpError("Selected designation is inactive", 400);
    return d._id;
  }

  const safeVal = sanitizeSearch(val.trim(), 100);
  const d = await Designation.findOne({
    name: { $regex: new RegExp(`^${safeVal}$`, "i") },
  })
    .select("_id status name")
    .lean();

  if (!d) throw httpError("Selected designation not found", 400);
  if (d.status !== "Active")
    throw httpError("Selected designation is inactive", 400);

  return d._id;
}

async function resolveDesignationIdForFilter(designationInput) {
  const val = normalizeToStringId(designationInput);
  if (!val || !val.trim()) return null;
  if (mongoose.isValidObjectId(val)) return val;

  const safeVal = sanitizeSearch(val.trim(), 100);
  const d = await Designation.findOne({
    name: { $regex: new RegExp(`^${safeVal}$`, "i") },
  })
    .select("_id")
    .lean();

  return d ? d._id : null;
}

async function safeSendEmail(to, subject, html) {
  try {
    return await sendEmail(to, subject, html);
  } catch (e) {
    console.error("[EMAIL] failed but continuing:", {
      to,
      subject,
      message: e?.message,
    });
    return null;
  }
}

async function canSend(key) {
  return await isEmailEnabled(key);
}

/**
 * Generates a cryptographically secure temporary password.
 */
function generateSecureTempPassword() {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const nums = "0123456789";
  const specials = "@$!%*?&()-_=+<>";
  const allChars = lower + upper + nums + specials;

  const getChar = (charset) => charset[crypto.randomInt(0, charset.length)];

  // Guarantee at least one character from each set
  const pwArr = [
    getChar(lower),
    getChar(upper),
    getChar(nums),
    getChar(specials),
  ];

  // Fill the remaining length to reach 12 characters total
  for (let i = 0; i < 8; i++) {
    pwArr.push(getChar(allChars));
  }

  // Fisher-Yates shuffle using crypto.randomInt
  for (let i = pwArr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [pwArr[i], pwArr[j]] = [pwArr[j], pwArr[i]];
  }

  return pwArr.join("");
}

// --- SERVICES ---

const createEmployeeService = async (employeeData = {}) => {
  const {
    employeeId,
    username,
    email,
    firstName,
    lastName,
    position,
    designation,
    division,
    project,
    role,
    contractType,
  } = employeeData;

  if (
    !employeeId ||
    !username ||
    !firstName ||
    !lastName ||
    !designation ||
    !project
  ) {
    throw httpError("Missing required fields for employee creation", 400);
  }

  const existing = await Employee.findOne({
    $or: [
      { employeeId: String(employeeId).trim() },
      { username: String(username).trim() },
      ...(email ? [{ email: String(email).trim() }] : []),
    ],
  }).lean();

  if (existing) {
    throw httpError(
      "Employee with this ID, username, or email already exists",
      409,
    );
  }

  const projectId = await resolveProjectIdOrThrow(project);
  const designationId = await resolveDesignationIdOrThrow(designation);

  let resolvedRoleId = role;
  if (!role) {
    const defaultRole = await Role.findOne({ name: "employee" }).lean();
    resolvedRoleId = defaultRole ? defaultRole._id : null;
  }

  const tempPassword = generateSecureTempPassword();

  const employee = new Employee({
    employeeId: String(employeeId).trim(),
    username: String(username).trim(),
    email: email ? String(email).trim() : undefined,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    division: division ? String(division).trim() : undefined,
    project: projectId,
    designation: designationId,
    position: position ? String(position).trim() : undefined,
    role: resolvedRoleId,
    contractType: contractType || "Permanent",
    password: tempPassword, // Will be hashed by pre-save hook
    balances: {
      wellnessDays: !contractType || contractType === "Permanent" ? 5 : 0,
      vlHours: 0,
      slHours: 0,
      ctoHours: 0,
    },
  });

  await employee.save();

  const frontendUrl = process.env.FRONTEND_URL || "https://cto.dictr2.cloud";

  if (employee.email) {
    const enabled = await canSend(EMAIL_KEYS.EMPLOYEE_WELCOME);
    if (enabled) {
      const tpl = employeeWelcomeEmail({
        firstName: employee.firstName,
        username: employee.username,
        tempPassword,
        loginUrl: `${frontendUrl}`,
        brandName: "HRMS",
      });
      await safeSendEmail(employee.email, tpl.subject, tpl.html);
    }
  }

  // Convert to plain object and remove sensitive data before returning
  const safeEmployee = employee.toObject();
  delete safeEmployee.password;
  delete safeEmployee.loginAttempts;
  delete safeEmployee.lockUntil;

  return { employee: safeEmployee };
};

const getEmployeesService = async ({
  division,
  designation,
  project,
  search,
  page,
  limit,
}) => {
  const query = {};

  if (division) query.division = String(division).trim();

  if (designation) {
    const designationId = await resolveDesignationIdForFilter(designation);
    if (!designationId) return { data: [], total: 0, totalPages: 0 };
    query.designation = designationId;
  }

  if (project) {
    const projectId = await resolveProjectIdForFilter(project);
    if (!projectId) return { data: [], total: 0, totalPages: 0 };
    query.project = projectId;
  }

  const q = String(search || "").trim();
  if (q) {
    // Strictly limit search length to 100 characters and escape regex
    const safeSearch = sanitizeSearch(q, 100);
    query.$or = [
      { firstName: { $regex: safeSearch, $options: "i" } },
      { lastName: { $regex: safeSearch, $options: "i" } },
      { email: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const pg = parsePage(page);
  const lim = parseLimit(limit, 20);
  const skip = (pg - 1) * lim;

  const projection = {
    firstName: 1,
    lastName: 1,
    email: 1,
    designation: 1,
    division: 1,
    project: 1,
    role: 1,
    status: 1,
    position: 1,
  };

  const [data, total] = await Promise.all([
    Employee.find(query, projection)
      .skip(skip)
      .limit(lim)
      .sort({ lastName: 1, firstName: 1 })
      .populate("designation", "name status")
      .populate("project", "name status")
      .populate("role", "name permissions isSystem")
      .lean(),
    Employee.countDocuments(query),
  ]);

  return { data, total, totalPages: Math.ceil(total / lim) || 1 };
};

const getEmployeeByIdService = async (id) => {
  if (!mongoose.isValidObjectId(id))
    throw httpError("Invalid Employee ID", 400);

  const employee = await Employee.findById(id)
    .select("-password -loginAttempts -lockUntil -__v")
    .populate("designation", "name status")
    .populate("project", "name status")
    .populate("role", "name permissions isSystem")
    .lean();

  if (!employee) throw httpError(`Employee not found`, 404);
  return employee;
};

const signInEmployeeService = async (username, password) => {
  const safeUsername = String(username).trim();
  const safePassword = String(password); // Prevent NoSQL Injection Object `{ $ne: null }`

  const employee = await Employee.findOne({ username: safeUsername })
    .select("+password +loginAttempts +lockUntil")
    .populate("role");

  if (!employee) throw httpError("Invalid username or password", 401);

  if (
    employee.lockUntil &&
    new Date(employee.lockUntil).getTime() > Date.now()
  ) {
    const remainingMs = employee.lockUntil - Date.now();
    const minutes = Math.ceil(remainingMs / 60000);
    throw httpError(`Account locked. Try again in ${minutes} minute(s).`, 403);
  }

  const isMatch = await employee.comparePassword(safePassword);

  if (!isMatch) {
    employee.loginAttempts = (employee.loginAttempts || 0) + 1;
    if (employee.loginAttempts >= 15) {
      employee.lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes lockout
      employee.loginAttempts = 0;
    }
    await employee.save();
    throw httpError("Invalid username or password", 401);
  }

  employee.loginAttempts = 0;
  employee.lockUntil = undefined;
  await employee.save();

  if (!process.env.JWT_SECRET) {
    throw httpError("Server misconfigured: JWT_SECRET is missing", 500);
  }

  const tokenPayload = {
    id: employee._id,
    username: employee.username,
    designation: employee.designation,
    role: employee.role,
  };

  const sessionSettings = await getSessionSettings();
  const enabled =
    typeof sessionSettings?.sessionTimeoutEnabled === "boolean"
      ? sessionSettings.sessionTimeoutEnabled
      : true;

  const minutesRaw = Number(sessionSettings?.sessionTimeoutMinutes ?? 0);
  const minutes =
    Number.isFinite(minutesRaw) && minutesRaw > 0
      ? Math.min(Math.max(Math.trunc(minutesRaw), 1), MAX_SESSION_MINUTES)
      : 1440;

  const options = {
    issuer: process.env.JWT_ISSUER || "hrms-api",
    audience: process.env.JWT_AUDIENCE || "hrms-client",
  };

  if (enabled) options.expiresIn = minutes * 60;

  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, options);

  // ✅ NEW: Calculate exact session expiration
  const sessionExpiresAt = enabled ? Date.now() + minutes * 60 * 1000 : null;

  const responsePayload = {
    ...tokenPayload,
    firstName: employee.firstName,
    lastName: employee.lastName,
    preferences: {
      theme: employee.preferences?.theme ?? "system",
      accent: employee.preferences?.accent ?? "blue",
    },
    // ✅ NEW: Include the timer for the React frontend
    sessionExpiresAt,
  };

  // ✅ NEW: Return minutes and enabled so the Controller can set the HttpOnly Cookie maxAge
  return { token, payload: responsePayload, minutes, enabled };
};

const updateEmployeeService = async (id, updateData = {}) => {
  if (!mongoose.isValidObjectId(id))
    throw httpError("Invalid Employee ID", 400);

  const employee = await Employee.findById(id);
  if (!employee) throw httpError(`Employee not found`, 404);

  // Email / Username Uniqueness Check
  if (updateData.email || updateData.username) {
    const conflict = await Employee.findOne({
      _id: { $ne: id },
      $or: [
        ...(updateData.email
          ? [{ email: String(updateData.email).trim() }]
          : []),
        ...(updateData.username
          ? [{ username: String(updateData.username).trim() }]
          : []),
      ],
    })
      .select("_id")
      .lean();
    if (conflict) throw httpError("Email or username already in use", 409);
  }

  // Resolve Relations
  if (updateData.project) {
    updateData.project = await resolveProjectIdOrThrow(updateData.project);
  }
  if (updateData.designation) {
    updateData.designation = await resolveDesignationIdOrThrow(
      updateData.designation,
    );
  }

  // Prevent Mass Assignment Vulnerabilities
  ALLOWED_ADMIN_UPDATES.forEach((field) => {
    if (updateData[field] !== undefined) {
      // Treat text fields explicitly as strings to prevent injection objects
      employee[field] =
        typeof updateData[field] === "string"
          ? updateData[field].trim()
          : updateData[field];
    }
  });

  // Handle nested object specific fields explicitly
  if (updateData.balances && typeof updateData.balances === "object") {
    const allowedBalances = ["wellnessDays", "vlHours", "slHours", "ctoHours"];
    if (!employee.balances) employee.balances = {};
    allowedBalances.forEach((key) => {
      if (typeof updateData.balances[key] === "number") {
        employee.balances[key] = updateData.balances[key];
      }
    });
  }

  await employee.save();

  return await Employee.findById(employee._id)
    .select("-password -loginAttempts -lockUntil -__v")
    .populate("designation", "name status")
    .populate("project", "name status")
    .populate("role", "name permissions isSystem")
    .lean();
};

const getEmployeeCtoMemos = async (employeeId) => {
  if (!mongoose.isValidObjectId(employeeId))
    throw httpError("Invalid Employee ID", 400);

  const memos = await CtoCredit.find({ "employees.employee": employeeId })
    .populate("employees.employee", "firstName lastName")
    .lean();

  const formatted = memos.map((memo) => {
    const empData = memo.employees.find(
      (e) => String(e.employee?._id) === String(employeeId),
    );
    const filename = String(memo.uploadedMemo || "")
      .split(/[/\\]/)
      .pop();

    return {
      id: memo._id,
      memoNo: memo.memoNo,
      dateApproved: memo.dateApproved,
      uploadedMemo: filename ? `/uploads/cto_memos/${filename}` : null,
      creditedHours: empData?.creditedHours || 0,
      usedHours: empData?.usedHours || 0,
      remainingHours: empData?.remainingHours || 0,
      status: empData?.status || "ACTIVE",
      reservedHours: empData?.reservedHours || 0,
    };
  });

  return formatted.sort(
    (a, b) => new Date(a.dateApproved) - new Date(b.dateApproved),
  );
};

async function changeEmployeeRole(id, newRole) {
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(newRole)) {
    throw httpError("Invalid ID provided", 400);
  }

  const roleExists = await Role.findById(newRole).select("_id").lean();
  if (!roleExists) throw httpError(`Invalid role ID`, 400);

  const employee = await Employee.findByIdAndUpdate(
    id,
    { $set: { role: newRole } },
    { new: true, runValidators: true },
  )
    .select("-password -loginAttempts -lockUntil -__v")
    .populate("role", "name permissions isSystem")
    .lean();

  if (!employee) throw httpError("Employee not found", 404);
  return employee;
}

const getProfile = async (employeeId) => {
  if (!mongoose.isValidObjectId(employeeId))
    throw httpError("Invalid Employee ID", 400);

  const employee = await Employee.findById(employeeId)
    .select("-password -loginAttempts -lockUntil -__v")
    .populate("designation", "name status")
    .populate("project", "name status")
    .populate("role", "name permissions isSystem")
    .lean();

  if (!employee) throw httpError("Employee not found", 404);
  return employee;
};

const updateProfile = async (employeeId, updateData = {}) => {
  if (!mongoose.isValidObjectId(employeeId))
    throw httpError("Invalid Employee ID", 400);

  const filteredData = {};
  ALLOWED_PROFILE_UPDATES.forEach((field) => {
    if (updateData[field] !== undefined) {
      filteredData[field] =
        typeof updateData[field] === "string"
          ? updateData[field].trim()
          : updateData[field];
    }
  });

  if (filteredData.email) {
    const conflict = await Employee.findOne({
      _id: { $ne: employeeId },
      email: filteredData.email,
    })
      .select("_id")
      .lean();
    if (conflict) throw httpError("Email already in use", 409);
  }

  if (filteredData.project !== undefined) {
    filteredData.project = await resolveProjectIdOrThrow(filteredData.project);
  }

  // Use $set to prevent accidental overwrites
  const updatedEmployee = await Employee.findByIdAndUpdate(
    employeeId,
    { $set: filteredData },
    { new: true, runValidators: true },
  )
    .select("-password -loginAttempts -lockUntil -__v")
    .populate("designation", "name status")
    .populate("project", "name status")
    .populate("role", "name permissions isSystem")
    .lean();

  if (!updatedEmployee) throw httpError("Employee not found", 404);
  return updatedEmployee;
};

const resetPassword = async (employeeId, oldPassword, newPassword) => {
  if (!mongoose.isValidObjectId(employeeId))
    throw httpError("Invalid Employee ID", 400);

  // Cast inputs to string explicitly to prevent NoSQL object injections
  const safeOldPassword = String(oldPassword || "");
  const safeNewPassword = String(newPassword || "");

  if (safeNewPassword.length < 8) {
    throw httpError("New password must be at least 8 characters long", 400);
  }

  const employee = await Employee.findById(employeeId).select("+password");
  if (!employee) throw httpError("Employee not found", 404);

  const isMatch = await employee.comparePassword(safeOldPassword);
  if (!isMatch) throw httpError("Old password is incorrect", 400); // Standard generic message

  employee.password = safeNewPassword;

  // Optionally reset lockout thresholds on successful manual reset
  employee.loginAttempts = 0;
  employee.lockUntil = undefined;

  await employee.save();

  return { message: "Password updated successfully" };
};

const getEmployeeWellnessBalanceService = async (employeeId) => {
  if (!mongoose.isValidObjectId(employeeId))
    throw httpError("Invalid Employee ID", 400);

  const employee = await Employee.findById(employeeId)
    .select("balances.wellnessDays")
    .lean();

  if (!employee) throw httpError("Employee not found", 404);

  return employee.balances?.wellnessDays || 0;
};

module.exports = {
  getProfile,
  updateProfile,
  resetPassword,
  changeEmployeeRole,
  updateEmployeeService,
  createEmployeeService,
  getEmployeesService,
  getEmployeeByIdService,
  signInEmployeeService,
  getEmployeeCtoMemos,
  getEmployeeWellnessBalanceService,
};
