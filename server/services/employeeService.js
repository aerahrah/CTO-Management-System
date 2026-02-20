// services/employeeService.js
const Employee = require("../models/employeeModel");
const Project = require("../models/projectModel");
const Designation = require("../models/designationModel");
const mongoose = require("mongoose");

// ✅ UPDATED: use the new separated session settings getter
// (based on your refactor to separate Session + Working Days services)
const { getSessionSettings } = require("./generalSettings.service");

const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const jwt = require("jsonwebtoken");
const CtoCredit = require("../models/ctoCreditModel");

const validRoles = ["employee", "supervisor", "hr", "admin"];
const ALLOWED_LIMITS = [10, 20, 50, 100];

// Keep consistent with your settings validation
const MAX_SESSION_MINUTES = 60 * 24 * 30;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  if (mongoose.Types.ObjectId.isValid(val)) {
    const p = await Project.findById(val).select("_id status name");
    if (!p) throw httpError("Selected project not found", 400);
    return p._id;
  }

  const p = await Project.findOne({
    name: { $regex: new RegExp(`^${escapeRegExp(val.trim())}$`, "i") },
  }).select("_id status name");

  if (!p) throw httpError("Selected project not found", 400);
  return p._id;
}

async function resolveProjectIdForFilter(projectInput) {
  const val = normalizeToStringId(projectInput);
  if (!val || !val.trim()) return null;
  if (mongoose.Types.ObjectId.isValid(val)) return val;

  const p = await Project.findOne({
    name: { $regex: new RegExp(`^${escapeRegExp(val.trim())}$`, "i") },
  }).select("_id");

  return p ? p._id : null;
}

async function resolveDesignationIdOrThrow(designationInput) {
  const val = normalizeToStringId(designationInput);
  if (!val || !val.trim()) throw httpError("Designation is required", 400);

  if (mongoose.Types.ObjectId.isValid(val)) {
    const d = await Designation.findById(val).select("_id status name");
    if (!d) throw httpError("Selected designation not found", 400);
    if (d.status !== "Active")
      throw httpError("Selected designation is inactive", 400);
    return d._id;
  }

  const d = await Designation.findOne({
    name: { $regex: new RegExp(`^${escapeRegExp(val.trim())}$`, "i") },
  }).select("_id status name");

  if (!d) throw httpError("Selected designation not found", 400);
  if (d.status !== "Active")
    throw httpError("Selected designation is inactive", 400);

  return d._id;
}

async function resolveDesignationIdForFilter(designationInput) {
  const val = normalizeToStringId(designationInput);
  if (!val || !val.trim()) return null;
  if (mongoose.Types.ObjectId.isValid(val)) return val;

  const d = await Designation.findOne({
    name: { $regex: new RegExp(`^${escapeRegExp(val.trim())}$`, "i") },
  }).select("_id");

  return d ? d._id : null;
}

