// utils/emailThread.js
//
// Puts emails about the same thing (e.g. one CTO application) to the same
// recipient into ONE thread in their inbox.
//
// How mail apps decide what's a thread:
//   • Gmail: the subject must match (a leading "Re:" is ignored) AND the email's
//     In-Reply-To / References headers must point at an earlier email in the thread.
//   • Outlook / Apple Mail / Thunderbird: the same headers and subject.
//
// So for each (recipient, threadKey) we store the Message-IDs we've sent, give
// every email the same subject, and point each new email back at the earlier ones.

const crypto = require("crypto");
const EmailThread = require("../models/emailThreadModel");

const MAX_REFERENCES = 20; // keeps the References header short on long threads
const TIME_ZONE = "Asia/Manila";

// ─── Recipient / header helpers ─────────────────────────────────────────────

// "Juan <JUAN@x.gov.ph>", ["a@x", "b@x"], { address } → ["a@x", "b@x", "juan@x.gov.ph"]
function recipientAddresses(to) {
  const out = [];
  for (const item of [].concat(to || [])) {
    if (!item) continue;
    if (typeof item === "object") {
      if (item.address) out.push(item.address);
      continue;
    }
    for (const part of String(item).split(",")) {
      const bracketed = part.match(/<([^>]+)>/);
      const addr = (bracketed ? bracketed[1] : part).trim();
      if (addr.includes("@")) out.push(addr);
    }
  }
  return [...new Set(out.map((a) => a.toLowerCase()))].sort();
}

function hashRecipients(to) {
  const addrs = recipientAddresses(to);
  if (!addrs.length) return null;
  return crypto.createHash("sha256").update(addrs.join(",")).digest("hex");
}

// A well-formed Message-ID on the sender's own domain. Gmail keeps a custom
// Message-ID as long as it is valid, so the IDs we store are the ones delivered.
function newMessageId(fromAddress) {
  const domain = String(fromAddress || "").split("@")[1] || "localhost";
  return `<${crypto.randomUUID()}@${domain}>`;
}

