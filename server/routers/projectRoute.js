const express = require("express");
const router = express.Router();

const projectController = require("../controllers/projectController");

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware.js");

router.post(
  "/",
  authenticateToken,
  authorize("settings.edit"),
  projectController.create,
);
router.get(
  "/",
  authenticateToken,
  authorize("settings.edit"),
  projectController.list,
);
router.get(
  "/options",
  authenticateToken,
  authorize("settings.edit"),
  projectController.listAll,
);
router.get(
  "/:id",
  authenticateToken,
  authorize("settings.edit"),
  projectController.getOne,
);
router.patch(
  "/:id",
  authenticateToken,
  authorize("settings.edit"),
  projectController.update,
);
router.delete(
  "/:id",
  authenticateToken,
  authorize("settings.edit"),
  projectController.remove,
);
router.patch(
  "/:id/status",
  authenticateToken,
  authorize("settings.edit"),
  projectController.updateStatus,
);

module.exports = router;
