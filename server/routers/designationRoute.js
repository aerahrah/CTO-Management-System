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


router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getAllDesignations,
);

router.get(
  "/options",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  listAll,
);


router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getDesignationById,
);

router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  createDesignation,
);


router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  updateDesignation,
);

router.patch(
  "/:id/status",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  updateStatus,
);


router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  deleteDesignation,
);

module.exports = router;
