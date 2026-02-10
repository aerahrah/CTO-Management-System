// src/api/designationApi.js
import API from "./api";

// ✅ GET list (supports: ?status=Active&page=1&limit=20|50|100)
export const fetchAllDesignations = async (params = {}) => {
  const { data } = await API.get("/settings/designation", { params });
  return data;
};

// ✅ NEW: GET all designations (NO pagination) for dropdown/options
// supports: ?status=Active | Inactive (optional)
export const fetchDesignationOptions = async (params = {}) => {
  const { data } = await API.get("/settings/designation/options", {
    params,
  });
  return data;
};

// ✅ GET by id
export const fetchDesignationById = async (id) => {
  const { data } = await API.get(`/settings/designation/${id}`);
  return data;
};

// ✅ CREATE
export const createDesignation = async (designation) => {
  // designation: { name: string, status?: "Active"|"Inactive" }
  const { data } = await API.post("/settings/designation", designation);
  return data;
};

// ✅ UPDATE (partial)
export const updateDesignation = async (id, designation) => {
  // designation: { name?: string, status?: "Active"|"Inactive" }
  const { data } = await API.put(`/settings/designation/${id}`, designation);
  return data;
};

// ✅ DELETE
export const deleteDesignation = async (id) => {
  const { data } = await API.delete(`/settings/designation/${id}`);
  return data;
};

// ✅ UPDATE STATUS (single endpoint)
export const updateDesignationStatus = async (id, status) => {
  // status: "Active" | "Inactive"
  const { data } = await API.patch(`/settings/designation/${id}/status`, {
    status,
  });
  return data;
};
