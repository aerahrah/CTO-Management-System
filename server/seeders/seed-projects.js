const mongoose = require("mongoose");
const dotenv = require("dotenv");

require("./config/loadEnv");

// Adjust path depending on your folder structure
const Project = require("../models/Project");

const projectsData = [
  { name: "PNPKI", status: "Active" },
  { name: "ILCDB", status: "Active" },
  { name: "ILCDB-DTC", status: "Active" },
  { name: "IIDB", status: "Active" },
  { name: "GOVNET", status: "Active" },
  { name: "FREE WIFI", status: "Active" },
  { name: "DigiGov", status: "Active" }, // Replaced eGOV and e-LGU
  { name: "GECS", status: "Active" },
  { name: "NIPPSB", status: "Active" },
  { name: "MOOE", status: "Active" },
  { name: "MISS", status: "Active" },
];

const seedProjects = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    console.log("⏳ Seeding Projects...");

    for (const project of projectsData) {
      await Project.findOneAndUpdate(
        { name: project.name },
        { $set: project },
        { upsert: true, new: true, runValidators: true },
      );
      console.log(`  - Project '${project.name}' synced.`);
    }

    console.log("✅ Projects seeded successfully!\n");
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding projects:", error);
    process.exit(1);
  }
};

seedProjects();
