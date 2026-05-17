const mongoose = require("mongoose");

const wellnessApplicationSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    inclusiveDates: [
      {
        type: Date,
        required: true,
      },
    ],
    totalDays: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    approvals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ApprovalStep",
        required: true,
      },
    ],
    overallStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
    },
    attachment: {
      fileName: { type: String },
      fileUrl: { type: String },
      fileType: { type: String },
      uploadedAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "WellnessApplication",
  wellnessApplicationSchema,
);
