require("../config/loadEnv");
const mongoose = require("mongoose");

const Employee = require("../models/employeeModel");
const WellnessCredit = require("../models/wellnessCreditModel");

// 2026 Wellness Leave (Organic)
// Everyone gets 5 days. Each row lists the wellness dates from the 2026
// schedule sheet. Dates up to today count as USED; future dates are not
// taken yet, so they stay in the balance.
// Their balance becomes 5 - used.
// [email, [dates]]
const wellnessData = [
  ["ferdie.abad@dict.gov.ph", ["2026-05-12", "2026-05-13", "2026-05-14"]], // Ferdinand Abad
  ["lotlot.acera@dict.gov.ph", ["2026-05-04", "2026-05-21", "2026-05-22"]], // Lot-Lot Abrigo
  ["edison.agaoid@dict.gov.ph", ["2026-05-11", "2026-05-12"]], // Edison Agaoid
  ["jayfer.ammasi@dict.gov.ph", []], // Jayfer Ammasi
  ["ricky.baligod@dict.gov.ph", ["2026-03-30", "2026-03-31", "2026-04-01"]], // Richard Baligod
  ["ronie.bariuan@dict.gov.ph", []], // Ronald Bariuan
  ["johny.batang@dict.gov.ph", ["2026-04-07", "2026-04-08"]], // Johny Batang
  ["alvin.bermejo@dict.gov.ph", []], // Alvin Bermejo
  [
    "christine.bueno@dict.gov.ph",
    ["2026-01-23", "2026-04-29", "2026-09-10", "2026-09-11"],
  ], // Christine Joyce Bueno
  ["lanie.cabacungan@dict.gov.ph", ["2026-05-25", "2026-05-26", "2026-05-28"]], // Lanie Cabacungan
  ["jose.cabacungan@dict.gov.ph", ["2026-05-25", "2026-05-26", "2026-05-28"]], // Medy Jose Cabacungan
  ["delmo.cano@dict.gov.ph", []], // Adelmo Cano
  ["samantha.dawideo@dict.gov.ph", []], // Samantha Dawideo
  ["jemar.delrosario@dict.gov.ph", ["2026-02-16", "2026-05-18"]], // Jemar Jay Del Rosario
  ["elon.domingo@dict.gov.ph", ["2026-06-15", "2026-06-16", "2026-06-17"]], // Elon Domingo
  ["joeymark.elchico@dict.gov.ph", ["2026-06-01", "2026-06-02", "2026-06-03"]], // Joey Mark Elchico
  ["pablo.fugaban@dict.gov.ph", []], // Pablo Fugaban
  ["jr.gazzingan@dict.gov.ph", ["2026-04-15", "2026-04-16"]], // Cirilo Jr. Gazzingan
  ["magie.gomez@dict.gov.ph", ["2026-07-16", "2026-10-05"]], // Magdalena Gomez
  ["roland.hubalde@dict.gov.ph", []], // Roland Hubalde
  ["pinky.jimenez@dict.gov.ph", []], // Pinky Jimenez
  ["rogelio.layugan@dict.gov.ph", ["2026-04-30"]], // Rogelio Layugan
  ["claro.maggay@dict.gov.ph", []], // Claro Maggay
  ["edmund.manuel@dict.gov.ph", ["2026-03-31", "2026-05-27"]], // Edmund Manuel
  ["edward.manuel@dict.gov.ph", ["2026-01-23", "2026-05-13", "2026-05-14"]], // Edward Manuel
  ["conie.nazarita@dict.gov.ph", ["2026-05-25", "2026-05-26"]], // Concepcion Nazarita
  ["eugene.pabro@dict.gov.ph", ["2026-05-21", "2026-05-25", "2026-05-26"]], // Eugene Pabro
  ["daniel.ramirez@dict.gov.ph", []], // Daniel Ramirez
  ["marilyn.robles@dict.gov.ph", []], // Marilyn Robles
  ["johanna.tulauan@dict.gov.ph", ["2026-10-08", "2026-10-09"]], // Johanna Tulauan
  ["markjohn.tumaliuan@dict.gov.ph", []], // Mark John Tumaliuan
  ["nodel.tumaliuan@dict.gov.ph", ["2026-06-15", "2026-06-16"]], // Nodel Tumaliuan
  ["mina.villafuerte@dict.gov.ph", ["2026-05-18"]], // Mina Flor Villafuerte
  ["gie.baculi@dict.gov.ph", []], // Virginia Baculi
];

const DAYS_PER_YEAR = 5;
const CREDIT_DATE = new Date("2026-01-01T00:00:00+08:00");
const CREDITED_BY_EMAIL = "leonor.tumaliuan@dict.gov.ph";

// Today in Philippine time, as "YYYY-MM-DD"
const TODAY = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Manila",
});

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Connected to MongoDB (${mongoose.connection.name})`);

  const creditedBy = await Employee.findOne({ email: CREDITED_BY_EMAIL });

  const entries = [];
  for (const [email, dates] of wellnessData) {
    const used = dates.filter((d) => d <= TODAY).length;
    const employee = await Employee.findOne({ email });
    if (!employee) {
      console.log(`  ⚠️  Not found, skipped: ${email}`);
      continue;
    }

    // Don't credit the same employee twice if this is run again
    const already = await WellnessCredit.exists({
      status: "CREDITED",
      dateApproved: CREDIT_DATE,
      "employees.employee": employee._id,
    });
    if (already) {
      console.log(`  ⏩ Already credited, skipped: ${email}`);
      continue;
    }

    const remaining = DAYS_PER_YEAR - used;
    entries.push({
      employee: employee._id,
      creditedDays: DAYS_PER_YEAR,
      usedDays: used,
      reservedDays: 0,
      remainingDays: remaining,
      status: remaining > 0 ? "ACTIVE" : "EXHAUSTED",
      dateCredited: CREDIT_DATE,
    });

    await Employee.updateOne(
      { _id: employee._id },
      { $set: { "balances.wellnessDays": remaining } },
    );
    const upcoming = dates.length - used;
    console.log(
      `  ➕ ${email}: ${remaining} day/s left` +
        (upcoming > 0 ? ` (${upcoming} upcoming not counted)` : ""),
    );
  }

  if (entries.length > 0) {
    await WellnessCredit.create({
      dateApproved: CREDIT_DATE,
      days: DAYS_PER_YEAR,
      employees: entries,
      status: "CREDITED",
      dateCredited: CREDIT_DATE,
      creditedBy: creditedBy?._id,
    });
  }

  console.log(`\n✅ Done. Credited ${entries.length} Organic employee/s.`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("❌ Error:", err.message);
  await mongoose.disconnect();
  process.exit(1);
});