function cleanSubject(subject) {
  return String(subject || "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function stripReplyPrefix(subject) {
  let s = cleanSubject(subject);
  while (/^(re|fwd?)\s*:\s*/i.test(s)) s = s.replace(/^(re|fwd?)\s*:\s*/i, "");
  return s;
}

// ─── Thread store ───────────────────────────────────────────────────────────

// Returns the existing thread, or null if this call just created it.
async function claimThread(filter, onInsert) {
  try {
    return await EmailThread.findOneAndUpdate(
      filter,
      { $setOnInsert: onInsert },
      { upsert: true, returnDocument: "before" },
    ).lean();
  } catch (err) {
    // Another request created the same thread a moment earlier: use theirs
    if (err?.code === 11000) return EmailThread.findOne(filter).lean();
    throw err;
  }
}

function recordSent(filter, messageId) {
  return EmailThread.updateOne(filter, {
    $set: { lastMessageId: messageId },
    $inc: { messageCount: 1 },
    $push: { references: { $each: [messageId], $slice: -MAX_REFERENCES } },
  });
}

/**
 * Works out the subject and threading headers for one outgoing email.
 *
 * @param {object} p
 * @param {*}      p.to          recipient(s), as passed to nodemailer
 * @param {object} p.thread      { key, subject } (build it with ctoThread / wellnessThread)
 * @param {string} p.subject     the template's own subject (used if thread.subject is empty)
 * @param {string} p.fromAddress sender address, for the Message-ID domain
 * @returns {Promise<null | {
 *   subject: string,
 *   fields: { messageId: string, inReplyTo?: string, references?: string[] },
 *   isReply: boolean,
 *   markSent: () => Promise<any>,
 *   markFailed: () => Promise<any>,
 * }>} null when no thread applies (send as a normal email)
 */
async function prepareThreadedEmail({ to, thread, subject, fromAddress }) {
  const threadKey = String(thread?.key || "").trim();
  const recipientHash = hashRecipients(to);
  if (!threadKey || !recipientHash) return null;

  const filter = { recipientHash, threadKey };
  const messageId = newMessageId(fromAddress);
  const threadSubject = cleanSubject(thread.subject) || cleanSubject(subject);

  const existing = await claimThread(filter, {
    subject: threadSubject,
    rootMessageId: messageId,
  });

  // First email of this conversation for this recipient: it starts the thread
  if (!existing) {
    return {
      subject: threadSubject,
      fields: { messageId },
      isReply: false,
      markSent: () => recordSent(filter, messageId),
      // Nothing was delivered, so forget the thread; the next email starts it again
      markFailed: () =>
        EmailThread.deleteOne({
          ...filter,
          rootMessageId: messageId,
          messageCount: 0,
        }),
    };
  }

  // Later email: same subject, pointing back at the earlier ones
  const references = [
    ...new Set([
      existing.rootMessageId,
      ...(existing.references || []).slice(-(MAX_REFERENCES - 1)),
    ]),
  ];

  return {
    subject: `Re: ${stripReplyPrefix(existing.subject)}`,
    fields: {
      messageId,
      inReplyTo: existing.lastMessageId || existing.rootMessageId,
      references,
    },
    isReply: true,
    markSent: () => recordSent(filter, messageId),
    markFailed: async () => {}, // the thread itself is still valid
  };
}

// ─── Thread builders (use these everywhere so keys always match) ────────────

function personName(person) {
  if (!person || typeof person !== "object") return "";
  return `${person.firstName || ""} ${person.lastName || ""}`.trim();
}

function toDateList(dates) {
  if (!dates) return [];
  if (Array.isArray(dates)) return dates;
  if (typeof dates === "object") return [dates.startDate, dates.endDate];
  return [dates];
}

// [Mar 3, Mar 5 2026] → "Mar 3-5, 2026"; spans months/years are written out
function formatDateRange(dates) {
  const valid = toDateList(dates)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a - b);
  if (!valid.length) return "";

  const parts = (d) => {
    const p = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
    })
      .formatToParts(d)
      .forEach(({ type, value }) => (p[type] = value));
    return p;
  };

  const a = parts(valid[0]);
  const b = parts(valid[valid.length - 1]);

  if (a.year === b.year && a.month === b.month && a.day === b.day)
    return `${a.month} ${a.day}, ${a.year}`;
  if (a.year === b.year && a.month === b.month)
    return `${a.month} ${a.day}-${b.day}, ${a.year}`;
  if (a.year === b.year)
    return `${a.month} ${a.day} - ${b.month} ${b.day}, ${a.year}`;
  return `${a.month} ${a.day}, ${a.year} - ${b.month} ${b.day}, ${b.year}`;
}

function shortRef(id) {
  return String(id).slice(-6).toUpperCase();
}

function buildSubject(label, applicant, dates, id) {
  const name = personName(applicant);
  const range = formatDateRange(dates);
  return [
    `${label}${name ? `: ${name}` : ""}`,
    range && `(${range})`,
    `[Ref ${shortRef(id)}]`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Thread for every email about one CTO application.
 * e.g. { key: "cto:65f0...", subject: "CTO Application: Juan Dela Cruz (Mar 3-5, 2026) [Ref A1B2C3]" }
 *
 * @param application CTO application (document or lean), or just its _id
 * @param employee    the applicant, if application.employee isn't populated
 */
function ctoThread(application, employee) {
  const id = application?._id || application;
  if (!id) return null;
  const applicant = employee || application?.employee;
  return {
    key: `cto:${id}`,
    subject: buildSubject(
      "CTO Application",
      applicant,
      application?.inclusiveDates,
      id,
    ),
  };
}

/** Same as ctoThread, for Wellness Leave applications. */
function wellnessThread(application, employee) {
  const id = application?._id || application;
  if (!id) return null;
  const applicant = employee || application?.employee;
  return {
    key: `wellness:${id}`,
    subject: buildSubject(
      "Wellness Leave",
      applicant,
      application?.inclusiveDates,
      id,
    ),
  };
}

module.exports = {
  prepareThreadedEmail,
  ctoThread,
  wellnessThread,
  // exported for tests
  recipientAddresses,
  formatDateRange,
};
