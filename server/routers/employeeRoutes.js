const express = require("express");
const router = express.Router();
const {
  createEmployee,
  getEmployees,
  getEmployeeById,
  signInEmployee,
  updateEmployee,
  getEmployeeCtoMemosById,
  getMyCtoMemos,
  updateRole,
  getMyProfile,
  updateMyProfile,
  resetMyPassword,
  getEmployeeWellnessBalanceById,
  getMyWellnessBalance,
} = require("../controllers/employeeController");

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware");

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];

/* =======================
   PUBLIC ROUTES
   ======================= */
router.post("/login", signInEmployee);

/* =======================
   SELF-SERVICE ROUTES
   ======================= */
// Profile Management
router.get("/my-profile", ...requirePerm("employees.view_self"), getMyProfile);
router.put(
  "/my-profile",
  ...requirePerm("employees.edit_self"),
  updateMyProfile,
);
router.put(
  "/my-profile/reset-password",
  ...requirePerm("employees.reset_password_self"),
  resetMyPassword,
);

// Leaves & Balances (Self)
router.get("/memos/me", ...requirePerm("cto.view_self"), getMyCtoMemos);
router.get(
  "/my-wellness-balance",
  ...requirePerm("wellness.view_self"),
  getMyWellnessBalance,
);

/* =======================
   ADMIN / HR ROUTES
   ======================= */
// Employee Management (CRUD)
router.get("/", ...requirePerm("employees.view"), getEmployees);
router.post("/", ...requirePerm("employees.create"), createEmployee);
router.get("/:id", ...requirePerm("employees.view"), getEmployeeById);
router.put("/:id", ...requirePerm("employees.edit"), updateEmployee);

// Update Employee Role (Requires edit permissions on the employee)
router.post("/:id/role", ...requirePerm("employees.change_role"), updateRole);

// View Employee Specific Balances & Memos
// Note: We updated the memo route to use the new cto.records_view permission instead of the broad cto.view_all
router.get(
  "/memos/:id",
  ...requirePerm("cto.records_view"),
  getEmployeeCtoMemosById,
);
router.get(
  "/:id/wellness-balance",
  ...requirePerm("employees.view"),
  getEmployeeWellnessBalanceById,
);

module.exports = router;
