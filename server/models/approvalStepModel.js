const mongoose = require("mongoose");

const approvalStepSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
    },
    reviewedAt: { type: Date },
    remarks: { type: String, trim: true },
    ctoApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CtoApplication",
      required: false,
    },
    wellnessApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WellnessApplication",
      required: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ApprovalStep", approvalStepSchema);
