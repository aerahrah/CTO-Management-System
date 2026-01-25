const {
  createEmployeeService,
  getEmployeesService,
  getEmployeeByIdService,
  signInEmployeeService,
  updateEmployeeService,
  getEmployeeCtoMemos,
  changeEmployeeRole,
  getProfile,
  updateProfile,
  resetPassword,
} = require("../services/employeeService");

const createEmployee = async (req, res) => {
  try {
    const { employee, tempPassword } = await createEmployeeService(req.body);

    res.status(201).json({
      message: "Employee created with temporary password",
      data: {
        id: employee._id,
        username: employee.username,
        email: employee.email,
        tempPassword,
      },
    });
  } catch (err) {
    console.error("Error creating employee:", err.message);
    res.status(400).json({ message: err.message });
  }
};

const getEmployees = async (req, res) => {
  try {
    const {
      division,
      designation,
      project,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    // Allowed page size options
    const allowedLimits = [10, 20, 50, 100];
    const parsedLimit = allowedLimits.includes(Number(limit))
      ? Number(limit)
      : 10;

    const parsedPage = Number(page) > 0 ? Number(page) : 1;

    const result = await getEmployeesService({
      division,
      designation,
      project,
      search,
      page: parsedPage,
      limit: parsedLimit,
    });

    res.status(200).json({
      success: true,
      count: result.data.length,
      total: result.total,
      page: parsedPage,
      totalPages: result.totalPages,
      data: result.data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const employee = await getEmployeeByIdService(req.params.id);
    res.status(200).json({ success: true, data: employee });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

const signInEmployee = async (req, res) => {
  try {
    const { token, payload } = await signInEmployeeService(
      req.body.username,
      req.body.password,
    );

    res.json({ message: "Login successful", token, admin: payload });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const employee = await updateEmployeeService(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: employee,
    });
  } catch (err) {
    console.error("Error updating employee:", err.message);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Controller to fetch all CTO memos for the authenticated employee
 */
const getEmployeeCtoMemosById = async (req, res) => {
  try {
    const employeeId = req.params.id;
    const memos = await getEmployeeCtoMemos(employeeId);
    res.status(200).json({ memos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch CTO memos" });
  }
};

const getMyCtoMemos = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const memos = await getEmployeeCtoMemos(employeeId);
    res.status(200).json({ memos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch your CTO memos" });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!id || !role) {
      return res
        .status(400)
        .json({ message: "Employee ID and role are required" });
    }

    const updatedEmployee = await changeEmployeeRole(id, role);

    return res.status(200).json({
      message: "Role updated successfully",
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const employee = await getProfile(req.user.id);
    console.log(req.user.id);
    res.json(employee);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const updatedEmployee = await updateProfile(req.user.id, req.body);
    res.json(updatedEmployee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const resetMyPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Old and new passwords are required" });
    }

    const result = await resetPassword(req.user.id, oldPassword, newPassword);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  updateRole,
  updateEmployee,
  createEmployee,
  getEmployees,
  getEmployeeById,
  signInEmployee,
  getEmployeeCtoMemosById,
  getMyCtoMemos,
  getMyProfile,
  updateMyProfile,
  resetMyPassword,
};
