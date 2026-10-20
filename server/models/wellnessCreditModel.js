// models/wellnessCreditModel.js
const mongoose = require("mongoose");

// Audit trail for admin edits (written by services/adminWellnessCredit.service.js).
// Hidden from normal queries (select: false) so existing endpoints are unaffected.
const editHistorySchema = new mongoose.Schema(
  {
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    editedAt: { type: Date, default: Date.now },
    reason: { type: String, trim: true, maxlength: 500 },
    changes: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: true },
);

const wellnessCreditSchema = new mongoose.Schema(
  {
    // General info (shared by all employees in this batch)
    dateApproved: { type: Date, required: true },

    // Total days credited in this transaction
    days: { type: Number, required: true },

    // Employee-level credits
    employees: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
          required: true,
        },

        creditedDays: { type: Number, required: true },

        usedDays: { type: Number, default: 0 }, // Approved and utilized Wellness days
        reservedDays: { type: Number, default: 0 }, // Pending/Locked Wellness days
        remainingDays: { type: Number, required: true }, // credited - used - reserved

        status: {
          type: String,
          enum: ["ACTIVE", "EXHAUSTED", "ROLLEDBACK", "EXPIRED"],
          default: "ACTIVE",
        },

        dateCredited: { type: Date, required: true },
      },
    ],

    status: {
      type: String,
      enum: ["CREDITED", "ROLLEDBACK", "EXPIRED"],
      default: "CREDITED",
    },

    dateCredited: { type: Date, default: Date.now },
    dateRolledBack: Date,

    creditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    rolledBackBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },

    // ✅ NEW: admin edit log (optional — the admin service works without it)
    editHistory: { type: [editHistorySchema], default: [], select: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("WellnessCredit", wellnessCreditSchema);
