// models/emailNotificationSettingsModel.js
const mongoose = require("mongoose");

const EmailNotificationSettingsSchema = new mongoose.Schema(
  {
    flags: { type: Map, of: Boolean, default: {} },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "EmailNotificationSettings",
  EmailNotificationSettingsSchema,
);
