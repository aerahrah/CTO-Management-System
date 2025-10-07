const mongoose = require("mongoose");

const ctoApproverSettingSchema = new mongoose.Schema(
  {
    provincialOffice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProvincialOffice",
      required: true,
      unique: true,
    },
    level1Approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    level2Approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    level3Approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CtoApproverSetting", ctoApproverSettingSchema);
