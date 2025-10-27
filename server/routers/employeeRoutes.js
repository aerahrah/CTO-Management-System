const express = require("express");
const router = express.Router();
const {
  createEmployee,
  getEmployees,
  getEmployeeById,
  signInEmployee,
  updateEmployee,
} = require("../controllers/employeeController");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware");

router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  createEmployee
);
router.get("/", authenticateToken, authorizeRoles("admin", "hr"), getEmployees);

router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getEmployeeById
);

router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  updateEmployee
);
router.post("/login", signInEmployee);

module.exports = router;
