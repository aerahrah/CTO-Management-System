import API from "./api";

export const addCreditRequest = async (formData) => {
  console.log(formData);
  const res = await API.post("/cto/credits", formData);

  return res.data;
};

export const fetchAllCreditRequests = async () => {
  const res = await API.get("/cto/credits/all", {
    withCredentials: true,
  });
  return res.data.credits;
};

export const fetchRecentCreditRequest = async () => {
  const res = await API.get("/cto/credits/recent", {
    withCredentials: true,
  });
  return res.data.credits;
};

export const cancelCreditRequest = async (creditId) => {
  const res = await API.patch(
    `/cto/credits/${creditId}/cancel`,
    {},
    {
      withCredentials: true,
    }
  );
  return res.data.credit;
};

export const rollbackCreditCto = async (creditId) => {
  const res = await API.patch(
    `/cto/credits/${creditId}/rollback`,
    {},
    {
      withCredentials: true,
    }
  );
  return res.data.credit;
};

export const fetchEmployeeCredits = async (employeeId) => {
  console.log(employeeId);
  const res = await API.get(`/cto/credits/${employeeId}/history`);
  return res.data;
};

export const fetchEmployeeDetails = async (employeeId) => {
  console.log(employeeId);
  const res = await API.get(`/cto/employee/${employeeId}/details`);
  return res.data;
};

export const fetchProvincialOffices = async () => {
  console.log();
  const res = await API.get("/settings/provincial-office");

  return res.data;
};

export const fetchApproverSettings = async (provincialOfficeId) => {
  console.log(provincialOfficeId);
  const res = await API.get(`/cto/settings/${provincialOfficeId}`);
  console.log(res.data);
  return res.data;
};

export const upsertApproverSetting = async (payload) => {
  console.log(payload);
  const res = await API.post("/cto/settings", payload);

  return res.data;
};

export const addApplicationRequest = async (formData) => {
  console.log(formData);
  const res = await API.post("/cto/applications/apply", formData);

  return res.data;
};

export const approveApplicationRequest = async (applicationId) => {
  console.log(applicationId);
  const res = await API.post(
    `/cto/applications/approver/${applicationId}/approve`
  );

  return res.data;
};

export const rejectApplicationRequest = async (applicationId, remarks) => {
  console.log(applicationId);
  console.log(remarks);
  const res = await API.put(
    `/cto/applications/approver/${applicationId}/reject`,
    { remarks }
  );

  return res.data;
};

export const fetchMyCtoApplications = async () => {
  const { data } = await API.get(`cto/applications/my-application`);
  console.log(data);
  return data;
};

export const fetchMyCtoApplicationsApprovals = async () => {
  const { data } = await API.get(`cto/applications/approvers/my-approvals`);
  console.log(data);
  return data;
};
