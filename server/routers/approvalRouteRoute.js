// routers/approvalRouteRoute.js
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middlewares/authMiddleware");

const {
  getAllApprovalRoutes,
  getApprovalRouteById,
  createApprovalRoute,
  updateApprovalRoute,
  deleteApprovalRoute,
  upsertMyApprovalRoute,
} = require("../controllers/approvalRouteController");

// Protect all routes
router.use(authenticateToken);

router.get("/", getAllApprovalRoutes);
router.put("/my", upsertMyApprovalRoute);   // MUST be before /:id
router.get("/:id", getApprovalRouteById);
router.post("/", createApprovalRoute);
router.patch("/:id", updateApprovalRoute);
router.delete("/:id", deleteApprovalRoute);

module.exports = router;
