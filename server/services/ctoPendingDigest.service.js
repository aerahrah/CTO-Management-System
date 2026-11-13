// services/ctoPendingDigest.service.js
//
// End-of-day "pending CTO approvals" digest.
// Sends ONE email per approver listing every CTO application that is
// currently waiting on *their* step, each with a button that opens it.
//
// On/off, time of day and weekends are admin settings on the Scheduled Jobs page,
// stored by services/scheduledJobSettings.service.js (job key "cto_pending_digest").
// cron/ctoPendingDigest.job.js checks every minute and sends once the time is reached.
// Can also be run by hand:
//   node scripts/runCtoPendingDigest.js --dry-run
const mongoose = require("mongoose");
const CtoApplication = require("../models/ctoApplicationModel");
const Employee = require("../models/employeeModel");
require("../models/approvalStepModel"); // registers "ApprovalStep" for .populate("approvals") outside the server (e.g. the manual script)
const JobRun = require("../models/jobRunModel");
const NotificationService = require("./notificationService");
const jobSettingsService = require("./scheduledJobSettings.service");

const sendEmail = require("../utils/sendEmail");
const { ctoPendingDigestEmail } = require("../utils/emailTemplates");

const JOB_KEY = "cto_pending_digest"; // key on the Scheduled Jobs page

// Read through the module (not destructured) so a circular import can't leave it undefined
function getDigestSettings() {
  return jobSettingsService.getJobSettings(JOB_KEY);
}

const JOB_NAME = "CTO_PENDING_DIGEST";
const TIMEZONE = process.env.CTO_DIGEST_TIMEZONE || "Asia/Manila";
const MAX_ITEMS_PER_EMAIL = 50; // longest-waiting first; the rest are summarized
const SEND_CONCURRENCY = 5; // parallel emails, kept low for SMTP rate limits
const DAY_MS = 24 * 60 * 60 * 1000;

// If the server was down at the scheduled time, still send if it comes back
// within this many minutes. After that, wait for the next scheduled day.
const CATCH_UP_MINUTES = Math.min(
  Math.max(parseInt(process.env.CTO_DIGEST_CATCH_UP_MINUTES, 10) || 60, 1),
  720,
);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
});

/* =========================
   Helpers
========================= */

const U = (v) => String(v || "").toUpperCase();

// Works for populated docs, raw ObjectIds and strings
function idOf(value) {
  const id = value?._id ?? value;
  return id ? String(id) : null;
}

function fullNameOf(person) {
  const first = person?.firstName || "";
  const last = person?.lastName || "";
  return (first + " " + last).trim();
}

