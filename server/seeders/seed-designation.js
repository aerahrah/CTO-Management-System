const mongoose = require("mongoose");
const dotenv = require("dotenv");

require("./config/loadEnv");

// Adjust path depending on your folder structure
const Designation = require("../models/Designation");

const designationsData = [
  { name: "Cagayan Provincial Office", status: "Active" },
  { name: "Regional Office", status: "Active" },
  { name: "Quirino Provincial Office", status: "Active" },
  { name: "Isabela Provincial Office - Santiago City", status: "Active" },
  { name: "Batanes Provincial Office", status: "Active" },
  { name: "Isabela Provincial Office - Cauayan City", status: "Active" },
  { name: "Nueva Vizcaya Provincial Office", status: "Active" },
];

const seedDesignations = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    console.log("⏳ Seeding Designations...");

    for (const designation of designationsData) {
      await Designation.findOneAndUpdate(
        { name: designation.name },
        { $set: designation },
        { upsert: true, new: true, runValidators: true },
      );
      console.log(`  - Designation '${designation.name}' synced.`);
    }

    console.log("✅ Designations seeded successfully!\n");
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding designations:", error);
    process.exit(1);
  }
};

seedDesignations();
