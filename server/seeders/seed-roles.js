const mongoose = require("mongoose");
const dotenv = require("dotenv");

require("./config/loadEnv");

// Adjust this path if your model is located elsewhere relative to the seeders folder
const Role = require("../models/Role");

const rolesData = [
  {
    _id: new mongoose.Types.ObjectId("6a0452821ac7d7dd727a93e7"),
    name: "admin",
    description: "System Administrator",
    permissions: ["*"], // Wildcard is valid in your schema
    isSystem: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6a0452821ac7d7dd727a93ee"),
    name: "supervisor",
    description: "Supervisor",
    permissions: [
      "cto.view_application",
      "cto.manage_application",
      "cto.view_self",
      "cto.manage_self",
      "employees.view_self",
    ],
    isSystem: true,
  },
  {
    _id: new mongoose.Types.ObjectId("6a0452821ac7d7dd727a93f1"),
    name: "employee",
    description: "General Employee (Legacy)",
    permissions: [
      "employees.view_self",
      "cto.view_self",
      "employees.reset_password_self",
      "employees.edit_self",
      "cto.manage_self",
      "settings.cto_workflow",
      "cto.dashboard.self_view",
    ],
    isSystem: true,
  },
  // ✅ Regular Plantilla Employee Role
  {
    _id: new mongoose.Types.ObjectId("6a0452821ac7d7dd727a93f2"),
    name: "regular",
    description: "Regular Plantilla Employee",
    permissions: [
      "employees.view_self",
      "employees.edit_self",
      "employees.reset_password_self",
      "cto.view_self",
      "cto.manage_self",
      "cto.dashboard.self_view",
      "wellness.view_self",
      "wellness.manage_self",
      "wellness.dashboard.self_view",
      "calendar.view_self",
    ],
    isSystem: true,
  },
  // ✅ Job Order (JO) Employee Role
  {
    _id: new mongoose.Types.ObjectId("6a0452821ac7d7dd727a93f3"),
    name: "jo",
    description: "Job Order (JO) Employee",
    permissions: [
      "employees.view_self",
      "employees.edit_self",
      "employees.reset_password_self",
      "cto.view_self",
      "cto.manage_self",
      "cto.dashboard.self_view",
      "calendar.view_self",
    ],
    isSystem: true,
  },
  // ✅ NEW: Human Resources (HR) Role
  {
    _id: new mongoose.Types.ObjectId("6a0452821ac7d7dd727a93f4"),
    name: "hr",
    description: "Human Resources / Personnel Officer",
    permissions: [
      // Self permissions
      "employees.view_self",
      "employees.edit_self",
      "employees.reset_password_self",
      "cto.view_self",
      "cto.manage_self",
      "cto.dashboard.self_view",
      "calendar.view_self",

      // Global HR Management Permissions
      "employees.view",
      "employees.create",
      "employees.edit",
      "employees.upload_signature",
      "employees.delete",
      "employees.change_role",

      // Leave & Credits Management
      "cto.credits_manage",
      "cto.credits_view",
      "cto.applications_view",
      "cto.records_view",
      "cto.dashboard.hr_view",
      "wellness.view_all",
      "wellness.manage",
      "revocation.view_application",
      "revocation.manage_application",

      // Configurations & Resources
      "calendar.view_all",
      "designations.manage",
      "salary_grades.view",
      "salary_grades.manage",
      "settings.general",
      "settings.cto_workflow",
      "settings.revocation_workflow",
    ],
    isSystem: true,
  },
];

const seedRoles = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    console.log("⏳ Seeding roles...");

    // Loop through the data and upsert
    // 'upsert: true' updates the role if it exists, or creates it if it doesn't
    // 'runValidators: true' ensures your enum checks are enforced
    for (const role of rolesData) {
      await Role.findByIdAndUpdate(
        role._id,
        { $set: role },
        { upsert: true, new: true, runValidators: true },
      );
      console.log(`  - Role '${role.name}' synced successfully.`);
    }

    console.log("\n✅ All roles successfully seeded!");
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0); // Exit without errors
  } catch (error) {
    console.error("❌ Error seeding roles:", error);
    process.exit(1); // Exit with failure code
  }
};

// Execute the seeder
seedRoles();
