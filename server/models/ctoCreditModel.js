const mongoose = require("mongoose");

const ctoCreditSchema = new mongoose.Schema(
  {
    // Memo-level info (shared by all employees)
    memoNo: { type: String, required: true },
    dateApproved: { type: Date, required: true },
    uploadedMemo: { type: String, required: true },

    duration: {
      hours: { type: Number, required: true },
      minutes: { type: Number, required: true },
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
  { timestamps: true }
);

module.exports = mongoose.model("CtoCredit", ctoCreditSchema);
