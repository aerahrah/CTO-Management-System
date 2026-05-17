const express = require("express");
const {
  getAllDesignations,
  listAll,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  updateStatus,
} = require("../controllers/designationController.js");

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware.js");

const router = express.Router();

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];
const authOnly = [authenticateToken];

// =============================
// DESIGNATION MANAGEMENT (CRUD)
// =============================

router.post("/", ...requirePerm("designations.manage"), createDesignation);

router.get("/", ...requirePerm("designations.manage"), getAllDesignations);

router.get("/:id", ...requirePerm("designations.manage"), getDesignationById);

router.put("/:id", ...requirePerm("designations.manage"), updateDesignation);

router.patch(
  "/:id/status",
  ...requirePerm("designations.manage"),
  updateStatus,
);

router.delete("/:id", ...requirePerm("designations.manage"), deleteDesignation);

// =============================
// SHARED RESOURCES
// =============================

// Dropdown Options: Any authenticated user (like HR adding an employee)
// needs to be able to fetch the list of designations for forms.
router.get("/options", ...authOnly, listAll);

module.exports = router;
