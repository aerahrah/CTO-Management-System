const Employee = require("../models/employeeModel");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const jwt = require("jsonwebtoken");

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
      `Hello ${firstName},\n\nYour account has been created.\nUsername: ${username}\nTemporary Password: ${tempPassword}\n\nPlease log in and change your password immediately.`
    );
  }

  return {
    employee,
    tempPassword,
  };
};

// Get all employees
const getEmployeesService = async () => {
  return await Employee.find();
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
    provincialOffice: employee.provincialOffice,
    role: employee.role,
  };

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET || "supersecretkey123",
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );

  return { token, payload };
};

const updateEmployeeService = async (id, updateData) => {
  const employee = await Employee.findById(id);
  if (!employee) {
    throw new Error(`Employee with ID ${id} not found`);
  }

  // ❌ Prevent changing employeeId
  if (updateData.employeeId && updateData.employeeId !== employee.employeeId) {
    throw new Error("Employee ID cannot be changed");
  }

  // ✅ Check for unique username or email only
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

module.exports = {
  updateEmployeeService,
  createEmployeeService,
  getEmployeesService,
  getEmployeeByIdService,
  signInEmployeeService,
};
