const mongoose = require("mongoose");

const ctoCreditSchema = new mongoose.Schema(
  {
    employees: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    ],
    duration: {
      hours: { type: Number, required: true },
      minutes: { type: Number, required: true },
    },
    memoNo: { type: String, required: true },

    status: {
      type: String,
      enum: ["CREDITED", "ROLLEDBACK"],
      default: "CREDITED",
    },
    dateCredited: { type: Date, default: Date.now },
    dateRolledBack: Date,
    creditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    dateApproved: { type: Date, required: true },
    uploadedMemo: { type: String },
    rolledBackBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    // approver: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Employee",
    // },
    // status: {
    //   type: String,
    //   enum: ["PENDING", "APPROVED", "REJECTED", "CANCELED"],
    //   default: "PENDING",
    // },
    // canceledAt: { type: Date },
    // canceledBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    // remarks: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CtoCredit", ctoCreditSchema);
