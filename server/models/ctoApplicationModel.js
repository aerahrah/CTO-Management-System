const mongoose = require("mongoose");

const CtoApplicationSchema = new mongoose.Schema(
  {
    // =========================================
    // BASE FIELDS (Required for everyone)
    // =========================================
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    notifiedEmployees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
      },
    ],
    employeeType: {
      type: String,
      enum: ["Organic", "JO"],
      required: true,
    },

    // =========================================
    // HISTORICAL SNAPSHOT (Immutability)
    // =========================================
    applicantSnapshot: {
      prefixTitle: { type: String, trim: true, default: "" },
      firstName: { type: String, required: true, trim: true },
      middleName: { type: String, trim: true, default: "" },
      lastName: { type: String, required: true, trim: true },
      nameExtension: { type: String, trim: true, default: "" },
      postfixTitle: { type: String, trim: true, default: "" },
      division: { type: String, required: true, trim: true },
      position: { type: String, required: true, trim: true },

      salaryGrade: {
        type: Number,
        required: function () {
          return this.employeeType === "Organic";
        },
      },
      salaryAmount: {
        type: Number,
        required: function () {
          return this.employeeType === "Organic";
        },
      },
    },

    requestedHours: {
      type: Number,
      required: true,
      min: [1, "Requested hours must be at least 1"],
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
      maxlength: [1000, "Reason cannot exceed 1000 characters"],
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
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "REVOCATION_REQUESTED",
        "REVOKED",
      ],
      default: "PENDING",
    },
    attachment: {
      fileName: { type: String, trim: true, maxlength: 255 },
      fileUrl: { type: String, trim: true, maxlength: 500 },
      fileType: {
        type: String,
        trim: true,
        enum: ["application/pdf", "image/jpeg", "image/png"],
      },
      uploadedAt: { type: Date, default: Date.now },
    },
    lateFiling: {
      isLateFiling: {
        type: Boolean,
        default: false,
      },
      justification: {
        type: String,
        trim: true,
        maxlength: [1000, "Justification cannot exceed 1000 characters"],
        required: function () {
          return this.lateFiling && this.lateFiling.isLateFiling === true;
        },
      },
      attachment: {
        fileName: { type: String, trim: true, maxlength: 255 },
        fileUrl: { type: String, trim: true, maxlength: 500 },
        fileType: {
          type: String,
          trim: true,
          enum: ["application/pdf", "image/jpeg", "image/png"],
        },
        uploadedAt: { type: Date },
      },
    },

    // =========================================
    // ORGANIC-SPECIFIC FIELDS
    // =========================================
    applicantSignatureUrl: {
      type: String,
      required: function () {
        return this.employeeType === "Organic";
      },
    },
    commutation: {
      type: String,
      enum: ["Requested", "Not Requested"],
      default: "Not Requested",
      required: function () {
        return this.employeeType === "Organic";
      },
    },
    certificationOfLeaveCredits: {
      asOfDate: { type: Date },
      vacationLeave: {
        totalEarned: { type: Number, default: 0 },
        lessThisApplication: { type: Number, default: 0 },
        balance: { type: Number, default: 0 },
      },
      sickLeave: {
        totalEarned: { type: Number, default: 0 },
        lessThisApplication: { type: Number, default: 0 },
        balance: { type: Number, default: 0 },
      },
      certifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
      },
    },
    actionDetails: {
      approvedDaysWithPay: { type: Number },
      approvedDaysWithoutPay: { type: Number },
      approvedOthersSpecify: { type: String, trim: true },
      disapprovedDueTo: { type: String, trim: true },
    },

    // =========================================
    // 2-STEP REVOCATION WORKFLOW & HISTORY
    // =========================================

    // 1. Current / Active Employee Request Details
    revocationRequest: {
      reason: { type: String, trim: true, maxlength: 1000 },
      attachment: {
        fileName: { type: String, trim: true, maxlength: 255 },
        fileUrl: { type: String, trim: true, maxlength: 500 },
        fileType: {
          type: String,
          trim: true,
          enum: ["application/pdf", "image/jpeg", "image/png"],
        },
        uploadedAt: { type: Date },
      },
      requestedAt: { type: Date },
    },

    // 2. Current / Active HR Action Details
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    revokeReason: { type: String, trim: true },
    revokedAt: { type: Date },

    // 3. History of past revocation attempts (rejections or cancellations)
    revocationHistory: [
      {
        // Employee's Request
        reason: { type: String, trim: true, maxlength: 1000 },
        attachment: {
          fileName: { type: String, trim: true, maxlength: 255 },
          fileUrl: { type: String, trim: true, maxlength: 500 },
          fileType: { type: String, trim: true },
          uploadedAt: { type: Date },
        },
        requestedAt: { type: Date },

        // Outcome / Response
        status: {
          type: String,
          enum: ["APPROVED", "REJECTED", "CANCELLED"],
          required: true,
        },
        processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
        remarks: { type: String, trim: true },
        processedAt: { type: Date },
      },
    ],
  },
  {
    timestamps: true,
    strict: true,
  },
);

module.exports = mongoose.model("CtoApplication", CtoApplicationSchema);
