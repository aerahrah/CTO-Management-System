// utils/endpointMap.js

const endpointMap = [
  /* =========================
     Employee Routes
     Mounted: /employee
  ========================= */
  { pattern: /^\/employee$/, method: "POST", name: "Create Employee" },
  { pattern: /^\/employee\/login$/, method: "POST", name: "Employee Login" },

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

  { pattern: /^\/employee$/, method: "GET", name: "View Employees" },
  {
    pattern: /^\/employee\/\w+$/,
    method: "GET",
    name: "View Employee Details",
  },
  { pattern: /^\/employee\/\w+$/, method: "PUT", name: "Update Employee" },
  {
    pattern: /^\/employee\/\w+\/role$/,
    method: "POST",
    name: "Update Employee Role",
  },

  /* =========================
     CTO Routes
     Mounted: /cto
  ========================= */

  // Credits
  {
    pattern: /^\/cto\/credits$/,
    method: "POST",
    name: "Add CTO Credit Request",
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
  {
    pattern: /^\/cto\/credits\/\w+\/rollback$/,
    method: "PATCH",
    name: "Rollback CTO Credit",
  },
  {
    pattern: /^\/cto\/employee\/\w+\/details$/,
    method: "GET",
    name: "View Employee Details (CTO)",
  },

  // Applications
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
    pattern: /^\/cto\/applications\/\w+\/cancel$/,
    method: "PATCH",
    name: "Cancel CTO Application",
  },

  // Approver flow
  {
    pattern: /^\/cto\/applications\/pending-count$/,
    method: "GET",
    name: "View Pending CTO Count",
  },
  {
    pattern: /^\/cto\/applications\/approvers$/,
    method: "GET",
    name: "View Approver Options",
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
     Mounted: /cto (ctoDashboardRoutes)
  ========================= */
  { pattern: /^\/cto\/dashboard$/, method: "GET", name: "View Dashboard" },

  /* =========================
     CTO Approver Settings
     Mounted: /cto/settings
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
     Designations
     Mounted: /settings/designation
  ========================= */
  {
    pattern: /^\/settings\/designation$/,
    method: "GET",
    name: "View All Designations",
  },
  {
    pattern: /^\/settings\/designation\/options$/,
    method: "GET",
    name: "View Designation Options",
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
    pattern: /^\/settings\/designation\/\w+\/status$/,
    method: "PATCH",
    name: "Update Designation Status",
  },
  {
    pattern: /^\/settings\/designation\/\w+$/,
    method: "DELETE",
    name: "Delete Designation",
  },

  /* =========================
     Projects
     Mounted: /settings/projects
  ========================= */
  { pattern: /^\/settings\/projects$/, method: "POST", name: "Create Project" },
  { pattern: /^\/settings\/projects$/, method: "GET", name: "View Projects" },
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
    pattern: /^\/settings\/projects\/\w+\/status$/,
    method: "PATCH",
    name: "Update Project Status",
  },
  {
    pattern: /^\/settings\/projects\/\w+$/,
    method: "DELETE",
    name: "Delete Project",
  },

  /* =========================
     General Settings
     Mounted: /settings/general
  ========================= */
  {
    pattern: /^\/settings\/general\/session$/,
    method: "GET",
    name: "View Session Settings",
  },
  {
    pattern: /^\/settings\/general\/session$/,
    method: "PUT",
    name: "Update Session Settings",
  },
  {
    pattern: /^\/settings\/general\/working-days$/,
    method: "GET",
    name: "View Working Days Settings",
  },
  {
    pattern: /^\/settings\/general\/working-days$/,
    method: "PUT",
    name: "Update Working Days Settings",
  },

  /* =========================
     MongoDB Backup
     Mounted: /settings/mongodb
  ========================= */
  { pattern: /^\/settings\/mongodb$/, method: "GET", name: "List CTO Backups" },
  {
    pattern: /^\/settings\/mongodb$/,
    method: "POST",
    name: "Create CTO Backup",
  },
  {
    pattern: /^\/settings\/mongodb\/\w+\/download$/,
    method: "GET",
    name: "Download CTO Backup",
  },
  {
    pattern: /^\/settings\/mongodb\/restore$/,
    method: "POST",
    name: "Restore CTO Backup",
  },
  {
    pattern: /^\/settings\/mongodb\/[^/]+$/,
    method: "DELETE",
    name: "Delete CTO Backup",
  },
];

const getEndpointName = (url, method) => {
  const match = endpointMap.find(
    (e) => e.method === method && e.pattern.test(url),
  );
  return match ? match.name : `${method} ${url}`;
};

module.exports = getEndpointName;
