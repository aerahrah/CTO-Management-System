const express = require("express");
const {
  getAllProvincialOffices,
  getProvincialOfficeById,
  createProvincialOffice,
  updateProvincialOffice,
  deleteProvincialOffice,
} = require("../controllers/provincialOfficeController");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middlewares/authMiddleware.js");

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getAllProvincialOffices
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  getProvincialOfficeById
);
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  createProvincialOffice
);
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  updateProvincialOffice
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  deleteProvincialOffice
);

module.exports = router;
