const {
  createEmployeeService,
  getEmployeesService,
  getEmployeeByIdService,
  signInEmployeeService,
  updateEmployeeService,
  getEmployeeCtoMemos,
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
    const employees = await getEmployeesService();
    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
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
      req.body.password
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

module.exports = {
  updateEmployee,
  createEmployee,
  getEmployees,
  getEmployeeById,
  signInEmployee,
  getEmployeeCtoMemosById,
  getMyCtoMemos,
};
