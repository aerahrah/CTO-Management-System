// models/GeneralSetting.js
const mongoose = require("mongoose");

const generalSettingSchema = new mongoose.Schema(
  {
    // --- SESSION SETTINGS ---
    sessionTimeoutEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    sessionTimeoutMinutes: {
      type: Number,
      required: true,
      default: 1440, // 24 hours
      min: 1,
      max: 60 * 24 * 30, // up to 30 days
    },

    // --- LEAD TIME & LATE FILING SETTINGS ---
    workingDaysEnable: {
      type: Boolean,
      required: true,
      default: true,
    },
    workingDaysValue: {
      type: Number,
      required: true,
      default: 5,
      min: 1,
      max: 7,
    },
    lateFilingAttachmentRequired: {
      type: Boolean,
      required: true,
      default: false, // Default is false (optional)
    },

    // --- WORK SCHEDULE SETTINGS ---
    hoursPerDay: {
      type: Number,
      required: true,
      default: 8,
      min: 1,
      max: 24, // Prevents impossible hour configurations
    },
    activeWorkingDays: {
      type: [Number], // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
      required: true,
      default: [1, 2, 3, 4, 5], // Defaults to Monday-Friday
      validate: {
        validator: function (arr) {
          // Ensure it's an array, not empty, and all numbers are between 0 and 6
          return (
            Array.isArray(arr) &&
            arr.length > 0 &&
            arr.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
          );
        },
        message: "activeWorkingDays must contain valid days of the week (0-6).",
      },
    },

    // --- COMPUTATION SETTINGS ---
    computationMode: {
      type: String,
      enum: ["Working Days", "Calendar Days"],
      required: true,
      default: "Working Days",
      // 'Working Days' = Computes only on weekdays / activeWorkingDays
      // 'Calendar Days' = Normal days, includes weekends
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("GeneralSetting", generalSettingSchema);
