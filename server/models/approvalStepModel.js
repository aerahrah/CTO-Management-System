// models/approvalStepModel.js
const mongoose = require("mongoose");
const { APPROVAL_ROLE_VALUES } = require("../constants/approvalRoles");

const approvalStepSchema = new mongoose.Schema(
  {
    level: {
      type: Number,
      required: true,
    },

    // We keep the reference so we can link back to the user account
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    role: {
      type: String,
      enum: {
        values: APPROVAL_ROLE_VALUES,
        message: "{VALUE} is not a valid approval role",
      },
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
    },

    reviewedAt: {
      type: Date,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: [1000, "Remarks cannot exceed 1000 characters"],
    },

    // =========================================
    // HISTORICAL SNAPSHOT (Immutability)
    // =========================================
    // Captures the exact details of the approver when they hit "Approve/Reject".
    // This ensures that past PDF forms retain the correct name, position,
    // and signature of the approver at that exact moment in time.
    approverSnapshot: {
      prefixTitle: { type: String, trim: true, default: "" },
      firstName: { type: String, trim: true },
      middleName: { type: String, trim: true, default: "" },
      lastName: { type: String, trim: true },
      nameExtension: { type: String, trim: true, default: "" },
      postfixTitle: { type: String, trim: true, default: "" },
      position: { type: String, trim: true },
      signatureUrl: { type: String, trim: true },
      signedAt: { type: Date },
    },

    ctoApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CtoApplication",
    },

    wellnessApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WellnessApplication",
    },
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.ApprovalStep ||
  mongoose.model("ApprovalStep", approvalStepSchema);
