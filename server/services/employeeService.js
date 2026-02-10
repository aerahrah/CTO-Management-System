const Employee = require("../models/employeeModel");
const Project = require("../models/projectModel"); // ✅ NEW
const mongoose = require("mongoose"); // ✅ NEW

const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const jwt = require("jsonwebtoken");
const CtoCredit = require("../models/ctoCreditModel");
const bcrypt = require("bcrypt");

const validRoles = ["employee", "supervisor", "hr", "admin"];

/* -------------------- helpers -------------------- */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeToStringId(value) {
  if (!value) return null;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

/**
 * Resolve project input (id or name) -> ObjectId
 * Throws if not found (good for create/update).
 */
async function resolveProjectIdOrThrow(projectInput) {
  const val = normalizeToStringId(projectInput);

  if (!val || !val.trim()) throw new Error("Project is required");

  // If it's an ObjectId, validate existence
  if (mongoose.Types.ObjectId.isValid(val)) {
    const p = await Project.findById(val).select("_id status name");
    if (!p) throw new Error("Selected project not found");
    return p._id;
  }

  // Else treat as project name (case-insensitive exact)
  const p = await Project.findOne({
    name: { $regex: new RegExp(`^${escapeRegExp(val.trim())}$`, "i") },
  }).select("_id status name");

  if (!p) throw new Error("Selected project not found");
  return p._id;
}

/**
 * Resolve project filter (id or name) -> ObjectId or null
 * Does NOT throw (good for filtering list endpoints).
 */
async function resolveProjectIdForFilter(projectInput) {
  const val = normalizeToStringId(projectInput);
  if (!val || !val.trim()) return null;

  if (mongoose.Types.ObjectId.isValid(val)) return val;

  const p = await Project.findOne({
    name: { $regex: new RegExp(`^${escapeRegExp(val.trim())}$`, "i") },
  }).select("_id");

  return p ? p._id : null;
}

/* -------------------- services -------------------- */

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
  } = employeeData;

  // Check for existing employee
  const existing = await Employee.findOne({
    $or: [{ employeeId }, { username }, { email }],
  });
  if (existing) {
    throw new Error("Employee with this ID, username, or email already exists");
  }

  // ✅ Resolve project to ObjectId
  const projectId = await resolveProjectIdOrThrow(project);

  // Generate temporary password
  const tempPassword = crypto.randomBytes(6).toString("hex");

  const employee = new Employee({
    employeeId,
    username,
    email,
    firstName,
    lastName,
    division,
    project: projectId, // ✅ store ObjectId
    designation,
    position,
    role,
    password: tempPassword,
  });

  await employee.save();

  // Send email if email is provided
  if (email) {
    try {
      const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2563eb; padding: 20px; text-align: center;">
          <img src="https://yourdomain.com/logo.png" alt="DICT Logo" style="height: 50px;" />
        </div>

        <div style="padding: 20px; color: #1f2937;">
          <h2 style="color: #2563eb; margin-top: 0;">Welcome to DICT HRMS, ${firstName}!</h2>
          <p>Your account has been successfully created.</p>

          <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 40%;">Username:</td>
              <td style="padding: 8px;">${username}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Temporary Password:</td>
              <td style="padding: 8px;">${tempPassword}</td>
            </tr>
          </table>

          <p style="margin-top: 20px;">Please log in and change your password immediately to secure your account.</p>

          <a href="https://your-hrms-domain.com/login" 
            style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin-top: 10px;">
            Login to HRMS
          </a>
        </div>

        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
          DICT HRMS &copy; ${new Date().getFullYear()}. All rights reserved.
        </div>
      </div>
    `;

      await sendEmail(email, "Your DICT HRMS Account", htmlBody);
    } catch (err) {
      console.error("Failed to send email:", err.message);
    }
  }

  return {
    employee,
    tempPassword,
  };
};

// Get all employees
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

    // Filters
    if (division) query.division = division;
    if (designation) query.designation = designation;

    // ✅ project filter supports projectId OR project name
    if (project) {
      const projectId = await resolveProjectIdForFilter(project);
      if (!projectId) {
        return { data: [], total: 0, totalPages: 0 };
      }
      query.project = projectId;
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const projection = {
      firstName: 1,
      lastName: 1,
      email: 1,
      designation: 1,
      division: 1,
      project: 1,
      role: 1,
      status: 1,
    };

    const [data, total] = await Promise.all([
      Employee.find(query, projection)
        .skip(skip)
        .limit(limit)
        .sort({ lastName: 1, firstName: 1 })
        .populate("designation", "name")
        .populate("project", "name status") // ✅ NEW populate
        .lean(),
      Employee.countDocuments(query),
    ]);

    return {
      data,
      total,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    const error = new Error("Failed to fetch employees");
    error.statusCode = 500;
    error.originalMessage = err.message;
    throw error;
  }
};

// Get employee by ID
const getEmployeeByIdService = async (id) => {
  const employee = await Employee.findById(id)
    .populate("designation", "name")
    .populate("project", "name status"); // ✅ NEW

  if (!employee) {
    throw new Error(`Employee with ID ${id} not found`);
  }
  return employee;
};

// Sign in employee
const signInEmployeeService = async (username, password) => {
  const employee = await Employee.findOne({ username });
  if (!employee) throw new Error("Invalid username or password");

  const isMatch = await employee.comparePassword(password);
  if (!isMatch) throw new Error("Invalid username or password");

  const payload = {
    id: employee._id,
    username: employee.username,
    designation: employee.designation,
    role: employee.role,
  };

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET || "supersecretkey123",
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    },
  );

  return { token, payload };
};

const updateEmployeeService = async (id, updateData) => {
  const employee = await Employee.findById(id);
  if (!employee) {
    throw new Error(`Employee with ID ${id} not found`);
  }

  if (updateData.employeeId && updateData.employeeId !== employee.employeeId) {
    throw new Error("Employee ID cannot be changed");
  }

  if (updateData.email || updateData.username) {
    const conflict = await Employee.findOne({
      $and: [
        { _id: { $ne: id } },
        {
          $or: [{ email: updateData.email }, { username: updateData.username }],
        },
      ],
    });

    if (conflict) {
      throw new Error("Email or username already in use");
    }
  }

  // ✅ if project is being updated, resolve it first
  if (updateData.project !== undefined) {
    updateData.project = await resolveProjectIdOrThrow(updateData.project);
  }

  // Dynamically update allowed fields only
  Object.keys(updateData).forEach((key) => {
    if (key !== "employeeId") {
      employee[key] = updateData[key];
    }
  });

  await employee.save();
  return employee;
};

const getEmployeeCtoMemos = async (employeeId) => {
  const memos = await CtoCredit.find({ "employees.employee": employeeId })
    .populate("employees.employee", "firstName lastName")
    .exec();

  const formatted = memos.map((memo) => {
    const empData = memo.employees.find(
      (e) => e.employee._id.toString() === employeeId,
    );

    return {
      id: memo._id,
      memoNo: memo.memoNo,
      dateApproved: memo.dateApproved,
      uploadedMemo: `/uploads/cto_memos/${memo.uploadedMemo
        .split(/[/\\]/)
        .pop()}`,
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
    throw new Error(`Invalid role. Valid roles: ${validRoles.join(", ")}`);
  }

  const employee = await Employee.findById(id);
  if (!employee) throw new Error("Employee not found");

  employee.role = newRole;
  await employee.save();

  return employee;
}

const getProfile = async (employeeId) => {
  const employee = await Employee.findById(employeeId)
    .select("-password")
    .populate("designation", "name")
    .populate("project", "name status"); // ✅ NEW

  if (!employee) throw new Error("Employee not found");
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

  // ✅ resolve project if included
  if (filteredData.project !== undefined) {
    filteredData.project = await resolveProjectIdOrThrow(filteredData.project);
  }

  const updatedEmployee = await Employee.findByIdAndUpdate(
    employeeId,
    filteredData,
    { new: true, runValidators: true },
  )
    .select("-password")
    .populate("designation", "name")
    .populate("project", "name status");

  if (!updatedEmployee) throw new Error("Employee not found");
  return updatedEmployee;
};

const resetPassword = async (employeeId, oldPassword, newPassword) => {
  const employee = await Employee.findById(employeeId);
  if (!employee) throw new Error("Employee not found");

  const isMatch = await bcrypt.compare(oldPassword, employee.password);
  if (!isMatch) throw new Error("Old password is incorrect");

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
