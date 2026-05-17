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
  "employees.delete",
  "employees.reset_password_self",
  "employees.change_role",

  // -------------------------
  // CTO & LEAVES
  // -------------------------
  "cto.view_self", // View own records
  "cto.create", // Apply for leaves
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
  "wellness.create", // Apply for wellness leaves
  "wellness.applications_view", // View global wellness applications list

  // Wellness Approver Flow Permissions
  "wellness.view_application", // View specific wellness applications assigned for approval
  "wellness.manage_application", // Approve or reject assigned wellness applications

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
  "settings.cto_workflow", // CTO Approval routes/approver setup

  // -------------------------
  // RESOURCE MANAGEMENT
  // -------------------------
  "designations.manage", // Create/edit/delete designations
  "roles.view", // View roles list
  "roles.manage", // Create/edit/delete roles & permissions
  "projects.manage", // Create/edit/delete projects
  "backups.manage", // System backups and restore
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
