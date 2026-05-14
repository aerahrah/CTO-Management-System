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

/* =======================
   AUTH & SELF ROUTES FIRST
   ======================= */
router.post("/login", signInEmployee);

router.get("/my-profile", authenticateToken, getMyProfile);
router.put("/my-profile", authenticateToken, updateMyProfile);
router.put("/my-profile/reset-password", authenticateToken, resetMyPassword);

router.get("/memos/me", authenticateToken, getMyCtoMemos);

// ✅ NEW: Get own wellness balance
router.get("/my-wellness-balance", authenticateToken, getMyWellnessBalance);

/* =======================
   ADMIN / HR ROUTES
   ======================= */
router.post(
  "/",
  authenticateToken,
  authorize("employees.create"),
  createEmployee,
);

router.get("/", authenticateToken, authorize("employees.view"), getEmployees);

router.put(
  "/:id",
  authenticateToken,
  authorize("employees.edit"),
  updateEmployee,
);

router.post(
  "/:id/role",
  authenticateToken,
  authorize("employees.edit"),
  updateRole,
);

router.get(
  "/memos/:id",
  authenticateToken,
  authorize("cto.view_all"),
  getEmployeeCtoMemosById,
);

// ✅ NEW: Get a specific employee's wellness balance (requires authorization)
router.get(
  "/:id/wellness-balance",
  authenticateToken,
  authorize("employees.view"),
  getEmployeeWellnessBalanceById,
);

router.get(
  "/:id",
  authenticateToken,
  authorize("employees.view"),
  getEmployeeById,
);

module.exports = router;
