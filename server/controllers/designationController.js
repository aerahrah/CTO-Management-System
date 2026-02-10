// controllers/designationController.js
const designationService = require("../services/designation.service");

function sendError(res, err) {
  const status = err.statusCode || err.status || 500;
  return res.status(status).json({
    message: err.message || "Server error",
  });
}

async function getAllDesignations(req, res) {
  try {
    const result = await designationService.listDesignations(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

/**
 * GET /settings/designation/options?status=Active
 */
async function listAll(req, res) {
  try {
    const result = await designationService.listAllDesignations(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

async function getDesignationById(req, res) {
  try {
    const designation = await designationService.getDesignationById(
      req.params.id,
    );
    return res.status(200).json(designation);
  } catch (err) {
    return sendError(res, err);
  }
}

async function createDesignation(req, res) {
  try {
    const created = await designationService.createDesignation(req.body);

    // optional: for audit middleware
    req.auditTarget = `${created.name} (id: ${created._id})`;

    return res.status(201).json({
      message: "Designation created successfully.",
      data: created,
    });
  } catch (err) {
    return sendError(res, err);
  }
}

async function updateDesignation(req, res) {
  try {
    // attach BEFORE for audit
    try {
      const before = await designationService.getDesignationById(req.params.id);
      req.auditBeforeDesignation = { name: before.name, status: before.status };
      req.auditTarget = `${before.name} (id: ${before._id})`;
    } catch (_) {}

    const updated = await designationService.updateDesignation(
      req.params.id,
      req.body,
    );

    return res.status(200).json({
      message: "Designation updated successfully.",
      data: updated,
    });
  } catch (err) {
    return sendError(res, err);
  }
}

async function deleteDesignation(req, res) {
  try {
    try {
      const before = await designationService.getDesignationById(req.params.id);
      req.auditBeforeDesignation = { name: before.name, status: before.status };
      req.auditTarget = `${before.name} (id: ${before._id})`;
    } catch (_) {}

    const deleted = await designationService.deleteDesignation(req.params.id);
    return res.status(200).json({
      message: "Designation deleted successfully.",
      deleted,
    });
  } catch (err) {
    return sendError(res, err);
  }
}

async function updateStatus(req, res) {
  try {
    try {
      const before = await designationService.getDesignationById(req.params.id);
      req.auditBeforeDesignation = { name: before.name, status: before.status };
      req.auditTarget = `${before.name} (id: ${before._id})`;
    } catch (_) {}

    const { status } = req.body;
    const designation = await designationService.updateDesignationStatus(
      req.params.id,
      status,
    );

    return res.json({
      message: `Designation status updated to ${status}`,
      designation,
    });
  } catch (err) {
    return sendError(res, err);
  }
}

module.exports = {
  getAllDesignations,
  listAll,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  updateStatus,
};
