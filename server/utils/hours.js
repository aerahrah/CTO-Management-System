// utils/hours.js
//
// ONE standard for every CTO/COC hour value in the system:
//   4 decimal places (smallest unit 0.0001 h ≈ 0.36 seconds).
//
// Why 4:
//  - Existing balances already use 4 (e.g. 8.3566, 3.8566, 0.1434), so
//    nothing has to be rounded away.
//  - Minutes convert cleanly enough: 1 min = 0.0167 h, off by < 0.2 s.
//  - JavaScript/MongoDB numbers are binary floats, so 4 - 3.8566 comes out
//    as 0.1434000000000002. Rounding every stored or compared value to 4
//    places removes that noise.
//
// Rules:
//  1. Round anything coming in (requests, memo durations) with roundHours().
//  2. Compare hours only after rounding (sameHours / roundHours(a) <= roundHours(b)).
//  3. When a balance changes in the database, use adjustCreditHours() (memo
//     balances) or incHoursPipeline() (e.g. Employee balances.ctoHours) so
//     the result is rounded inside MongoDB, not just the amount being added.
//  4. Show hours with formatHours() -> "4", "4.5", "3.8566".
//
// The pure helpers (everything except adjustCreditHours) have no
// dependencies and can be copied to the frontend as-is.

const HOURS_DECIMALS = 4;
const HOURS_FACTOR = 10 ** HOURS_DECIMALS;
// Half of the smallest unit. Only used to tolerate float noise in values
// that were stored before this standard existed.
const HOURS_TOLERANCE = 0.5 / HOURS_FACTOR;

/** Round to HOURS_DECIMALS places, half away from zero. Non-numbers -> 0. */
function roundHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  // toPrecision(15) strips float noise first, so 1.00005 rounds up as
  // expected instead of landing on 1.0000499999999.
  const scaled = Number((Math.abs(n) * HOURS_FACTOR).toPrecision(15));
  const rounded = (Math.sign(n) * Math.round(scaled)) / HOURS_FACTOR;
  return rounded === 0 ? 0 : rounded; // never return -0
}

/** True when two hour values are equal at the standard precision. */
function sameHours(a, b) {
  return roundHours(a) === roundHours(b);
}

/** Display string: "4", "4.5", "3.8566" (no trailing zeros, no float noise). */
function formatHours(value) {
  return String(roundHours(value));
}

/**
 * Mongoose setter for hour fields. Rounds valid numbers and leaves
 * null/undefined/garbage untouched so `required` and cast errors still fire.
 */
function hoursSetter(value) {
  if (value === null || value === undefined || value === "") return value;
  const n = Number(value);
  return Number.isFinite(n) ? roundHours(n) : value;
}

/**
 * Atomically add to one employee's hour fields on a CtoCredit memo, with
 * every resulting balance rounded to HOURS_DECIMALS inside MongoDB.
 *
 *   await adjustCreditHours(CtoCredit, {
 *     memoId, employeeId,
 *     deltas: { reservedHours: 2, remainingHours: -2 },
 *     guard: { field: "remainingHours", min: 2 },   // optional: only if >= 2
 *     set: { status: "ACTIVE" },                     // optional literal values
 *     session,                                       // optional
 *   });
 *
 * Returns true when the memo matched (and the guard passed), false otherwise.
 *
 * Uses the native collection with an update pipeline (MongoDB 4.2+). That
 * behaves the same on Mongoose 8 and 9 (Mongoose 9 refuses pipeline updates
 * through Model.updateOne unless an extra option is set). Mongoose casting
 * is skipped, so ids are converted to ObjectId here.
 */
async function adjustCreditHours(CtoCredit, options) {
  const { filter, pipeline } = buildCreditHoursUpdate(options);
  const result = await CtoCredit.collection.updateOne(
    filter,
    pipeline,
    options.session ? { session: options.session } : {},
  );
  return result.matchedCount > 0;
}

/**
 * Update pipeline that adds `delta` to one numeric field and rounds the
 * result, e.g. for an employee's running balance:
 *
 *   await Employee.collection.updateOne(
 *     { _id: employeeObjectId },
 *     incHoursPipeline("balances.ctoHours", 2.5),
 *     { session },
 *   );
 *
 * Use it with Model.collection (native driver), same reason as above.
 */
function incHoursPipeline(fieldPath, delta) {
  return [
    {
      $set: {
        [fieldPath]: {
          $round: [
            { $add: [{ $ifNull: ["$" + fieldPath, 0] }, roundHours(delta)] },
            HOURS_DECIMALS,
          ],
        },
      },
    },
  ];
}

/** Builds the filter + update pipeline used by adjustCreditHours. */
function buildCreditHoursUpdate({
  memoId,
  employeeId,
  deltas = {},
  guard = null,
  set = {},
}) {
  const mongoose = require("mongoose");
  const toOid = (id) => new mongoose.Types.ObjectId(String(id?._id || id));
  const memoOid = toOid(memoId);
  const empOid = toOid(employeeId);

  const changes = {};
  for (const [field, delta] of Object.entries(deltas)) {
    changes[field] = {
      $round: [
        { $add: [{ $ifNull: ["$$e." + field, 0] }, roundHours(delta)] },
        HOURS_DECIMALS,
      ],
    };
  }
  for (const [field, value] of Object.entries(set)) {
    changes[field] = { $literal: value };
  }

  const elemMatch = { employee: empOid };
  if (guard?.field) {
    // Tolerance only matters for balances saved before this standard.
    elemMatch[guard.field] = {
      $gte: roundHours(guard.min) - HOURS_TOLERANCE,
    };
  }

  const filter = { _id: memoOid, employees: { $elemMatch: elemMatch } };
  const pipeline = [
    {
      $set: {
        employees: {
          $map: {
            input: "$employees",
            as: "e",
            in: {
              $cond: [
                { $eq: ["$$e.employee", empOid] },
                { $mergeObjects: ["$$e", changes] },
                "$$e",
              ],
            },
          },
        },
        updatedAt: "$$NOW",
      },
    },
  ];

  return { filter, pipeline };
}

module.exports = {
  HOURS_DECIMALS,
  HOURS_TOLERANCE,
  roundHours,
  sameHours,
  formatHours,
  hoursSetter,
  adjustCreditHours,
  buildCreditHoursUpdate,
  incHoursPipeline,
};
