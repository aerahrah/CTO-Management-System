const mongoose = require("mongoose");

const ctoCreditSchema = new mongoose.Schema(
  {
    // Memo-level info (shared by all employees)
    memoNo: { type: String, required: true },
    dateApproved: { type: Date, required: true },
    uploadedMemo: { type: String, required: true },

    // Inclusive dates of the overtime (handles single or multi-day)
    inclusiveDates: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },

    // Generalized description of the activity/task performed
    purpose: { type: String, required: true },

    // Strict validation for the 40-hour limit
    duration: {
      hours: {
        type: Number,
        required: true,
        min: 0,
        max: 40,
      },
      minutes: {
        type: Number,
        required: true,
        min: 0,
        max: 59,
        validate: {
          validator: function (minutesValue) {
            // 'this' refers to the current document being saved
            if (this.duration.hours === 40 && minutesValue > 0) {
              return false;
            }
            return true;
          },
          message:
            "Total duration cannot exceed exactly 40 hours (if hours is 40, minutes must be 0).",
        },
      },
    },

    // Employee-level credits
    employees: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
          required: true,
        },

        creditedHours: { type: Number, required: true },

        usedHours: { type: Number, default: 0 }, // approved CTO
        reservedHours: { type: Number, default: 0 }, // pending CTO
        remainingHours: { type: Number, required: true }, // credited - used - reserved
        forfeitedHours: { type: Number, default: 0 }, // Tracks excess hours lost due to CSC caps

        status: {
          type: String,
          enum: ["ACTIVE", "EXHAUSTED", "ROLLEDBACK"],
          default: "ACTIVE",
        },

        dateCredited: { type: Date, required: true },
      },
    ],

    status: {
      type: String,
      enum: ["CREDITED", "ROLLEDBACK"],
      default: "CREDITED",
    },

    dateCredited: { type: Date, default: Date.now },
    dateRolledBack: Date,

    creditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    rolledBackBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CtoCredit", ctoCreditSchema);
