const express = require("express");
const router = express.Router();
const {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} = require("../controllers/roleController");

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware");

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];

// =============================
// ROLES ROUTES
// =============================

// View Roles
router.get("/", ...requirePerm("roles.view"), getRoles);
router.get("/:id", ...requirePerm("roles.view"), getRoleById);

// Manage Roles (Create, Update, Delete)
router.post("/", ...requirePerm("roles.manage"), createRole);
router.put("/:id", ...requirePerm("roles.manage"), updateRole);
router.delete("/:id", ...requirePerm("roles.manage"), deleteRole);

module.exports = router;
