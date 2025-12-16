const mongoose = require("mongoose");

const ctoCreditSchema = new mongoose.Schema(
  {
    memoNo: { type: String, required: true },
    dateApproved: { type: Date, required: true },
    uploadedMemo: { type: String, required: true },
    duration: {
      hours: { type: Number, required: true },
      minutes: { type: Number, required: true },
    },
    totalHours: { type: Number, required: true },
    employees: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
          required: true,
        },
        appliedHours: { type: Number, default: 0 }, // hours already applied
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
