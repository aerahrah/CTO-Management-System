const projectService = require("../services/project.service");

function sendError(res, err) {
  const status = err.statusCode || 500;
  return res.status(status).json({
    message: err.message || "Server error",
  });
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
    const project = await projectService.updateProject(req.params.id, req.body);
    return res.json(project);
  } catch (err) {
    return sendError(res, err);
  }
}

async function remove(req, res) {
  try {
    const deleted = await projectService.deleteProject(req.params.id);
    return res.json({ message: "Project deleted", deleted });
  } catch (err) {
    return sendError(res, err);
  }
}

/* ✅ ONE endpoint: PATCH /:id/status  body: { status: "Active" | "Inactive" } */
async function updateStatus(req, res) {
  try {
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
  getOne,
  update,
  remove,
  updateStatus,
};
