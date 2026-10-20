const mongoose = require("mongoose");

// Organized list of all system permissions
const validPermissions = [
  // Admin Wildcard
  "*",

  // -------------------------
  // EMPLOYEE MANAGEMENT
  // -------------------------
  "employees.view",
  "employees.view_self",
  "employees.create",
  "employees.edit",
  "employees.edit_self",
  "employees.upload_signature",
  "employees.delete",
  "employees.reset_password_self",
  "employees.reset_password", // ✅ Reset another employee's password by email
  "employees.change_role",

  // -------------------------
  // CTO & LEAVES
  // -------------------------
  "cto.view_self", // View own records
  "cto.manage_self", // Apply for leaves
  "cto.credits_manage", // Add/rollback credits
  "cto.credits_view", // Legacy/Broad view
  "cto.applications_view", // View global applications list
  "cto.records_view", // View global employee CTO records

  // Approver Flow Permissions
  "cto.view_application", // View specific applications assigned for approval
  "cto.manage_application", // Approve or reject assigned CTO applications

  // Dashboard View Permissions
  "cto.dashboard.self_view", // Personal dashboard view
  "cto.dashboard.hr_view", // HR dashboard view (credits & records summary)
  "cto.dashboard.admin_view", // Admin dashboard view (global requests summary)

  // -------------------------
  // WELLNESS LEAVES
  // -------------------------
  "wellness.view_self", // View own wellness records
  "wellness.manage_self", // Apply for wellness leaves
  "wellness.view_all", // View global wellness applications list
  "wellness.manage",
  // Wellness Approver Flow Permissions
  "wellness.view_application", // View specific wellness applications assigned for approval
  "wellness.manage_application", // Approve or reject assigned wellness applications
  "wellness.dashboard.self_view",

  // -------------------------
  // WELLNESS LEAVES
  // -------------------------

  "revocation.manage_application",
  "revocation.manage_self",
  "revocation.view_application",
  // -------------------------
  // SYSTEM & ADMIN HUBS
  // -------------------------
  "admin.view", // Access Admin Dashboard
  "audit.view", // Access Audit Logs

  // -------------------------
  // SETTINGS & CONFIGURATION
  // -------------------------
  "settings.view", // General access to settings hub
  "settings.edit", // General settings edit (legacy)
  "settings.general", // Working days & core settings
  "settings.sessions", // Session timeouts
  "settings.email", // Email notification config
  "settings.cto_workflow", // Set up own CTO/Wellness approval workflow
  "settings.cto_workflow_assign", // Create shared CTO/Wellness workflows & assign them to employees, designations, projects
  "settings.revocation_workflow",
  // -------------------------
  // CALENDAR & SCHEDULING
  // -------------------------
  "calendar.view_self", // View own approved/pending dates
  "calendar.view_all", // View all employees' dates (HR/Admin)
  "calendar.view_designation", // (Optional future-proofing) View dates for own department
  "calendar.view_project",

  // -------------------------
  // RESOURCE MANAGEMENT
  // -------------------------
  "designations.manage", // Create/edit/delete designations
  "roles.view", // View roles list
  "roles.manage", // Create/edit/delete roles & permissions
  "projects.manage", // Create/edit/delete projects
  "backups.manage", // System backups and restore
  "salary_grades.view", // ✅ View salary grade table
  "salary_grades.manage", // ✅ Edit and update salary grade amounts
];

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    permissions: [
      {
        type: String,
        required: true,
        enum: {
          values: validPermissions,
          message: "{VALUE} is not a valid permission",
        },
      },
    ],
    // Protect system roles (Admin, HR) from being accidentally deleted
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Role", roleSchema);
