const mongoose = require("mongoose");

const provincialOfficeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g. "Isabela Provincial Office - Cauayan"
    code: { type: String, required: true, unique: true }, // e.g. "ISA-CYN"
    province: { type: String, required: true }, // e.g. "Isabela"
    region: { type: String, default: "Region II - Cagayan Valley" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProvincialOffice", provincialOfficeSchema);
