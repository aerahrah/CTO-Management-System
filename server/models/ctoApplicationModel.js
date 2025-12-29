const mongoose = require("mongoose");

const ctoApplicationSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    requestedHours: {
      type: Number,
      required: true,
    },
    inclusiveDates: {
      type: [Date],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    memo: [
      {
        memoId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "CtoCredit",
          required: true,
        },
        uploadedMemo: {
          type: String, 
          required: true,
        },
      },
    ],
    approvals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ApprovalStep",
        required: true,
      },
    ],
    overallStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    attachment: {
      fileName: { type: String },
      fileUrl: { type: String },
      fileType: { type: String },
      uploadedAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CtoApplication", ctoApplicationSchema);
