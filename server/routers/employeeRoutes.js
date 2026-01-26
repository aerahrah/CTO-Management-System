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
} = require("../controllers/employeeController");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware");

/* =======================
   AUTH & SELF ROUTES FIRST
   ======================= */
router.post("/login", signInEmployee);

router.get("/my-profile", authenticateToken, getMyProfile);
router.put("/my-profile", authenticateToken, updateMyProfile);
router.put("/my-profile/reset-password", authenticateToken, resetMyPassword);

router.get(
  "/memos/me",
  authenticateToken,
  authorizeRoles("admin", "hr", "employee"),
  getMyCtoMemos,
);

/* =======================
   ADMIN / HR ROUTES
   ======================= */
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  createEmployee,
);

router.get("/", authenticateToken, authorizeRoles("admin", "hr"), getEmployees);

router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  updateEmployee,
);

router.post(
  "/:id/role",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  updateRole,
);

router.get(
  "/memos/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getEmployeeCtoMemosById,
);

router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getEmployeeById,
);

module.exports = router;
