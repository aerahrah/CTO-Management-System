// controllers/employeeController.js
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
  adminResetPasswordService,
  getEmployeeWellnessBalanceService,
  uploadSignatureService,
} = require("../services/employeeService");

function sendError(res, err) {
  const status = err.statusCode || err.status || 500;
  return res.status(status).json({
    success: false,
    message: err.message || "Server error",
    detail: err.originalMessage || null,
  });
}

const createEmployee = async (req, res) => {
  try {
    const result = await createEmployeeService(req.body);

    const employee = result.employee;
    const tempPassword = result.tempPassword;

    const response = {
      message: "Employee created",
      data: {
        id: employee._id,
        email: employee.email,
        ...(tempPassword ? { tempPassword } : {}),
      },
    };

    return res.status(201).json(response);
  } catch (err) {
    return sendError(res, err);
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
      limit = 20,
    } = req.query;

    const allowedLimits = [20, 50, 100];
    const parsedLimit = allowedLimits.includes(Number(limit))
      ? Number(limit)
      : 20;
    const parsedPage = Number(page) > 0 ? Number(page) : 1;

    const result = await getEmployeesService({
      division,
      designation,
      project,
      search,
      page: parsedPage,
      limit: parsedLimit,
    });

    return res.status(200).json({
      success: true,
      count: result.data.length,
      total: result.total,
      page: parsedPage,
      totalPages: result.totalPages,
      data: result.data,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const employee = await getEmployeeByIdService(req.params.id);
    return res.status(200).json({ success: true, data: employee });
  } catch (err) {
    return sendError(res, err);
  }
};

const signInEmployee = async (req, res) => {
  try {
    const { token, payload } = await signInEmployeeService(
      req.body.email,
      req.body.password,
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({ message: "Login successful", admin: payload });
  } catch (err) {
    return res.status(err.statusCode || 401).json({ message: err.message });
  }
};

const logoutEmployee = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    return sendError(res, err);
  }
};

const updateEmployee = async (req, res) => {
  try {
    const employee = await updateEmployeeService(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: employee,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

const getEmployeeCtoMemosById = async (req, res) => {
  try {
    const employeeId = req.params.id;
    const memos = await getEmployeeCtoMemos(employeeId);
    return res.status(200).json({ memos });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch CTO memos" });
  }
};

const getMyCtoMemos = async (req, res) => {
  try {
    const employeeId = req.user?.id;
    if (!employeeId) return res.status(401).json({ message: "Unauthorized" });

    const memos = await getEmployeeCtoMemos(employeeId);
    return res.status(200).json({ memos });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch your CTO memos" });
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
    return sendError(res, error);
  }
};

const getMyProfile = async (req, res) => {
  try {
    const employeeId = req.user?.id;
    if (!employeeId) return res.status(401).json({ error: "Unauthorized" });

    const employee = await getProfile(employeeId);
    return res.json(employee);
  } catch (err) {
    return sendError(res, err);
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const employeeId = req.user?.id;
    if (!employeeId) return res.status(401).json({ error: "Unauthorized" });

    const updatedEmployee = await updateProfile(employeeId, req.body);
    return res.json(updatedEmployee);
  } catch (err) {
    return sendError(res, err);
  }
};

const uploadSignature = async (req, res) => {
  try {
    const employeeId = req.user?.id;
    if (!employeeId) return res.status(401).json({ error: "Unauthorized" });

    if (!req.file) {
      return res.status(400).json({ error: "No signature file provided" });
    }

    const signaturePath = req.file.path.replace(/\\/g, "/");
    const updatedEmployee = await uploadSignatureService(
      employeeId,
      signaturePath,
    );

    return res.json({
      success: true,
      message: "Signature uploaded successfully",
      data: updatedEmployee,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

const resetMyPassword = async (req, res) => {
  try {
    const employeeId = req.user?.id;
    if (!employeeId) return res.status(401).json({ error: "Unauthorized" });

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Old and new passwords are required" });
    }

    const result = await resetPassword(employeeId, oldPassword, newPassword);
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
};

// ✅ Admin/HR: reset another employee's password by email
// Body: { email: string, notify?: boolean }  (notify defaults to true)
const adminResetEmployeePassword = async (req, res) => {
  try {
    const actorId = req.user?.id;
    if (!actorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { email, notify } = req.body || {};
    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Employee email is required" });
    }

    const result = await adminResetPasswordService({
      actorId,
      email,
      notify: notify !== false,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        employee: result.employee,
        delivered: result.delivered,
        // Only present when the temp password could not be emailed/texted
        ...(result.tempPassword ? { tempPassword: result.tempPassword } : {}),
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
};

const getEmployeeWellnessBalanceById = async (req, res) => {
  try {
    const employeeId = req.params.id;
    const wellnessDays = await getEmployeeWellnessBalanceService(employeeId);
    return res.status(200).json({ success: true, data: { wellnessDays } });
  } catch (err) {
    return sendError(res, err);
  }
};

const getMyWellnessBalance = async (req, res) => {
  try {
    const employeeId = req.user?.id;
    if (!employeeId) return res.status(401).json({ message: "Unauthorized" });

    const wellnessDays = await getEmployeeWellnessBalanceService(employeeId);
    return res.status(200).json({ success: true, data: { wellnessDays } });
  } catch (err) {
    return sendError(res, err);
  }
};

module.exports = {
  updateRole,
  updateEmployee,
  createEmployee,
  getEmployees,
  getEmployeeById,
  signInEmployee,
  logoutEmployee,
  getEmployeeCtoMemosById,
  getMyCtoMemos,
  getMyProfile,
  updateMyProfile,
  uploadSignature,
  resetMyPassword,
  adminResetEmployeePassword,
  getEmployeeWellnessBalanceById,
  getMyWellnessBalance,
};
