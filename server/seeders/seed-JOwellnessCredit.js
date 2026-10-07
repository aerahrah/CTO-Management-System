require("../config/loadEnv");
const mongoose = require("mongoose");

const Employee = require("../models/employeeModel");
const WellnessCredit = require("../models/wellnessCreditModel");

// 2026 Wellness Leave (JO)
// Everyone gets 5 days. Each row lists the wellness dates from the 2026
// schedule sheet. Dates up to today count as USED; future dates are not
// taken yet, so they stay in the balance.
// Their balance becomes 5 - used.
// [email, [dates]]
const wellnessData = [
  ["diether.abad@dict.gov.ph", []], // Diether Abad
  ["alison.abbas@dict.gov.ph", []], // Alison Ahmad Abbas
  ["christiandale.aguda@dict.gov.ph", ["2026-04-15", "2026-07-17"]], // Christian Dale Aguda
  [
    "janahpatrisha.albano@dict.gov.ph",
    ["2026-04-20", "2026-06-11", "2026-08-03"],
  ], // Janah Patrisha Albano
  ["leo.alilam@dict.gov.ph", ["2026-05-14", "2026-05-18", "2026-06-25"]], // Leo Jay Alilam
  ["bieghjohn.alonzo@dict.gov.ph", []], // Biegh John Paul Alonzo
  ["enriqueluis.alvarado@dict.gov.ph", ["2026-05-20", "2026-05-21"]], // Enrique Luis Alvarado
  [
    "deejay.anapi@dict.gov.ph",
    ["2026-04-08", "2026-05-18", "2026-07-06", "2026-09-07"],
  ], // Deejay Anapi
  ["romelyn.arimbuyotan@dict.gov.ph", ["2026-05-28", "2026-06-01"]], // Romelyn Arimbuyotan
  ["debora.backiawan@dict.gov.ph", ["2026-04-20", "2026-07-07", "2026-07-20"]], // Debora Backiawan
  ["rito.banan@dict.gov.ph", ["2026-06-10", "2026-06-11", "2026-08-03"]], // Rito Banan
  [
    "mar.baquiran@dict.gov.ph",
    ["2026-05-13", "2026-05-14", "2026-06-08", "2026-09-09"],
  ], // Mar Elvison Baquiran
  [
    "juliuscezar.baquiran@dict.gov.ph",
    ["2026-04-14", "2026-05-06", "2026-07-09"],
  ], // Julius Cezar Baquiran
  [
    "christopher.capili@dict.gov.ph",
    ["2026-04-13", "2026-04-27", "2026-06-25"],
  ], // Christopher Eleeson Capili
  ["rica.casuga@dict.gov.ph", ["2026-05-25"]], // Rica Casuga
  [
    "janet.catinoy@dict.gov.ph",
    ["2026-04-23", "2026-06-08", "2026-09-22", "2026-09-23"],
  ], // Janet Catinoy
  ["cyrill.cepeda@dict.gov.ph", []], // Cyrill Shane Cepeda
  ["exen.claro@dict.gov.ph", ["2026-05-04", "2026-05-05"]], // Exen Claro
  ["jeanne.garcia@dict.gov.ph", ["2026-09-01", "2026-09-02"]], // Jeanne Shannon Garcia
  ["marcivan.guillermo@dict.gov.ph", []], // Marc Ivan Guillermo
  ["aries.guim@dict.gov.ph", ["2026-05-11", "2026-05-12", "2026-07-09"]], // Aries Anthony Guim
  ["neilkristopher.guimmayen@dict.gov.ph", []], // Neil Kristopher Guimmayen
  ["jayson.guisando@dict.gov.ph", []], // Jayson Guisando
  [
    "jeiariston.jimenez@dict.gov.ph",
    ["2026-04-21", "2026-06-25", "2026-06-30"],
  ], // Jei Ariston Jimenez
  ["roel.jimenez@dict.gov.ph", ["2026-06-15", "2026-06-16"]], // Roel Jimenez
  ["danmark.jose@dict.gov.ph", ["2026-04-15", "2026-04-16"]], // Dan Mark Jose
  ["nardo.lim@dict.gov.ph", []], // Nardo Lim
  ["jasmine.macabangun@dict.gov.ph", ["2026-07-09"]], // Jasmine Macabangun
  ["maria.macasaddu@dict.gov.ph", ["2026-06-10", "2026-06-11"]], // Maria Ea Katrina Macasaddu
  ["karlsteven.maddela@dict.gov.ph", ["2026-04-15", "2026-04-16"]], // Karl Steven Maddela
  ["maylanie.maggay@dict.gov.ph", ["2026-04-22", "2026-08-24"]], // Maylanie Maggay
  ["glenard.martin@dict.gov.ph", ["2026-05-13", "2026-05-14"]], // Glenard Martin
  ["cyzione.mendoza@dict.gov.ph", ["2026-04-15"]], // Czyione Dayl Mendoza
  ["vladimir.nuval@dict.gov.ph", ["2026-05-05", "2026-05-06", "2026-07-17"]], // Vladimir Viktor Nuval
  [
    "maricar.pecson@dict.gov.ph",
    ["2026-03-26", "2026-09-07", "2026-09-08", "2026-09-09"],
  ], // Maricar Pecson
  ["hennessi.pedro@dict.gov.ph", ["2026-07-28"]], // Hennessi Mae Pedro
  ["maelijah.pilotin@dict.gov.ph", ["2026-04-01", "2026-04-06", "2026-08-10"]], // Ma. Elijah Pilotin
  ["jenny.prudenciado@dict.gov.ph", ["2026-04-22", "2026-04-23", "2026-07-17"]], // Jenny Prudenciado
  ["kyle.rafer@dict.gov.ph", ["2026-04-30", "2026-06-15", "2026-07-16"]], // Yancee Kearvin Kyle Rafer
  ["jaymar.recolizado@dict.gov.ph", ["2026-07-23", "2026-07-24"]], // Jaymar Recolizado
  [
    "ivannpaul.santos@dict.gov.ph",
    ["2026-04-15", "2026-04-16", "2026-07-06", "2026-08-24"],
  ], // Ivan Paul Santos
  [
    "darlenejoy.seguritan@dict.gov.ph",
    ["2026-06-30", "2026-08-25", "2026-09-26"],
  ], // Darlene Joy Seguritan
  ["kyle.suyu@dict.gov.ph", ["2026-05-25", "2026-05-26"]], // Kyle Ruzzel Suyu
  ["nyssamae.telmo@dict.gov.ph", []], // Nyssa Mae Telmo
  ["bryan.tomas@dict.gov.ph", ["2026-06-04", "2026-06-08"]], // Bryan Tomas
  ["leonor.tumaliuan@dict.gov.ph", ["2026-06-16", "2026-07-20"]], // Leonor Tumaliuan
  ["joyceanne.urdillas@dict.gov.ph", ["2026-04-23", "2026-05-18"]], // Joyce Ann Urdillas
  ["mohamadnor.usman@dict.gov.ph", ["2026-06-18", "2026-07-20"]], // Mohamadnor Usman
  ["kristine.valdez@dict.gov.ph", ["2026-05-18"]], // Maria Kristine Valdez
  ["kate.villagracia@dict.gov.ph", ["2026-08-25", "2026-09-23"]], // Kate Angelie Villagracia
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

  console.log(`\n✅ Done. Credited ${entries.length} JO employee/s.`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("❌ Error:", err.message);
  await mongoose.disconnect();
  process.exit(1);
});
