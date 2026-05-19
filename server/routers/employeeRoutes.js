const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const {
  createEmployee,
  getEmployees,
  getEmployeeById,
  logoutEmployee,
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
// LOGIN RATE LIMITER
// =============================
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // IMPORTANT: keep low for login security

  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    // normalize username so "Admin" and "admin" are same bucket
    return (req.body.username || "unknown").toLowerCase().trim();
  },

  skipSuccessfulRequests: true,

  handler: (req, res) => {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);

    const minutes = Math.floor(retryAfter / 60);
    const seconds = retryAfter % 60;

    res.status(429).json({
      message: `Too many login attempts for this account. Try again in ${minutes}m ${seconds}s.`,
      retryAfterSeconds: retryAfter,
    });
  },
});

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];

/* =======================
   PUBLIC ROUTES
   ======================= */

// ✅ Protected login route
router.post("/login", loginLimiter, signInEmployee);

router.post("/logout", authenticateToken, logoutEmployee);

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

// Update Employee Role
router.post("/:id/role", ...requirePerm("employees.change_role"), updateRole);

// View Employee Specific Balances & Memos
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
