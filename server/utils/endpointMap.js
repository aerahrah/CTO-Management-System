// utils/endpointMap.js

const endpointMap = [
  /* =========================
     Employee Routes
  ========================= */
  { pattern: /^\/employee$/, method: "POST", name: "Create Employee" },
  { pattern: /^\/employee\/login$/, method: "POST", name: "Employee Login" },
  { pattern: /^\/employee\/\w+$/, method: "PUT", name: "Update Employee" },
  {
    pattern: /^\/employee\/\w+\/role$/,
    method: "POST",
    name: "Update Employee Role",
  },
  {
    pattern: /^\/employee\/my-profile$/,
    method: "GET",
    name: "View My Profile",
  },
  {
    pattern: /^\/employee\/my-profile$/,
    method: "PUT",
    name: "Update My Profile",
  },
  {
    pattern: /^\/employee\/my-profile\/reset-password$/,
    method: "PUT",
    name: "Reset My Password",
  },
  { pattern: /^\/employee\/memos\/me$/, method: "GET", name: "View My Memos" },
  {
    pattern: /^\/employee\/memos\/\w+$/,
    method: "GET",
    name: "View Employee Memos",
  },
  {
    pattern: /^\/employee\/\w+$/,
    method: "GET",
    name: "View Employee Details",
  },

  /* =========================
     CTO Credit Routes
  ========================= */
  {
    pattern: /^\/cto\/credits$/,
    method: "POST",
    name: "Add CTO Credit Request",
  },
  {
    pattern: /^\/cto\/credits\/\w+\/rollback$/,
    method: "PATCH",
    name: "Rollback CTO Credit",
  },
  {
    pattern: /^\/cto\/credits\/all$/,
    method: "GET",
    name: "View All Credit Requests",
  },
  {
    pattern: /^\/cto\/credits\/my-credits$/,
    method: "GET",
    name: "View My Credits",
  },
  {
    pattern: /^\/cto\/credits\/\w+\/history$/,
    method: "GET",
    name: "View Employee Credit History",
  },

  /* =========================
     CTO Application Routes
  ========================= */
  {
    pattern: /^\/cto\/applications\/apply$/,
    method: "POST",
    name: "Apply for CTO",
  },
  {
    pattern: /^\/cto\/applications\/all$/,
    method: "GET",
    name: "View All CTO Applications",
  },
  {
    pattern: /^\/cto\/applications\/my-application$/,
    method: "GET",
    name: "View My CTO Applications",
  },
  {
    pattern: /^\/cto\/applications\/employee\/\w+$/,
    method: "GET",
    name: "View Employee CTO Applications",
  },
  {
    pattern: /^\/cto\/applications\/approvers\/my-approvals$/,
    method: "GET",
    name: "View My CTO Approvals",
  },
  {
    pattern: /^\/cto\/applications\/approvers\/my-approvals\/\w+$/,
    method: "GET",
    name: "View CTO Application Details",
  },
  {
    pattern: /^\/cto\/applications\/approver\/\w+\/approve$/,
    method: "POST",
    name: "Approve CTO Application",
  },
  {
    pattern: /^\/cto\/applications\/approver\/\w+\/reject$/,
    method: "PUT",
    name: "Reject CTO Application",
  },

  /* =========================
     CTO Dashboard
  ========================= */
  { pattern: /^\/cto\/dashboard$/, method: "GET", name: "View Dashboard" },

  /* =========================
     CTO Settings (Approver Setting)
  ========================= */
  { pattern: /^\/cto\/settings$/, method: "GET", name: "View CTO Settings" },
  {
    pattern: /^\/cto\/settings\/\w+$/,
    method: "GET",
    name: "View CTO Setting By Designation",
  },
  {
    pattern: /^\/cto\/settings$/,
    method: "POST",
    name: "Upsert CTO Approver Setting",
  },
  {
    pattern: /^\/cto\/settings\/\w+$/,
    method: "DELETE",
    name: "Delete CTO Approver Setting",
  },

  /* =========================
     ✅ Designations (NEW)
     Routes:
       GET    /settings/designation
       GET    /settings/designation/options
       GET    /settings/designation/:id
       POST   /settings/designation
       PUT    /settings/designation/:id
       PATCH  /settings/designation/:id/status
       DELETE /settings/designation/:id
  ========================= */

  // IMPORTANT: options + status must be before "/:id"
  {
    pattern: /^\/settings\/designation\/options$/,
    method: "GET",
    name: "View Designation Options",
  },
  {
    pattern: /^\/settings\/designation\/\w+\/status$/,
    method: "PATCH",
    name: "Update Designation Status",
  },
  {
    pattern: /^\/settings\/designation$/,
    method: "GET",
    name: "View All Designations",
  },
  {
    pattern: /^\/settings\/designation\/\w+$/,
    method: "GET",
    name: "View Designation Details",
  },
  {
    pattern: /^\/settings\/designation$/,
    method: "POST",
    name: "Create Designation",
  },
  {
    pattern: /^\/settings\/designation\/\w+$/,
    method: "PUT",
    name: "Update Designation",
  },
  {
    pattern: /^\/settings\/designation\/\w+$/,
    method: "DELETE",
    name: "Delete Designation",
  },

  /* =========================
     (Optional) Legacy support:
     If some parts still call /settings/provincial-office,
     keep these mappings so audit still works.
  ========================= */
  {
    pattern: /^\/settings\/provincial-office$/,
    method: "GET",
    name: "View All Designations",
  },
  {
    pattern: /^\/settings\/provincial-office\/\w+$/,
    method: "GET",
    name: "View Designation Details",
  },
  {
    pattern: /^\/settings\/provincial-office$/,
    method: "POST",
    name: "Create Designation",
  },
  {
    pattern: /^\/settings\/provincial-office\/\w+$/,
    method: "PUT",
    name: "Update Designation",
  },
  {
    pattern: /^\/settings\/provincial-office\/\w+$/,
    method: "DELETE",
    name: "Delete Designation",
  },

  /* =========================
     Projects (Settings)
  ========================= */
  {
    pattern: /^\/settings\/projects$/,
    method: "POST",
    name: "Create Project",
  },
  {
    pattern: /^\/settings\/projects$/,
    method: "GET",
    name: "View Projects",
  },
  {
    pattern: /^\/settings\/projects\/options$/,
    method: "GET",
    name: "View Project Options",
  },
  {
    pattern: /^\/settings\/projects\/\w+$/,
    method: "GET",
    name: "View Project Details",
  },
  {
    pattern: /^\/settings\/projects\/\w+$/,
    method: "PATCH",
    name: "Update Project",
  },
  {
    pattern: /^\/settings\/projects\/\w+$/,
    method: "DELETE",
    name: "Delete Project",
  },
  {
    pattern: /^\/settings\/projects\/\w+\/status$/,
    method: "PATCH",
    name: "Update Project Status",
  },
];

// Function to map URL + method to a friendly endpoint name
const getEndpointName = (url, method) => {
  const match = endpointMap.find(
    (e) => e.method === method && e.pattern.test(url),
  );
  return match ? match.name : `${method} ${url}`;
};

module.exports = getEndpointName;
