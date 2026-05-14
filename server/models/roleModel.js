const mongoose = require("mongoose");

// Extracted from your migration script
const validPermissions = [
  "*",
  "employees.view",
  "employees.view_self",
  "employees.create",
  "employees.edit",
  "employees.delete",
  "roles.view",
  "settings.view",
  "settings.edit",
  "cto.view_all",
  "cto.view_self",
  "cto.create",
  "cto.approve_hr",
  "cto.approve_supervisor",
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
