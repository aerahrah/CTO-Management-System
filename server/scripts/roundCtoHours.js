// scripts/roundCtoHours.js
//
// One-time cleanup: rounds every stored CTO hour value (memo balances,
// application hours, Employee balances.ctoHours) to the system standard
// (4 decimal places, see utils/hours.js), e.g.
//   3.8566000000000003 -> 3.8566,   0.14339999999999975 -> 0.1434
//
// Usage (from the project root):
//   node scripts/roundCtoHours.js           # dry run: only counts, writes nothing
//   node scripts/roundCtoHours.js --apply   # rounds the values
//
// Back up the database before running with --apply.
// Needs MongoDB 4.4+ and MONGO_URI (or MONGODB_URI) in the environment.

try {
  require("dotenv").config();
} catch {
  // dotenv not installed: rely on real environment variables
}

const mongoose = require("mongoose");
const CtoCredit = require("../models/ctoCreditModel");
const CtoApplication = require("../models/ctoApplicationModel");
const Employee = require("../models/employeeModel");
const { HOURS_DECIMALS } = require("../utils/hours");

const APPLY = process.argv.includes("--apply");
const URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const CREDIT_FIELDS = [
  "creditedHours",
  "usedHours",
  "reservedHours",
  "remainingHours",
  "forfeitedHours",
];

// true when the value is a number with more than HOURS_DECIMALS decimals
const isMessy = (path) => ({
  $and: [
    { $isNumber: path },
    { $ne: [path, { $round: [path, HOURS_DECIMALS] }] },
  ],
});

// rounded number, or the value untouched if it isn't a number / is missing
const rounded = (path) => ({
  $cond: [{ $isNumber: path }, { $round: [path, HOURS_DECIMALS] }, path],
});

// apply `inExpr` to every element of an array field, leave non-arrays alone
const mapArray = (field, as, inExpr) => ({
  $cond: [
    { $isArray: "$" + field },
    { $map: { input: "$" + field, as, in: inExpr } },
    "$" + field,
  ],
});

const anyElement = (field, as, test) => ({
  $anyElementTrue: [
    { $map: { input: { $ifNull: ["$" + field, []] }, as, in: test } },
  ],
});

const jobs = [
  {
    name: "CtoCredit (employees.*Hours)",
    collection: () => CtoCredit.collection,
    filter: {
      $expr: anyElement("employees", "e", {
        $or: CREDIT_FIELDS.map((f) => isMessy("$$e." + f)),
      }),
    },
    update: [
      {
        $set: {
          employees: mapArray("employees", "e", {
            $mergeObjects: [
              "$$e",
              Object.fromEntries(
                CREDIT_FIELDS.map((f) => [f, rounded("$$e." + f)]),
              ),
            ],
          }),
        },
      },
    ],
  },
  {
    name: "CtoApplication (requestedHours, memo.appliedHours)",
    collection: () => CtoApplication.collection,
    filter: {
      $expr: {
        $or: [
          isMessy("$requestedHours"),
          anyElement("memo", "m", isMessy("$$m.appliedHours")),
        ],
      },
    },
    update: [
      {
        $set: {
          requestedHours: rounded("$requestedHours"),
          memo: mapArray("memo", "m", {
            $mergeObjects: [
              "$$m",
              { appliedHours: rounded("$$m.appliedHours") },
            ],
          }),
        },
      },
    ],
  },
  {
    name: "Employee (balances.ctoHours)",
    collection: () => Employee.collection,
    filter: { $expr: isMessy("$balances.ctoHours") },
    update: [{ $set: { "balances.ctoHours": rounded("$balances.ctoHours") } }],
  },
];

async function main() {
  if (!URI) {
    console.error("Set MONGO_URI (or MONGODB_URI) first.");
    process.exit(1);
  }
  await mongoose.connect(URI);
  console.log(
    APPLY
      ? "APPLY mode: values will be rounded."
      : "DRY RUN: nothing will be written.",
  );

  for (const job of jobs) {
    const col = job.collection();
    const count = await col.countDocuments(job.filter);
    console.log(
      `\n${job.name}: ${count} document(s) with more than ${HOURS_DECIMALS} decimals`,
    );

    if (count > 0) {
      const sample = await col.find(job.filter).limit(3).toArray();
      sample.forEach((doc) =>
        console.log(
          "  e.g. _id",
          String(doc._id),
          doc.memoNo ? `(memo ${doc.memoNo})` : "",
        ),
      );
    }

    if (APPLY && count > 0) {
      const res = await col.updateMany(job.filter, job.update);
      console.log(`  rounded ${res.modifiedCount} document(s)`);
    }
  }

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { jobs };
