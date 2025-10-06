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
      enum: ["PENDING", "APPROVED", "DENIED"],
      default: "PENDING",
    },
    reviewedAt: { type: Date },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ApprovalStep", approvalStepSchema);