function frontendBaseUrl() {
  return String(process.env.FRONTEND_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

// "2026-11-04" in the digest timezone (used as the once-per-day run key)
function dayKey(date, timeZone = TIMEZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function calendarDaysBetween(from, to) {
  const a = Date.parse(dayKey(from) + "T00:00:00Z");
  const b = Date.parse(dayKey(to) + "T00:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(Math.round((b - a) / DAY_MS), 0);
}

function isValidDate(d) {
  return d && !Number.isNaN(new Date(d).getTime());
}

// Same "November 3, 2026" style as the other emails, but pinned to the
// office timezone so a UTC server doesn't shift dates back by a day.
function formatDateHuman(date) {
  if (!isValidDate(date)) return "";
  return new Date(date).toLocaleDateString("en-PH", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateRangeHuman(dates) {
  if (!Array.isArray(dates)) return "";
  const valid = dates
    .filter(isValidDate)
    .map((d) => new Date(d))
    .sort((a, b) => a - b);
  if (!valid.length) return "";
  const first = formatDateHuman(valid[0]);
  const last = formatDateHuman(valid[valid.length - 1]);
  return first === last ? first : first + " to " + last;
}

function formatAsOf(date) {
  return new Date(date).toLocaleString("en-PH", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* =========================
   Schedule helpers (all in the office timezone)
========================= */

// Wall-clock parts of `date` in the office timezone
function zonedParts(date, timeZone = TIMEZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(new Date(date))
      .map((p) => [p.type, p.value]),
  );

  return {
    dateKey: parts.year + "-" + parts.month + "-" + parts.day,
    weekday: WEEKDAYS.indexOf(parts.weekday), // 0 = Sunday
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const isWeekend = (weekday) => weekday === 0 || weekday === 6;

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

// Calendar arithmetic on "YYYY-MM-DD" keys (timezone-independent)
function addDays(dateKey, n) {
  return new Date(Date.parse(dateKey + "T12:00:00Z") + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function weekdayOfKey(dateKey) {
  return new Date(dateKey + "T12:00:00Z").getUTCDay();
}

// "2026-11-05" + "17:00" in the office timezone → the real Date (UTC instant)
function zonedTimeToUtc(dateKey, hhmm) {
  const guess = Date.parse(dateKey + "T" + hhmm + ":00Z");
  const p = zonedParts(guess);
  const [y, mo, d] = p.dateKey.split("-").map(Number);
  const localAsUtc = Date.UTC(
    y,
    mo - 1,
    d,
    Math.floor(p.minutes / 60),
    p.minutes % 60,
  );
  return new Date(guess - (localAsUtc - guess));
}

function formatDateTimeLong(date) {
  return new Date(date).toLocaleString("en-PH", {
    timeZone: TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Is the digest due right now under this schedule?
 * Due = allowed day AND scheduled time <= now < scheduled time + catch-up window.
 */
function getScheduleState(schedule, now = new Date()) {
  const p = zonedParts(now);
  const target = toMinutes(schedule.time);

  if (!schedule.includeWeekends && isWeekend(p.weekday)) {
    return { due: false, reason: "WEEKEND", runKey: p.dateKey };
  }
  if (p.minutes < target) {
    return { due: false, reason: "NOT_YET", runKey: p.dateKey };
  }
  if (p.minutes >= target + CATCH_UP_MINUTES) {
    return { due: false, reason: "WINDOW_PASSED", runKey: p.dateKey };
  }
  return { due: true, reason: null, runKey: p.dateKey };
}

/** When will the next digest go out? (for the settings page) */
function computeNextRun(schedule, now = new Date(), ranToday = false) {
  const today = zonedParts(now).dateKey;
  const nowMs = new Date(now).getTime();

  for (let i = 0; i < 8; i++) {
    const key = addDays(today, i);
    if (!schedule.includeWeekends && isWeekend(weekdayOfKey(key))) continue;

    const at = zonedTimeToUtc(key, schedule.time);

    if (i === 0) {
      if (ranToday) continue;
      if (nowMs >= at.getTime() + CATCH_UP_MINUTES * 60 * 1000) continue;
      // Time already reached but not sent yet → goes out on the next minute tick
      if (nowMs >= at.getTime())
        return new Date(Math.floor(nowMs / 60000) * 60000 + 60000);
    }
    return at;
  }
  return null;
}

async function runInBatches(items, size, worker) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(worker));
  }
}

/* =========================
   Who is waiting on whom
========================= */

/**
 * Returns the step whose turn it is: the lowest-level step that is still
 * PENDING, provided every lower level has already APPROVED. This mirrors the
 * "Level N must approve first" rule in ctoApproval.service, so an approver is
 * only reminded when they can actually act.
 */
function findCurrentStep(approvals = []) {
  const ordered = (Array.isArray(approvals) ? approvals : [])
    .filter(Boolean)
    .sort((a, b) => Number(a?.level || 0) - Number(b?.level || 0));

  for (let i = 0; i < ordered.length; i++) {
    const status = U(ordered[i].status);
    if (status === STATUS.APPROVED) continue;
    if (status !== STATUS.PENDING) return null; // rejected / cancelled blocks the chain
    return { step: ordered[i], previous: ordered[i - 1] || null };
  }
  return null;
}

function toDigestItem(app, current, now, baseUrl) {
  const { step, previous } = current;

  // "Waiting on you since": when the previous level signed, or when it was filed
  const waitingSince =
    (previous && isValidDate(previous.reviewedAt) && previous.reviewedAt) ||
    app.createdAt ||
    now;

  return {
    applicationId: String(app._id),
    employeeName: fullNameOf(app.employee) || "Employee",
    position: app.employee?.position || "",
    requestedHours: Number(app.requestedHours) || 0,
    inclusiveDates: formatDateRangeHuman(app.inclusiveDates),
    dayCount: Array.isArray(app.inclusiveDates) ? app.inclusiveDates.length : 0,
    reason: String(app.reason || "").trim(),
    filedAt: formatDateHuman(app.createdAt),
    level: step.level ?? null,
    daysWaiting: calendarDaysBetween(waitingSince, now),
    waitingSinceMs: new Date(waitingSince).getTime(),
    link: baseUrl + "/app/cto-approvals/" + encodeURIComponent(String(app._id)),
  };
}

/**
 * Pure function (no DB): groups pending applications by the approver whose
 * turn it is. Returns Map<approverId, item[]>, items sorted longest-waiting first.
 */
function groupPendingByApprover(apps, { now = new Date(), baseUrl = "" } = {}) {
  const groups = new Map();

  for (const app of apps || []) {
    if (!app?._id) continue;
    if (U(app.overallStatus) !== STATUS.PENDING) continue;

    const current = findCurrentStep(app.approvals);
    if (!current) continue;

    const approverId = idOf(current.step.approver);
    if (!approverId || !mongoose.isValidObjectId(approverId)) continue;

    if (!groups.has(approverId)) groups.set(approverId, []);
    groups.get(approverId).push(toDigestItem(app, current, now, baseUrl));
  }

  for (const items of groups.values()) {
    items.sort((a, b) => a.waitingSinceMs - b.waitingSinceMs);
  }
  return groups;
}

async function collectDigests({ now, baseUrl }) {
  const apps = await CtoApplication.find({ overallStatus: STATUS.PENDING })
    .select(
      "employee approvals overallStatus requestedHours inclusiveDates reason createdAt",
    )
    .populate({ path: "employee", select: "firstName lastName position" })
    .populate({ path: "approvals", select: "approver status level reviewedAt" })
    .lean();

  const groups = groupPendingByApprover(apps, { now, baseUrl });
  if (groups.size === 0) return [];

  const approvers = await Employee.find({ _id: { $in: [...groups.keys()] } })
    .select("firstName lastName email")
    .lean();
  const byId = new Map(approvers.map((a) => [String(a._id), a]));

  return [...groups.entries()].map(([approverId, items]) => ({
    approverId,
    approver: byId.get(approverId) || null,
    items,
  }));
}

/* =========================
   Once-per-day lock
   (prevents duplicate emails when several app instances run the cron)
========================= */

let indexesReady = null;
function ensureJobIndexes() {
  if (!indexesReady) {
    indexesReady = JobRun.createIndexes().catch((e) => {
      indexesReady = null;
      throw e;
    });
  }
  return indexesReady;
}

async function acquireRunLock(runKey) {
  try {
    await JobRun.create({
      job: JOB_NAME,
      runKey,
      status: "RUNNING",
      startedAt: new Date(),
    });
    return true;
  } catch (e) {
    if (e?.code === 11000) return false; // another instance already took today's run
    throw e;
  }
}

async function finishRun(runKey, update) {
  try {
    await JobRun.updateOne(
      { job: JOB_NAME, runKey },
      { $set: { finishedAt: new Date(), ...update } },
    );
  } catch (e) {
    console.error("[CTO DIGEST] could not update run log:", e?.message);
  }
}

/* =========================
   Main entry point
========================= */

/**
 * @param {object}  opts
 * @param {boolean} opts.dryRun  build the emails but send nothing, take no lock;
 *                               returns the rendered emails in `previews`
 * @param {boolean} opts.force   run even if today's digest already went out
 * @param {Date}    opts.now
 */
async function runCtoPendingDigest({
  dryRun = false,
  force = false,
  now = new Date(),
  logger = console,
} = {}) {
  const stats = {
    job: JOB_NAME,
    runKey: null,
    dryRun,
    approvers: 0,
    applications: 0,
    emailsSent: 0,
    emailsFailed: 0,
    skippedNoEmail: 0,
    inAppSent: 0,
    skipped: null,
  };

  // ---- Configuration checks ----
  const baseUrl = frontendBaseUrl();
  if (!baseUrl) {
    logger.error(
      "[CTO DIGEST] FRONTEND_URL is not set, so the Review buttons would have no valid link." +
        (dryRun ? " Continuing because this is a dry run." : " Skipping."),
    );
    if (!dryRun) {
      stats.skipped = "FRONTEND_URL_MISSING";
      return stats;
    }
  }

  // Whether the job runs at all is checked by runCtoPendingDigestIfDue (the
  // on/off switch on the Scheduled Jobs page). Calling this directly, e.g.
  // "Run now" or the manual script, always sends.
  const inAppEnabled =
    typeof NotificationService?.notifyApproverOnCtoPendingDigest === "function";

  // ---- Once per day ----
  stats.runKey = force ? dayKey(now) + "#manual-" + now.getTime() : dayKey(now);

  if (!dryRun) {
    await ensureJobIndexes();
    if (!(await acquireRunLock(stats.runKey))) {
      logger.log(
        "[CTO DIGEST] already ran for " + stats.runKey + ". Skipping.",
      );
      stats.skipped = "ALREADY_RAN";
      return stats;
    }
  }

  try {
    const digests = await collectDigests({ now, baseUrl });
    const viewAllLink = baseUrl + "/app/cto-approvals";
    const asOf = formatAsOf(now);
    const previews = [];

    stats.approvers = digests.length;
    stats.applications = digests.reduce((n, d) => n + d.items.length, 0);

    await runInBatches(
      digests,
      SEND_CONCURRENCY,
      async ({ approverId, approver, items }) => {
        const tpl = ctoPendingDigestEmail({
          approverName: fullNameOf(approver) || "Approver",
          items,
          totalPending: items.length,
          viewAllLink,
          asOf,
          maxItems: MAX_ITEMS_PER_EMAIL,
        });

        if (dryRun) {
          previews.push({
            approverId,
            to: approver?.email || null,
            pending: items.length,
            subject: tpl.subject,
            html: tpl.html,
          });
          return;
        }

        // Optional in-app notification (only if you add this method to NotificationService)
        if (inAppEnabled) {
          try {
            await NotificationService.notifyApproverOnCtoPendingDigest({
              approverId,
              approver,
              pendingCount: items.length,
              applications: items,
              link: viewAllLink,
            });
            stats.inAppSent++;
          } catch (e) {
            logger.error(
              "[CTO DIGEST] in-app notification failed:",
              approverId,
              e?.message,
            );
          }
        }

        if (!approver?.email) {
          stats.skippedNoEmail++;
          logger.warn(
            "[CTO DIGEST] approver has no email on file:",
            approverId,
          );
          return;
        }

        try {
          await sendEmail(approver.email, tpl.subject, tpl.html);
          stats.emailsSent++;
        } catch (e) {
          stats.emailsFailed++;
          logger.error("[CTO DIGEST] email failed:", {
            to: approver.email,
            message: e?.message,
          });
        }
      },
    );

    if (!dryRun) {
      await finishRun(stats.runKey, { status: "DONE", stats: { ...stats } });
    } else {
      stats.previews = previews;
    }

    return stats;
  } catch (err) {
    if (!dryRun) {
      await finishRun(stats.runKey, {
        status: "FAILED",
        error: String(err?.message || err).slice(0, 1000),
        stats: { ...stats },
      });
    }
    throw err;
  }
}

/**
 * Called by the cron job every minute. Cheap when not due:
 * one small settings read, and one index lookup during the send window.
 */
async function runCtoPendingDigestIfDue({
  now = new Date(),
  logger = console,
} = {}) {
  const schedule = await getDigestSettings();
  if (!schedule.enabled) return { ran: false, reason: "PAUSED", schedule };

  const state = getScheduleState(schedule, now);
  if (!state.due) return { ran: false, reason: state.reason, schedule };

  const alreadyRan = await JobRun.exists({
    job: JOB_NAME,
    runKey: state.runKey,
  });
  if (alreadyRan) return { ran: false, reason: "ALREADY_RAN", schedule };

  const stats = await runCtoPendingDigest({ now, logger });
  return { ran: !stats.skipped, reason: stats.skipped, schedule, stats };
}

/**
 * Everything the Scheduled Jobs page needs: the settings, when it will next
 * run, and what happened last time.
 */
async function getCtoDigestStatus({ now = new Date() } = {}) {
  const schedule = await getDigestSettings();
  const today = dayKey(now);

  const [ranToday, last] = await Promise.all([
    JobRun.exists({ job: JOB_NAME, runKey: today }),
    JobRun.findOne({ job: JOB_NAME }).sort({ startedAt: -1 }).lean(),
  ]);

  const nextRunAt = schedule.enabled
    ? computeNextRun(schedule, now, !!ranToday)
    : null;

  return {
    jobKey: JOB_KEY,
    enabled: schedule.enabled,
    time: schedule.time,
    includeWeekends: schedule.includeWeekends,
    timezone: TIMEZONE,
    catchUpMinutes: CATCH_UP_MINUTES,
    nextRunAt,
    nextRunLabel: nextRunAt ? formatDateTimeLong(nextRunAt) : null,
    lastRun: last
      ? {
          runKey: last.runKey,
          manual: String(last.runKey || "").includes("#manual"),
          status: last.status,
          startedAt: last.startedAt,
          finishedAt: last.finishedAt || null,
          approvers: last.stats?.approvers ?? null,
          applications: last.stats?.applications ?? null,
          emailsSent: last.stats?.emailsSent ?? null,
          emailsFailed: last.stats?.emailsFailed ?? null,
          error: last.error || null,
        }
      : null,
  };
}

module.exports = {
  JOB_KEY,
  runCtoPendingDigest,
  runCtoPendingDigestIfDue,
  getCtoDigestStatus,
  ensureJobIndexes,
  // exported for tests
  groupPendingByApprover,
  findCurrentStep,
  getScheduleState,
  computeNextRun,
  dayKey,
  JOB_NAME,
  TIMEZONE,
};
