// src/api/employee.js
import API from "./api";

export const addEmployee = async (credentials) => {
  const res = await API.post("/employee/", credentials);
  return res.data;
};

export const getEmployees = async (params = {}) => {
  const res = await API.get("/employee/", {
    params,
    withCredentials: true,
  });
  return res.data;
};

export const getEmployeeById = async (id) => {
  const res = await API.get(`/employee/${id}`);
  return res.data;
};

export const loginEmployee = async (credentials) => {
  const res = await API.post("/employee/login", credentials);
  return res.data;
};

export const fetchProvincialOffices = async () => {
  const res = await API.get("/settings/provincial-office");
  return res.data;
};

export const updateEmployeeById = async (id, updateData) => {
  const res = await API.put(`/employee/${id}`, updateData);
  return res.data;
};

export const updateEmployeeRole = async (id, updateData) => {
  const res = await API.post(`/employee/${id}/role`, updateData);
  return res.data;
};

export const getMyProfile = async () => {
  const res = await API.get(`/employee/my-profile`);
  return res.data;
};

export const updateMyProfile = async (updateData) => {
  const res = await API.put(`/employee/my-profile`, updateData);
  return res.data;
};

// ==========================================
// Signature Upload
// ==========================================
export const uploadMySignature = async (file) => {
  const fd = new FormData();
  fd.append("signature", file);

  const res = await API.post("/employee/my-profile/signature", fd, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    withCredentials: true,
  });
  return res.data;
};

export const resetMyPassword = async (updateData) => {
  const res = await API.put(`/employee/my-profile/reset-password`, updateData);
  return res.data;
};

// ==========================================
// Wellness Balance Endpoints
// ==========================================

export const getEmployeeWellnessBalanceById = async (id) => {
  const res = await API.get(`/employee/${id}/wellness-balance`);
  return res.data;
};

export const getMyWellnessBalance = async () => {
  const res = await API.get(`/employee/my-wellness-balance`);
  return res.data;
};

// ==========================================
// Admin: Reset Another Employee's Password
// ==========================================
export const adminResetEmployeePassword = async (email, notify = true) => {
  const res = await API.post(`/employee/reset-password`, { email, notify });
  return res.data;
};
