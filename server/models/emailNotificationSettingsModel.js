// models/emailNotificationSettingsModel.js
const mongoose = require("mongoose");

const EmailNotificationSettingsSchema = new mongoose.Schema(
  {
    flags: { type: Map, of: Boolean, default: {} },

    // Already set by updateEmailNotificationSetting, but was silently dropped
    // because it wasn't in the schema.
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "EmailNotificationSettings",
  EmailNotificationSettingsSchema,
);
