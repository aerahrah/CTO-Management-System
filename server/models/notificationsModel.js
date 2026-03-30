const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "CTO_APPLICATION_SUBMITTED",
        "CTO_APPLICATION_APPROVED",
        "CTO_APPLICATION_REJECTED",
        "CTO_APPLICATION_CANCELLED",
        "CTO_CREDITED",
        "CTO_ROLLEDBACK",
        "GENERAL",
      ],
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    link: {
      type: String,
      default: "",
      trim: true,
    },

    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },

    metadata: {
      ctoApplicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CtoApplication",
        default: null,
      },
      approvalStepId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ApprovalStep",
        default: null,
      },
      ctoCreditId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CtoCredit",
        default: null,
      },
      employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null,
      },
      extra: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
