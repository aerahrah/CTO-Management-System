// routes/designation.routes.js
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
  authorizeRoles,
} = require("../middlewares/authMiddleware.js");

const router = express.Router();

/**
 * ✅ LIST (paginated)
 * GET /settings/provincial-office?status=Active&page=1&limit=20|50|100
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getAllDesignations,
);

/**
 * ✅ OPTIONS (no pagination; for dropdown)
 * GET /settings/provincial-office/options?status=Active
 */
router.get(
  "/options",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  listAll,
);

/**
 * ✅ GET by id
 * GET /settings/provincial-office/:id
 */
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getDesignationById,
);

/**
 * ✅ CREATE
 * POST /settings/provincial-office
 * body: { name: string, status?: "Active"|"Inactive" }
 */
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  createDesignation,
);

/**
 * ✅ UPDATE (partial-like behavior even if you keep PUT)
 * PUT /settings/provincial-office/:id
 * body: { name?: string, status?: "Active"|"Inactive" }
 */
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  updateDesignation,
);

/**
 * ✅ UPDATE STATUS (single endpoint)
 * PATCH /settings/provincial-office/:id/status
 * body: { status: "Active"|"Inactive" }
 */
router.patch(
  "/:id/status",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  updateStatus,
);

/**
 * ✅ DELETE
 * DELETE /settings/provincial-office/:id
 */
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  deleteDesignation,
);

module.exports = router;
