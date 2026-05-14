const cron = require("node-cron");
const Employee = require("../models/employeeModel");

// Run at 00:00 on January 1st
const initWellnessCron = () => {
  cron.schedule("0 0 1 1 *", async () => {
    console.log("[CRON] Starting yearly Wellness Leave reset for Permanent employees...");
    try {
      const result = await Employee.updateMany(
        { contractType: "Permanent" },
        { $set: { "balances.wellnessDays": 5 } }
      );
      console.log(`[CRON] Wellness Leave reset complete. Modified ${result.modifiedCount} employees.`);
    } catch (error) {
      console.error("[CRON] Error resetting Wellness Leave balances:", error);
    }
  });
  console.log("[CRON] Wellness Leave reset cron job initialized (runs every Jan 1st).");
};

module.exports = initWellnessCron;
