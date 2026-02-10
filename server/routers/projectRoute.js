const express = require("express");
const router = express.Router();

const projectController = require("../controllers/projectController");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware.js");

router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  projectController.create,
);
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  projectController.list,
);
router.get(
  "/options",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  projectController.listAll,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  projectController.getOne,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  projectController.update,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  projectController.remove,
);
router.patch(
  "/:id/status",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  projectController.updateStatus,
);

module.exports = router;
