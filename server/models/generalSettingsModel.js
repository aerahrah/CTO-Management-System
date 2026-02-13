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
      default: 1440,
      min: 1,
      max: 60 * 24 * 30,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("GeneralSetting", generalSettingSchema);
