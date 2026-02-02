const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    username: { type: String, default: "Guest" }, // actor's username
    method: { type: String, required: true },
    url: { type: String, required: true },
    endpoint: { type: String, required: true },
    statusCode: { type: Number },
    ip: { type: String },
    requestBody: { type: Object }, // raw request body
    timestamp: { type: Date, default: Date.now },
    summary: { type: String, default: "" },

    details: { type: Object, default: {} },
  },
  { timestamps: false },
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