// Create employee with temporary password
const createEmployeeService = async (employeeData) => {
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
  } = employeeData || {};

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

  if (role && !validRoles.includes(role)) {
    throw httpError(`Invalid role. Valid roles: ${validRoles.join(", ")}`, 400);
  }

  const existing = await Employee.findOne({
    $or: [{ employeeId }, { username }, ...(email ? [{ email }] : [])],
  });

  if (existing) {
    throw httpError(
      "Employee with this ID, username, or email already exists",
      409,
    );
  }

  const projectId = await resolveProjectIdOrThrow(project);
  const designationId = await resolveDesignationIdOrThrow(designation);

  // Stronger temporary password
  const tempPassword = crypto.randomBytes(12).toString("hex");

  const employee = new Employee({
    employeeId: String(employeeId).trim(),
    username: String(username).trim(),
    email: email ? String(email).trim() : undefined,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    division,
    project: projectId,
    designation: designationId,
    position,
    role: role || "employee",
    password: tempPassword,
  });

  await employee.save();

  const frontendUrl = process.env.FRONTEND_URL || "http://cto.dictr2.online";

  if (employee.email) {
    try {
      const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2563eb; padding: 20px; text-align: center; color: #fff;">
          <strong>HRMS</strong>
        </div>

        <div style="padding: 20px; color: #1f2937;">
          <h2 style="color: #2563eb; margin-top: 0;">Welcome, ${escapeHtml(firstName)}!</h2>
          <p>Your account has been created.</p>

          <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 40%;">Username:</td>
              <td style="padding: 8px;">${escapeHtml(username)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Temporary Password:</td>
              <td style="padding: 8px;">${escapeHtml(tempPassword)}</td>
            </tr>
          </table>

          <p>Please log in and change your password immediately.</p>

          <a href="${frontendUrl}/login"
            style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 4px;">
            Login
          </a>
        </div>

        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
          HRMS &copy; ${new Date().getFullYear()}
        </div>
      </div>
      `;

      await sendEmail(employee.email, "Your HRMS Account", htmlBody);
    } catch (err) {
      console.error("Failed to send email:", err.message);
    }
  }

  // SECURITY: Don’t return temp password unless explicitly allowed
  const returnTemp = process.env.RETURN_TEMP_PASSWORD === "true";
  return returnTemp ? { employee, tempPassword } : { employee };
};

const getEmployeesService = async ({
  division,
  designation,
  project,
  search,
  page,
  limit,
}) => {
  try {
    const query = {};

    if (division) query.division = division;

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
      const safe = escapeRegExp(q);
      query.$or = [
        { firstName: { $regex: safe, $options: "i" } },
        { lastName: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
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
        .lean(),
      Employee.countDocuments(query),
    ]);

    return {
      data,
      total,
      totalPages: Math.ceil(total / lim),
    };
  } catch (err) {
    const error = httpError("Failed to fetch employees", 500);
    error.originalMessage = err.message;
    throw error;
  }
};

const getEmployeeByIdService = async (id) => {
  const employee = await Employee.findById(id)
    .populate("designation", "name status")
    .populate("project", "name status");

  if (!employee) throw httpError(`Employee with ID ${id} not found`, 404);
  return employee;
};

const signInEmployeeService = async (username, password) => {
  const employee = await Employee.findOne({
    username: String(username).trim(),
  });
  if (!employee) throw httpError("Invalid username or password", 401);

  const isMatch = await employee.comparePassword(password);
  if (!isMatch) throw httpError("Invalid username or password", 401);

  if (!process.env.JWT_SECRET) {
    throw httpError("Server misconfigured: JWT_SECRET is missing", 500);
  }

  const payload = {
    id: employee._id,
    username: employee.username,
    designation: employee.designation,
    role: employee.role,
  };

  // ✅ UPDATED: pull ONLY session settings (separated service)
  const sessionSettings = await getSessionSettings();

  const enabled =
    typeof sessionSettings?.sessionTimeoutEnabled === "boolean"
      ? sessionSettings.sessionTimeoutEnabled
      : true;

  const minutesRaw = Number(sessionSettings?.sessionTimeoutMinutes ?? 0);

  // fallbacks (keep behavior stable even if settings doc is missing/invalid)
  const minutes =
    Number.isFinite(minutesRaw) && minutesRaw > 0
      ? Math.min(Math.max(Math.trunc(minutesRaw), 1), MAX_SESSION_MINUTES)
      : 1440;

  const options = {
    issuer: process.env.JWT_ISSUER || "hrms-api",
    audience: process.env.JWT_AUDIENCE || "hrms-client",
  };

  // ✅ if enabled -> set expiresIn
  // ✅ if disabled -> DO NOT set expiresIn (token won't expire)
  if (enabled) {
    options.expiresIn = minutes * 60; // seconds
  }

  const token = jwt.sign(payload, process.env.JWT_SECRET, options);

  return { token, payload };
};

const updateEmployeeService = async (id, updateData) => {
  const employee = await Employee.findById(id);
  if (!employee) throw httpError(`Employee with ID ${id} not found`, 404);

  if (updateData.employeeId && updateData.employeeId !== employee.employeeId) {
    throw httpError("Employee ID cannot be changed", 400);
  }

  if (updateData.email || updateData.username) {
    const conflict = await Employee.findOne({
      _id: { $ne: id },
      $or: [
        ...(updateData.email ? [{ email: updateData.email }] : []),
        ...(updateData.username ? [{ username: updateData.username }] : []),
      ],
    });

    if (conflict) throw httpError("Email or username already in use", 409);
  }

  if (updateData.project !== undefined) {
    updateData.project = await resolveProjectIdOrThrow(updateData.project);
  }

  if (updateData.designation !== undefined) {
    updateData.designation = await resolveDesignationIdOrThrow(
      updateData.designation,
    );
  }

  Object.keys(updateData).forEach((key) => {
    if (key !== "employeeId") employee[key] = updateData[key];
  });

  await employee.save();
  return employee;
};

const getEmployeeCtoMemos = async (employeeId) => {
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

  formatted.sort((a, b) => new Date(a.dateApproved) - new Date(b.dateApproved));
  return formatted;
};

async function changeEmployeeRole(id, newRole) {
  if (!validRoles.includes(newRole)) {
    throw httpError(`Invalid role. Valid roles: ${validRoles.join(", ")}`, 400);
  }
  const employee = await Employee.findById(id);
  if (!employee) throw httpError("Employee not found", 404);

  employee.role = newRole;
  await employee.save();
  return employee;
}

const getProfile = async (employeeId) => {
  const employee = await Employee.findById(employeeId)
    .select("-password")
    .populate("designation", "name status")
    .populate("project", "name status");

  if (!employee) throw httpError("Employee not found", 404);
  return employee;
};

const updateProfile = async (employeeId, updateData) => {
  const allowedUpdates = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "position",
    "division",
    "project",
    "address",
    "emergencyContact",
  ];

  const filteredData = {};
  allowedUpdates.forEach((field) => {
    if (updateData[field] !== undefined)
      filteredData[field] = updateData[field];
  });

  if (filteredData.email) {
    const conflict = await Employee.findOne({
      _id: { $ne: employeeId },
      email: filteredData.email,
    });
    if (conflict) throw httpError("Email already in use", 409);
  }

  if (filteredData.project !== undefined) {
    filteredData.project = await resolveProjectIdOrThrow(filteredData.project);
  }

  const updatedEmployee = await Employee.findByIdAndUpdate(
    employeeId,
    filteredData,
    {
      new: true,
      runValidators: true,
    },
  )
    .select("-password")
    .populate("designation", "name status")
    .populate("project", "name status");

  if (!updatedEmployee) throw httpError("Employee not found", 404);
  return updatedEmployee;
};

const resetPassword = async (employeeId, oldPassword, newPassword) => {
  if (!newPassword || String(newPassword).length < 8) {
    throw httpError("New password must be at least 8 characters long", 400);
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) throw httpError("Employee not found", 404);

  const isMatch = await employee.comparePassword(oldPassword);
  if (!isMatch) throw httpError("Old password is incorrect", 400);

  employee.password = newPassword;
  await employee.save();

  return { message: "Password updated successfully" };
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
};
