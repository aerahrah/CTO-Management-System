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

// All role routes require authentication and settings.edit permissions
// Alternatively, we could create a roles.manage permission, but settings.edit is fine for now.
router.use(authenticateToken);
router.use(authorize("settings.edit"));

router.get("/", getRoles);
router.post("/", createRole);
router.get("/:id", getRoleById);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

module.exports = router;
