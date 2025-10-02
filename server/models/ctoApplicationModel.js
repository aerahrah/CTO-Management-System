const mongoose = require("mongoose");
const approvalStepSchema = require("./approvalStepModel");

const ctoApplicationSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true, // Who applied
    },
    requestedHours: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    // File upload info
    attachment: {
      fileName: { type: String },
      fileUrl: { type: String },
      fileType: { type: String },
      uploadedAt: { type: Date, default: Date.now },
    },
    overallStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "DENIED"],
      default: "PENDING",
    },
    approvals: {
      type: [approvalStepSchema],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CtoApplication", ctoApplicationSchema);
