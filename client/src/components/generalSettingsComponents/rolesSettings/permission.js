// constants.js

export const SUPER_ADMIN_PERM = "*";

export const PERMISSION_GROUPS = [
  {
    name: "Employee Management",
    permissions: [
      {
        id: "employees.view",
        label: "View Employees",
        hint: "View the employee directory and basic profiles.",
      },
      {
        id: "employees.view_self",
        label: "View Own Profile",
        hint: "Access own personal employee profile.",
      },
      {
        id: "employees.create",
        label: "Create Employees",
        hint: "Onboard new employees into the system.",
      },
      {
        id: "employees.edit",
        label: "Edit Employees",
        hint: "Modify existing employee records.",
      },
      {
        id: "employees.edit_self",
        label: "Edit Own Profile",
        hint: "Modify own personal details.",
      },
      {
        id: "employees.delete",
        label: "Delete Employees",
        hint: "Remove employees from the system.",
      },
      {
        id: "employees.reset_password_self",
        label: "Reset Own Password",
        hint: "Allow user to change their own password.",
      },
    ],
  },
  {
    name: "Wellness Leave",
    permissions: [
      {
        id: "wellness.manage_self",
        label: "Apply for Wellness",
        hint: "File a new wellness leave application.",
      },
      {
        id: "wellness.view_self",
        label: "View Own Wellness",
        hint: "View personal wellness leave history.",
      },
      {
        id: "wellness.view_all",
        label: "View Global Wellness",
        hint: "View all wellness applications in the system.",
      },
      {
        id: "wellness.view_application",
        label: "View Assigned Applications",
        hint: "View specific wellness applications assigned to you for approval.",
      },
      {
        id: "wellness.manage_application",
        label: "Manage Assigned Applications",
        hint: "Approve or reject assigned wellness applications.",
      },
    ],
  },
  {
    name: "CTO & Leaves",
    permissions: [
      {
        id: "cto.credits_view",
        label: "View All CTO ",
        hint: "Broad view access to CTO records.",
      },
      {
        id: "cto.view_self",
        label: "View Own CTO",
        hint: "View personal CTO records and history.",
      },
      {
        id: "cto.create",
        label: "Apply for CTO",
        hint: "File a new Compensatory Time-off application.",
      },
      {
        id: "cto.credits_manage",
        label: "Manage CTO Credits",
        hint: "Add or rollback CTO credits.",
      },
      {
        id: "cto.applications_view",
        label: "View Global Applications",
        hint: "View all CTO applications in the system.",
      },
      {
        id: "cto.records_view",
        label: "View CTO Records",
        hint: "View employee CTO credit balances and application history.",
      },
      {
        id: "cto.view_application",
        label: "View Assigned Applications",
        hint: "View specific CTO applications assigned to you for approval.",
      },
      {
        id: "cto.manage_application",
        label: "Manage Assigned Applications",
        hint: "Approve or reject assigned CTO applications.",
      },
      {
        id: "cto.dashboard.self_view",
        label: "View Personal Dashboard",
        hint: "Access the personal CTO dashboard.",
      },
      //   {
      //     id: "cto.dashboard.hr_view",
      //     label: "View HR Dashboard",
      //     hint: "Access the HR CTO dashboard with credit and record summaries.",
      //   },
      //   {
      //     id: "cto.dashboard.admin_view",
      //     label: "View Admin Dashboard",
      //     hint: "Access the global Admin CTO dashboard with request summaries.",
      //   },
    ],
  },
  {
    name: "Role Management",
    permissions: [
      {
        id: "roles.view",
        label: "View Roles",
        hint: "View the list of system roles.",
      },
      {
        id: "roles.manage",
        label: "Manage Roles",
        hint: "Create, edit, or delete roles and permissions.",
      },
      {
        id: "employees.change_role",
        label: "Update Employee Role",
        hint: "Update employee role from the system.",
      },
    ],
  },
  {
    name: "Settings & Configuration",
    permissions: [
      {
        id: "audit.view",
        label: "View Audit Logs",
        hint: "Access system-wide activity and audit logs.",
      },
      {
        id: "settings.general",
        label: "Manage Working days Settings",
        hint: "Modify working days system behavior.",
      },
      {
        id: "designations.manage",
        label: "Manage Designations",
        hint: "Create, edit, or delete job designations.",
      },
      {
        id: "projects.manage",
        label: "Manage Projects",
        hint: "Create, edit, or delete company projects.",
      },
      {
        id: "settings.sessions",
        label: "Manage Sessions",
        hint: "Configure session timeouts and security.",
      },
      {
        id: "settings.email",
        label: "Manage Email Notifs",
        hint: "Toggle specific email notification triggers.",
      },
      {
        id: "settings.cto_workflow",
        label: "Manage CTO Workflow",
        hint: "Configure CTO approval routes and approvers.",
      },
      {
        id: "backups.manage",
        label: "Manage Backups",
        hint: "Create, download, or restore database backups.",
      },
    ],
  },
];
