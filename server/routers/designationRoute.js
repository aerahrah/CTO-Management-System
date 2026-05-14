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
  authorize,
} = require("../middlewares/authMiddleware.js");

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  authorize("settings.edit"),
  getAllDesignations,
);

router.get("/options", authenticateToken, authorize("settings.edit"), listAll);

router.get(
  "/:id",
  authenticateToken,
  authorize("settings.edit"),
  getDesignationById,
);

router.post(
  "/",
  authenticateToken,
  authorize("settings.edit"),
  createDesignation,
);

router.put(
  "/:id",
  authenticateToken,
  authorize("settings.edit"),
  updateDesignation,
);

router.patch(
  "/:id/status",
  authenticateToken,
  authorize("settings.edit"),
  updateStatus,
);

router.delete(
  "/:id",
  authenticateToken,
  authorize("settings.edit"),
  deleteDesignation,
);

module.exports = router;
