const express = require("express");
const router = express.Router();

const projectController = require("../controllers/projectController");

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware.js");

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];
const authOnly = [authenticateToken];

// =============================
// PROJECT MANAGEMENT (CRUD)
// =============================

router.post("/", ...requirePerm("projects.manage"), projectController.create);

// Paginated/Filtered list for the Settings Table
router.get("/", ...requirePerm("projects.manage"), projectController.list);

router.get("/:id", ...requirePerm("projects.manage"), projectController.getOne);

router.patch(
  "/:id",
  ...requirePerm("projects.manage"),
  projectController.update,
);

router.delete(
  "/:id",
  ...requirePerm("projects.manage"),
  projectController.remove,
);

router.patch(
  "/:id/status",
  ...requirePerm("projects.manage"),
  projectController.updateStatus,
);

// =============================
// SHARED RESOURCES
// =============================

// Dropdown Options: Any authenticated user (like HR adding an employee)
// needs to be able to fetch the list of project names/IDs for forms.
router.get("/options", ...authOnly, projectController.listAll);

module.exports = router;
