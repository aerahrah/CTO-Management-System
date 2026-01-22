const mongoose = require("mongoose");

const designationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g. "Isabela Provincial Office - Cauayan"
    province: { type: String, required: false },
    region: { type: String, default: "Region II - Cagayan Valley" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Designation", designationSchema);
