// src/api/projectApi.js
import API from "./api";

// ✅ GET list (supports: ?status=Active&page=1&limit=20|50|100)
export const fetchAllProjects = async (params = {}) => {
  const { data } = await API.get("/settings/projects", { params });
  return data;
};

// ✅ NEW: GET all projects (NO pagination) for dropdown/options
// supports: ?status=Active | Inactive (optional)
export const fetchProjectOptions = async (params = {}) => {
  const { data } = await API.get("/settings/projects/options", { params });
  return data;
};

// ✅ GET by id
export const fetchProjectById = async (id) => {
  const { data } = await API.get(`/settings/projects/${id}`);
  return data;
};

// ✅ CREATE
export const createProject = async (project) => {
  // project: { name: string, status?: "Active"|"Inactive" }
  const { data } = await API.post("/settings/projects", project);
  return data;
};

// ✅ UPDATE (partial)
export const updateProject = async (id, project) => {
  // project: { name?: string, status?: "Active"|"Inactive" }
  const { data } = await API.patch(`/settings/projects/${id}`, project);
  return data;
};

// ✅ DELETE
export const deleteProject = async (id) => {
  const { data } = await API.delete(`/settings/projects/${id}`);
  return data;
};

// ✅ UPDATE STATUS (single endpoint)
export const updateProjectStatus = async (id, status) => {
  // status: "Active" | "Inactive"
  const { data } = await API.patch(`/settings/projects/${id}/status`, {
    status,
  });
  return data;
};
