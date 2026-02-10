const projectService = require("../services/project.service");

function sendError(res, err) {
  const status = err.statusCode || 500;
  return res.status(status).json({
    message: err.message || "Server error",
  });
}

// ✅ helper: attach before snapshot for audit middleware
async function attachProjectBefore(req, projectId) {
  try {
    const before = await projectService.getProjectById(projectId);
    req.auditBeforeProject = { name: before?.name, status: before?.status };
    req.auditTarget = `${before?.name || "N/A"} (id: ${before?._id || projectId})`;
  } catch {
    // ignore if not found/invalid; service will throw later anyway
    req.auditBeforeProject = null;
    req.auditTarget = `N/A (id: ${projectId})`;
  }
}

async function create(req, res) {
  try {
    const project = await projectService.createProject(req.body);
    return res.status(201).json(project);
  } catch (err) {
    return sendError(res, err);
  }
}

async function list(req, res) {
  try {
    const result = await projectService.listProjects(req.query);
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

/**
 * ✅ NEW: fetch all without pagination (for dropdown/options)
 * GET /projects/options?status=Active
 */
async function listAll(req, res) {
  try {
    const result = await projectService.listAllProjects(req.query);
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
}

async function getOne(req, res) {
  try {
    const project = await projectService.getProjectById(req.params.id);
    return res.json(project);
  } catch (err) {
    return sendError(res, err);
  }
}

async function update(req, res) {
  try {
    // ✅ capture BEFORE
    await attachProjectBefore(req, req.params.id);

    const project = await projectService.updateProject(req.params.id, req.body);
    return res.json(project);
  } catch (err) {
    return sendError(res, err);
  }
}

async function remove(req, res) {
  try {
    // ✅ capture BEFORE (important for delete)
    await attachProjectBefore(req, req.params.id);

    const deleted = await projectService.deleteProject(req.params.id);
    return res.json({ message: "Project deleted", deleted });
  } catch (err) {
    return sendError(res, err);
  }
}

/* ✅ ONE endpoint: PATCH /:id/status  body: { status: "Active" | "Inactive" } */
async function updateStatus(req, res) {
  try {
    // ✅ capture BEFORE
    await attachProjectBefore(req, req.params.id);

    const { status } = req.body;
    const project = await projectService.updateProjectStatus(
      req.params.id,
      status,
    );
    return res.json({
      message: `Project status updated to ${status}`,
      project,
    });
  } catch (err) {
    return sendError(res, err);
  }
}

module.exports = {
  create,
  list,
  listAll,
  getOne,
  update,
  remove,
  updateStatus,
};
