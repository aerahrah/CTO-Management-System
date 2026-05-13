// controllers/approvalRouteController.js
const {
  getAllApprovalRoutesService,
  getApprovalRouteByIdService,
  createApprovalRouteService,
  updateApprovalRouteService,
  deleteApprovalRouteService,
  upsertMyApprovalRouteService,
} = require("../services/approvalRoute.service");

function sendError(res, err) {
  const status = err.statusCode || err.status || 500;
  return res.status(status).json({ message: err.message || "Server error" });
}

// GET /api/approval-routes
const getAllApprovalRoutes = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const routes = await getAllApprovalRoutesService({ requesterId });
    return res.json({ success: true, count: routes.length, data: routes });
  } catch (err) {
    return sendError(res, err);
  }
};

// GET /api/approval-routes/:id
const getApprovalRouteById = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const route = await getApprovalRouteByIdService({ id, requesterId });
    return res.json({ success: true, data: route });
  } catch (err) {
    return sendError(res, err);
  }
};

// POST /api/approval-routes
const createApprovalRoute = async (req, res) => {
  try {
    const createdBy = req.user?.id;
    if (!createdBy) return res.status(401).json({ message: "Unauthorized" });

    const route = await createApprovalRouteService({
      data: req.body,
      createdBy,
    });

    return res.status(201).json({
      success: true,
      message: "Approval route created successfully.",
      data: route,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// PATCH /api/approval-routes/:id
const updateApprovalRoute = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const isAdmin = ["admin", "hr"].includes(req.user?.role);

    const route = await updateApprovalRouteService({
      id,
      data: req.body,
      requesterId,
      isAdmin,
    });

    return res.json({
      success: true,
      message: "Approval route updated successfully.",
      data: route,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// DELETE /api/approval-routes/:id
const deleteApprovalRoute = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const isAdmin = ["admin", "hr"].includes(req.user?.role);

    const result = await deleteApprovalRouteService({
      id,
      requesterId,
      isAdmin,
    });

    return res.json({
      success: true,
      message: "Approval route deleted successfully.",
      ...result,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

// PUT /api/approval-routes/my  — upsert personal route (create or update atomically)
const upsertMyApprovalRoute = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    if (!requesterId) return res.status(401).json({ message: "Unauthorized" });

    const route = await upsertMyApprovalRouteService({
      data: req.body,
      requesterId,
    });

    return res.json({
      success: true,
      message: "Personal workflow saved.",
      data: route,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

module.exports = {
  getAllApprovalRoutes,
  getApprovalRouteById,
  createApprovalRoute,
  updateApprovalRoute,
  deleteApprovalRoute,
  upsertMyApprovalRoute,
};
