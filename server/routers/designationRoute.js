const express = require("express");
const {
  getAllDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation,
} = require("../controllers/designationController.js");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware.js");

const router = express.Router();

// GET all designations
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getAllDesignations
);

// GET designation by ID
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getDesignationById
);

// CREATE a new designation
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  createDesignation
);

// UPDATE designation
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  updateDesignation
);

// DELETE designation
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  deleteDesignation
);

module.exports = router;
