const mongoose = require("mongoose");

const generalSettingSchema = new mongoose.Schema(
  {
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
  },
  { timestamps: true },
);

module.exports = mongoose.model("GeneralSetting", generalSettingSchema);
