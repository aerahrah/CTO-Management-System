import API from "./api";

export const fetchAllProvincialOffices = async () => {
  const { data } = await API.get("/settings/provincial-office");
  console.log(data);
  return data;
};

export const fetchProvincialOfficeById = async (id) => {
  const { data } = await API.get(`/settings/provincial-office/${id}`);

  return data;
};

export const createProvincialOffice = async (office) => {
  console.log(office);
  const { data } = await API.post("/settings/provincial-office", office);
  return data;
};

export const updateProvincialOffice = async (id, office) => {
  const { data } = await API.put(`/settings/provincial-office/${id}`, office);
  return data;
};

export const deleteProvincialOffice = async (id) => {
  const { data } = await API.delete(`/settings/provincial-office/${id}`);
  return data;
};
