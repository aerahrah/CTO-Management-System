// models/jobRunModel.js
// One document per scheduled-job run. The unique (job, runKey) index is what
// guarantees the daily digest is sent only once, even with several app instances.
const mongoose = require("mongoose");

const jobRunSchema = new mongoose.Schema(
  {
    job: { type: String, required: true, trim: true },
    runKey: { type: String, required: true, trim: true }, // e.g. "2026-11-04"
    status: {
      type: String,
      enum: ["RUNNING", "DONE", "FAILED"],
      default: "RUNNING",
    },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    stats: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
  },
  { timestamps: true },
);

jobRunSchema.index({ job: 1, runKey: 1 }, { unique: true });
// Housekeeping: run logs are removed automatically after 90 days
jobRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports =
  mongoose.models.JobRun || mongoose.model("JobRun", jobRunSchema);
