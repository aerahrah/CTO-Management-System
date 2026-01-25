const Employee = require("../models/employeeModel");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const jwt = require("jsonwebtoken");
const CtoCredit = require("../models/ctoCreditModel");
const bcrypt = require("bcrypt");
// Create employee with temporary password
const createEmployeeService = async (employeeData) => {
  const { employeeId, username, email, firstName, lastName, position, role } =
    employeeData;

  // Check for existing employee
  const existing = await Employee.findOne({
    $or: [{ employeeId }, { username }, { email }],
  });
  if (existing) {
    throw new Error("Employee with this ID, username, or email already exists");
  }

  // Generate temporary password
  const tempPassword = crypto.randomBytes(6).toString("hex");

  const employee = new Employee({
    employeeId,
    username,
    email,
    firstName,
    lastName,
    position,
    role,
    password: tempPassword,
  });

  await employee.save();

  // Send email if email is provided
  if (email) {
    await sendEmail(
      email,
      "Your HRMS Account",
      `Hello ${firstName},\n\nYour account has been created.\nUsername: ${username}\nTemporary Password: ${tempPassword}\n\nPlease log in and change your password immediately.`,
    );
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
  const query = {};

  // Filters
  if (division) {
    query.division = division;
  }

  if (designation) {
    query.designation = designation;
  }

  if (project) {
    query.project = project;
  }

  // Search by name (firstName or lastName)
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Employee.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ lastName: 1, firstName: 1 }),
    Employee.countDocuments(query),
  ]);

  return {
    data,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

// Get employee by ID
const getEmployeeByIdService = async (id) => {
  const employee = await Employee.findById(id);
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
        { _id: { $ne: id } }, // exclude current employee
        {
          $or: [{ email: updateData.email }, { username: updateData.username }],
        },
      ],
    });

    if (conflict) {
      throw new Error("Email or username already in use");
    }
  }

  // ✅ Dynamically update allowed fields only
  Object.keys(updateData).forEach((key) => {
    if (key !== "employeeId") {
      // Skip employeeId
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

  // Optional: sort oldest to newest
  formatted.sort((a, b) => new Date(a.dateApproved) - new Date(b.dateApproved));

  return formatted;
};

const validRoles = ["employee", "supervisor", "hr", "admin"];

async function changeEmployeeRole(id, newRole) {
  if (!validRoles.includes(newRole)) {
    throw new Error(`Invalid role. Valid roles: ${validRoles.join(", ")}`);
  }

  const employee = await Employee.findById(id);
  if (!employee) {
    throw new Error("Employee not found");
  }

  // Update role
  employee.role = newRole;
  await employee.save();

  return employee;
}
const getProfile = async (employeeId) => {
  const employee = await Employee.findById(employeeId).select("-password");
  if (!employee) throw new Error("Employee not found");
  return employee;
};

const updateProfile = async (employeeId, updateData) => {
  // Only allow certain fields to be updated
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

  const updatedEmployee = await Employee.findByIdAndUpdate(
    employeeId,
    filteredData,
    { new: true, runValidators: true },
  ).select("-password");

  if (!updatedEmployee) throw new Error("Employee not found");
  return updatedEmployee;
};

const resetPassword = async (employeeId, oldPassword, newPassword) => {
  const employee = await Employee.findById(employeeId);
  if (!employee) throw new Error("Employee not found");

  // Verify old password
  const isMatch = await bcrypt.compare(oldPassword, employee.password);
  if (!isMatch) throw new Error("Old password is incorrect");

  // Set new password (hashed automatically by pre-save hook)
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
