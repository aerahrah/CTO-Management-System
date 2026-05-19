const mongoose = require("mongoose");

const ctoApplicationSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true, // Speeds up queries when searching by employee
    },
    requestedHours: {
      type: Number,
      required: true,
      min: [1, "Requested hours must be at least 1"], // Adjust minimum as per your business logic
      max: [300, "Requested hours exceed maximum logical limit"],
    },
    inclusiveDates: {
      type: [Date],
      required: true,
      validate: {
        validator: function (arr) {
          return arr && arr.length > 0;
        },
        message: "At least one date must be selected.",
      },
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, "Reason cannot exceed 1000 characters"], // Prevents payload overload
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
          trim: true,
          maxlength: [500, "URL/Path is too long"],
        },
        appliedHours: {
          type: Number,
          required: true,
          min: [0.5, "Applied hours cannot be negative or zero"],
        },
      },
    ],
    approvals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ApprovalStep",
      },
    ],
    overallStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
    },
    attachment: {
      fileName: {
        type: String,
        trim: true,
        maxlength: [255, "Filename too long"],
      },
      fileUrl: {
        type: String,
        trim: true,
        maxlength: [500, "URL too long"],
      },
      fileType: {
        type: String,
        trim: true,
        // STRICT ALLOWLIST: Only allow specific safe file types
        enum: {
          values: ["application/pdf", "image/jpeg", "image/png"],
          message: "{VALUE} is not an allowed file type",
        },
      },
      uploadedAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
    strict: true,
  },
);

module.exports = mongoose.model("CtoApplication", ctoApplicationSchema);
