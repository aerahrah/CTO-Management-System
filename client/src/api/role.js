import api from "./api";

export const getRoles = async () => {
  const { data } = await api.get("/roles");
  return data;
};

export const createRole = async (roleData) => {
  const { data } = await api.post("/roles", roleData);
  return data;
};

export const updateRole = async ({ id, ...roleData }) => {
  const { data } = await api.put(`/roles/${id}`, roleData);
  return data;
};

export const deleteRole = async (id) => {
  const { data } = await api.delete(`/roles/${id}`);
  return data;
};
