import API from "./api";

export const addCreditRequest = async (formData) => {
  formData.forEach((value, key) => {
    console.log(key, value);
  });
  const res = await API.post("/cto/credits", formData);

  return res.data;
};

export const fetchAllCreditRequests = async (params = {}) => {
  const res = await API.get("/cto/credits/all", {
    params,
    withCredentials: true,
  });
  console.log(res.data.credits);
  return res.data;
};

export const fetchMyCreditRequests = async (params = {}) => {
  const res = await API.get(`/cto/credits/my-credits`, {
    params,
  });
  console.log(res.data);
  return res.data;
};

// export const fetchRecentCreditRequest = async () => {
//   const res = await API.get("/cto/credits/recent", {
//     withCredentials: true,
//   });
//   return res.data.credits;
// };

export const cancelCreditRequest = async (creditId) => {
  const res = await API.patch(
    `/cto/credits/${creditId}/cancel`,
    {},
    {
      withCredentials: true,
    },
  );
  return res.data.credit;
};

export const rollbackCreditCto = async (creditId) => {
  const res = await API.patch(
    `/cto/credits/${creditId}/rollback`,
    {},
    {
      withCredentials: true,
    },
  );
  return res.data.credit;
};

export const fetchEmployeeCredits = async (employeeId, params = {}) => {
  console.log(employeeId);
  const res = await API.get(`/cto/credits/${employeeId}/history`, {
    params,
  });
  console.log(res.data);
  return res.data;
};

export const fetchEmployeeApplications = async (employeeId, params = {}) => {
  console.log(employeeId);
  console.log(params);
  const res = await API.get(`/cto/applications/employee/${employeeId}`, {
    params,
  });
  console.log(res.data);
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

export const fetchApproverSettings = async (designationId) => {
  console.log(designationId);
  const res = await API.get(`/cto/settings/${designationId}`);
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
    `/cto/applications/approver/${applicationId}/approve`,
  );

  return res.data;
};

export const rejectApplicationRequest = async (applicationId, remarks) => {
  console.log(applicationId);
  console.log(remarks);
  const res = await API.put(
    `/cto/applications/approver/${applicationId}/reject`,
    { remarks },
  );

  return res.data;
};

export const fetchMyCtoApplications = async (params = {}) => {
  console.log(params);
  const { data } = await API.get(`cto/applications/my-application`, {
    params,
  });
  console.log(data);
  return data;
};

export const fetchAllCtoApplications = async (params = {}) => {
  console.log(params);
  const { data } = await API.get(`cto/applications/all`, {
    params,
  });
  console.log(data);
  return data;
};
export const fetchMyCtoApplicationsApprovals = async (params = {}) => {
  const { data } = await API.get(`cto/applications/approvers/my-approvals`, {
    params,
  });
  console.log(data);
  return data;
};

export const fetchMyCtoMemos = async () => {
  const { data } = await API.get(`employee/memos/me`);
  console.log(data);
  return data;
};

export const fetchDashboard = async () => {
  try {
    const res = await API.get("/cto/dashboard", {
      withCredentials: true,
    });
    console.log(res);
    return res.data.data;
  } catch (err) {
    console.error("Error fetching dashboard:", err);
    throw err;
  }
};
