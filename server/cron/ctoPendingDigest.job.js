// cron/ctoPendingDigest.job.js
// Runs the end-of-day pending CTO approvals digest.
//
// On/off, the run time and the weekends switch are set on the Scheduled Jobs
// page (job key "cto_pending_digest", stored by services/scheduledJobSettings.service.js).
// This job checks once a minute whether the digest is due, so a changed
// setting takes effect right away, with no restart, on every server instance.
// The once-per-day lock in the service makes sure only one email goes out.
//
// Env:
//   CTO_DIGEST_ENABLED=false           turn the job off on this instance
//   CTO_DIGEST_TIMEZONE=Asia/Manila    office timezone (default)
//   CTO_DIGEST_CATCH_UP_MINUTES=60     if the server was down at send time,
//                                      still send when it is back within this window
const cron = require("node-cron");
const {
  runCtoPendingDigestIfDue,
  ensureJobIndexes,
  TIMEZONE,
} = require("../services/ctoPendingDigest.service");

const EVERY_MINUTE = "* * * * *";

let task = null;
let running = false;

async function tick() {
  if (running) return; // previous send still in progress
  running = true;
  try {
    const result = await runCtoPendingDigestIfDue();
    if (result.ran) {
      console.log("[CRON] CTO pending digest sent:", result.stats);
    }
  } catch (e) {
    console.error("[CRON] CTO pending digest check failed:", e?.message);
  } finally {
    running = false;
  }
}

function startCtoPendingDigestJob() {
  if (
    String(process.env.CTO_DIGEST_ENABLED ?? "true").toLowerCase() === "false"
  ) {
    console.log(
      "[CRON] CTO pending digest is disabled (CTO_DIGEST_ENABLED=false).",
    );
    return null;
  }
  if (task) return task;

  ensureJobIndexes().catch((e) =>
    console.error("[CRON] could not build JobRun indexes:", e?.message),
  );

  task = cron.schedule(EVERY_MINUTE, tick, { timezone: TIMEZONE });
  console.log(
    "[CRON] CTO pending digest started (" +
      TIMEZONE +
      "); send time and weekends come from settings.",
  );
  return task;
}

function stopCtoPendingDigestJob() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { startCtoPendingDigestJob, stopCtoPendingDigestJob };
