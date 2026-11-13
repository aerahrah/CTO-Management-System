// models/scheduledJobSettingModel.js
// One document per scheduled job (e.g. "cto_pending_digest").
// Common schedule fields live at the top level; anything specific to one job
// can go in `options` without changing this schema.
const mongoose = require("mongoose");

const scheduledJobSettingSchema = new mongoose.Schema(
  {
    jobKey: { type: String, required: true, trim: true, unique: true },
    enabled: { type: Boolean, default: true },
    time: {
      type: String,
      default: "17:00", // 24-hour HH:MM, office timezone (Asia/Manila)
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM format."],
    },
    includeWeekends: { type: Boolean, default: false },
    options: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true, minimize: false },
);

module.exports =
  mongoose.models.ScheduledJobSetting ||
  mongoose.model("ScheduledJobSetting", scheduledJobSettingSchema);
