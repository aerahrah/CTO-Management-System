const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const Employee = require("../models/employeeModel");
const Role = require("../models/roleModel");

async function migrate() {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    // Define base roles and their permissions
    const rolesData = [
      {
        name: "admin",
        description: "System Administrator",
        permissions: ["*"], // Wildcard permission
        isSystem: true,
      },
      {
        name: "hr",
        description: "Human Resources",
        permissions: [
          "employees.view",
          "employees.create",
          "employees.edit",
          "employees.delete",
          "roles.view",
          "settings.view",
          "settings.edit",
          "cto.view_all",
          "cto.approve_hr",
        ],
        isSystem: true,
      },
      {
        name: "supervisor",
        description: "Supervisor",
        permissions: [
          "employees.view",
          "cto.approve_supervisor",
        ],
        isSystem: true,
      },
      {
        name: "employee",
        description: "Regular Employee",
        permissions: [
          "employees.view_self",
          "cto.create",
          "cto.view_self",
        ],
        isSystem: true,
      },
    ];

    const roleMap = {};

    console.log("Creating/verifying base roles...");
    for (const data of rolesData) {
      let role = await Role.findOne({ name: data.name });
      if (!role) {
        role = await Role.create(data);
        console.log(`Created role: ${data.name}`);
      } else {
        role.permissions = data.permissions;
        await role.save();
        console.log(`Updated role: ${data.name}`);
      }
      roleMap[data.name] = role._id;
    }

    console.log("Migrating employees...");
    const collection = mongoose.connection.collection("employees");
    
    // Find all employees where role is a string
    const employees = await collection.find({ role: { $type: "string" } }).toArray();
    console.log(`Found ${employees.length} employees to migrate.`);

    for (const emp of employees) {
      const roleStr = emp.role.toLowerCase();
      const roleId = roleMap[roleStr] || roleMap["employee"];
      
      await collection.updateOne(
        { _id: emp._id },
        { $set: { role: roleId } }
      );
    }

    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
