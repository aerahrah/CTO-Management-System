// models/emailThreadModel.js
const mongoose = require("mongoose");

// One record per (recipient, conversation). It remembers the Message-IDs of
// emails already sent, so the next email can point back at them and the
// recipient's mail app shows it in the same thread.
const emailThreadSchema = new mongoose.Schema(
  {
    // SHA-256 of the recipient address(es); the plain address isn't stored here
    recipientHash: { type: String, required: true },

    // What the conversation is about, e.g. "cto:65f0c3a1..." (see utils/emailThread.js)
    threadKey: { type: String, required: true },

    // Subject every email in this thread uses. Gmail only groups emails whose
    // subjects match (ignoring "Re:"), so it is fixed by the first email.
    subject: { type: String, required: true },

    rootMessageId: { type: String, required: true },
    lastMessageId: { type: String, default: null },

    // Most recent Message-IDs sent in this thread, oldest first (capped)
    references: { type: [String], default: [] },

    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

emailThreadSchema.index({ recipientHash: 1, threadKey: 1 }, { unique: true });

// Threads untouched for a year are removed; a later email just starts a new thread
emailThreadSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 },
);

module.exports =
  mongoose.models.EmailThread ||
  mongoose.model("EmailThread", emailThreadSchema);
