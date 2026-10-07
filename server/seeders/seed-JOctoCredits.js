require("../config/loadEnv");
const mongoose = require("mongoose");

const Employee = require("../models/employeeModel");
const CtoCredit = require("../models/ctoCreditModel");

// Source: "JOB ORDER - COC FILING" workbook.
// One CTO credit per memo per overtime date, shared by everyone who rendered
// overtime that day (a memo covering several dates becomes one credit per
// date). CTO already used is deducted from the date named in the "DATE/S OF
// COC TO BE USED" column, and fully used (exhausted) credits are left out.
//
// memoNo:   unique per credit; multi-date memos get the date appended
// purpose:  the memo title
// file:     memo file to upload to MEMO_BASE_PATH, named like the app does
//           (memo title letters/digits + "_" + approval date); credits from
//           the same memo share one file
// date:     the overtime date (inclusive start and end date)
// approved: the memo's approval date (the workbook has none, so the memo's
//           last overtime date is used)
// employees: [email, creditedMinutes, usedMinutes]
const ctoCreditsData = [
  {
    memoNo: "Certification-Procurement Training 2025 (8hrs)",
    purpose: "Certification-Procurement Training 2025 (8hrs)",
    file: "certificationprocurementtraining20258hrs_20250215.pdf",
    date: "2025-02-15",
    approved: "2025-02-15",
    employees: [["danmark.jose@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "CTO April 1, 2025",
    purpose: "CTO April 1, 2025",
    file: "ctoapril12025_20250401.pdf",
    date: "2025-04-01",
    approved: "2025-04-01",
    employees: [
      ["cyrill.cepeda@dict.gov.ph", 480, 0],
      ["kyle.rafer@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo: "MEMORANDUM-Rendition of Overtime Services",
    purpose: "MEMORANDUM-Rendition of Overtime Services",
    file: "memorandumrenditionofovertimeservices_20250401.pdf",
    date: "2025-04-01",
    approved: "2025-04-01",
    employees: [["nardo.lim@dict.gov.ph", 480, 240]],
  },
  {
    memoNo: "CTO-Memo-Aircon april 9, 2025 (8hrs)",
    purpose: "CTO-Memo-Aircon april 9, 2025 (8hrs)",
    file: "ctomemoairconapril920258hrs_20250409.pdf",
    date: "2025-04-09",
    approved: "2025-04-09",
    employees: [["danmark.jose@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "COC - APR 25-27, 2025 (Apr 25, 2025)",
    purpose: "COC - APR 25-27, 2025",
    file: "cocapr25272025_20250427.pdf",
    date: "2025-04-25",
    approved: "2025-04-27",
    employees: [["leah.galolo@dict.gov.ph", 510, 0]],
  },
  {
    memoNo: "COC - APR 25-27, 2025 (Apr 26, 2025)",
    purpose: "COC - APR 25-27, 2025",
    file: "cocapr25272025_20250427.pdf",
    date: "2025-04-26",
    approved: "2025-04-27",
    employees: [["leah.galolo@dict.gov.ph", 840, 0]],
  },
  {
    memoNo: "COC - APR 25-27, 2025 (Apr 27, 2025)",
    purpose: "COC - APR 25-27, 2025",
    file: "cocapr25272025_20250427.pdf",
    date: "2025-04-27",
    approved: "2025-04-27",
    employees: [["leah.galolo@dict.gov.ph", 270, 0]],
  },
  {
    memoNo: "4hrs.Memo.COC.Usman.Mohamadnor.05.01.2025",
    purpose: "4hrs.Memo.COC.Usman.Mohamadnor.05.01.2025",
    file: "4hrsmemococusmanmohamadnor05012025_20250501.pdf",
    date: "2025-05-01",
    approved: "2025-05-01",
    employees: [["mohamadnor.usman@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "MAY 1, 2025 LABOR DAY",
    purpose: "MAY 1, 2025 LABOR DAY",
    file: "may12025laborday_20250501.pdf",
    date: "2025-05-01",
    approved: "2025-05-01",
    employees: [["kyle.rafer@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "May 10 Memo.jpeg",
    purpose: "May 10 Memo.jpeg",
    file: "may10memo_20250510.jpeg",
    date: "2025-05-10",
    approved: "2025-05-10",
    employees: [["kyle.suyu@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "COC - May 24 - June 7, 2025 (May 24, 2025)",
    purpose: "COC - May 24 - June 7, 2025",
    file: "cocmay24june72025_20250607.pdf",
    date: "2025-05-24",
    approved: "2025-06-07",
    employees: [["leah.galolo@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "COC - May 24 - June 7, 2025 (May 25, 2025)",
    purpose: "COC - May 24 - June 7, 2025",
    file: "cocmay24june72025_20250607.pdf",
    date: "2025-05-25",
    approved: "2025-06-07",
    employees: [["leah.galolo@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "COC - May 24 - June 7, 2025 (May 31, 2025)",
    purpose: "COC - May 24 - June 7, 2025",
    file: "cocmay24june72025_20250607.pdf",
    date: "2025-05-31",
    approved: "2025-06-07",
    employees: [["leah.galolo@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "COC - May 24 - June 7, 2025 (Jun 1, 2025)",
    purpose: "COC - May 24 - June 7, 2025",
    file: "cocmay24june72025_20250607.pdf",
    date: "2025-06-01",
    approved: "2025-06-07",
    employees: [["leah.galolo@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "COC - May 24 - June 7, 2025 (Jun 3, 2025)",
    purpose: "COC - May 24 - June 7, 2025",
    file: "cocmay24june72025_20250607.pdf",
    date: "2025-06-03",
    approved: "2025-06-07",
    employees: [["leah.galolo@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "COC - May 24 - June 7, 2025 (Jun 4, 2025)",
    purpose: "COC - May 24 - June 7, 2025",
    file: "cocmay24june72025_20250607.pdf",
    date: "2025-06-04",
    approved: "2025-06-07",
    employees: [
      ["alison.abbas@dict.gov.ph", 240, 30],
      ["leah.galolo@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo: "COC - May 24 - June 7, 2025 (Jun 5, 2025)",
    purpose: "COC - May 24 - June 7, 2025",
    file: "cocmay24june72025_20250607.pdf",
    date: "2025-06-05",
    approved: "2025-06-07",
    employees: [
      ["alison.abbas@dict.gov.ph", 360, 0],
      ["leah.galolo@dict.gov.ph", 360, 0],
    ],
  },
  {
    memoNo: "COC - May 24 - June 7, 2025 (Jun 6, 2025)",
    purpose: "COC - May 24 - June 7, 2025",
    file: "cocmay24june72025_20250607.pdf",
    date: "2025-06-06",
    approved: "2025-06-07",
    employees: [
      ["alison.abbas@dict.gov.ph", 900, 0],
      ["leah.galolo@dict.gov.ph", 900, 0],
    ],
  },
  {
    memoNo: "Memo.COC.06.06.25",
    purpose: "Memo.COC.06.06.25",
    file: "memococ060625_20250606.pdf",
    date: "2025-06-06",
    approved: "2025-06-06",
    employees: [["darlenejoy.seguritan@dict.gov.ph", 480, 240]],
  },
  {
    memoNo: "COC - May 24 - June 7, 2025 (Jun 7, 2025)",
    purpose: "COC - May 24 - June 7, 2025",
    file: "cocmay24june72025_20250607.pdf",
    date: "2025-06-07",
    approved: "2025-06-07",
    employees: [
      ["alison.abbas@dict.gov.ph", 300, 0],
      ["leah.galolo@dict.gov.ph", 300, 0],
    ],
  },
  {
    memoNo: "Memo.COC.06.10.25 (Jun 10, 2025)",
    purpose: "Memo.COC.06.10.25",
    file: "memococ061025_20250625.pdf",
    date: "2025-06-10",
    approved: "2025-06-25",
    employees: [
      ["kyle.rafer@dict.gov.ph", 420, 0],
      ["kyle.suyu@dict.gov.ph", 600, 0],
    ],
  },
  {
    memoNo: "Memo.COC.06.10.25 (4.5hrs)",
    purpose: "Memo.COC.06.10.25 (4.5hrs)",
    file: "memococ06102545hrs_20250610.pdf",
    date: "2025-06-10",
    approved: "2025-06-10",
    employees: [["danmark.jose@dict.gov.ph", 270, 0]],
  },
  {
    memoNo: "COC.O6.12.25.8HRS",
    purpose: "COC.O6.12.25.8HRS",
    file: "coco612258hrs_20250612.pdf",
    date: "2025-06-12",
    approved: "2025-06-12",
    employees: [["vladimir.nuval@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "JUNE 12, 2025",
    purpose: "JUNE 12, 2025",
    file: "june122025_20250612.pdf",
    date: "2025-06-12",
    approved: "2025-06-12",
    employees: [["kyle.rafer@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.06.12.25",
    purpose: "Memo.COC.06.12.25",
    file: "memococ061225_20250612.pdf",
    date: "2025-06-12",
    approved: "2025-06-12",
    employees: [["darlenejoy.seguritan@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.06.10.25 (Jun 25, 2025)",
    purpose: "Memo.COC.06.10.25",
    file: "memococ061025_20250625.pdf",
    date: "2025-06-25",
    approved: "2025-06-25",
    employees: [["darlenejoy.seguritan@dict.gov.ph", 600, 0]],
  },
  {
    memoNo: "Memo.COC.07.10.25.(5hrs)",
    purpose: "Memo.COC.07.10.25.(5hrs)",
    file: "memococ0710255hrs_20250710.pdf",
    date: "2025-07-10",
    approved: "2025-07-10",
    employees: [["danmark.jose@dict.gov.ph", 300, 0]],
  },
  {
    memoNo: "Memo.COC.07.12.2025.Jose.Lim",
    purpose: "Memo.COC.07.12.2025.Jose.Lim",
    file: "memococ07122025joselim_20250712.pdf",
    date: "2025-07-12",
    approved: "2025-07-12",
    employees: [["nardo.lim@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.07.12.2025.Jose.Lim(8hrs)",
    purpose: "Memo.COC.07.12.2025.Jose.Lim(8hrs)",
    file: "memococ07122025joselim8hrs_20250712.pdf",
    date: "2025-07-12",
    approved: "2025-07-12",
    employees: [["danmark.jose@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC. 08.02.25 (Aug 2, 2025)",
    purpose: "Memo.COC. 08.02.25",
    file: "memococ080225_20250824.pdf",
    date: "2025-08-02",
    approved: "2025-08-24",
    employees: [
      ["alison.abbas@dict.gov.ph", 240, 0],
      ["leah.galolo@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo: "Memo.COC.08.2&9.2025.TechQuest Workshop (Aug 2, 2025)",
    purpose: "Memo.COC.08.2&9.2025.TechQuest Workshop",
    file: "memococ08292025techquestworkshop_20250809.pdf",
    date: "2025-08-02",
    approved: "2025-08-09",
    employees: [["darlenejoy.seguritan@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC. 08.02.25 (Aug 9, 2025)",
    purpose: "Memo.COC. 08.02.25",
    file: "memococ080225_20250824.pdf",
    date: "2025-08-09",
    approved: "2025-08-24",
    employees: [["leah.galolo@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "Memo.COC.08.2&9.2025.TechQuest Workshop (Aug 9, 2025)",
    purpose: "Memo.COC.08.2&9.2025.TechQuest Workshop",
    file: "memococ08292025techquestworkshop_20250809.pdf",
    date: "2025-08-09",
    approved: "2025-08-09",
    employees: [["darlenejoy.seguritan@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.08.09.2025.LGUFootGrandParade",
    purpose: "Memo.COC.08.09.2025.LGUFootGrandParade",
    file: "memococ08092025lgufootgrandparade_20250809.pdf",
    date: "2025-08-09",
    approved: "2025-08-09",
    employees: [["kyle.rafer@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "Memo.COC.08.09.2025.Recolizado.Suyu.MJTumaliuan",
    purpose: "Memo.COC.08.09.2025.Recolizado.Suyu.MJTumaliuan",
    file: "memococ08092025recolizadosuyumjtumaliuan_20250809.pdf",
    date: "2025-08-09",
    approved: "2025-08-09",
    employees: [["kyle.suyu@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "COC.08.14.25.6HRS",
    purpose: "COC.08.14.25.6HRS",
    file: "coc0814256hrs_20250814.pdf",
    date: "2025-08-14",
    approved: "2025-08-14",
    employees: [["cyzione.mendoza@dict.gov.ph", 360, 0]],
  },
  {
    memoNo: "Memo.COC.08.14.2025.TechQuest Preparation",
    purpose: "Memo.COC.08.14.2025.TechQuest Preparation",
    file: "memococ08142025techquestpreparation_20250814.pdf",
    date: "2025-08-14",
    approved: "2025-08-14",
    employees: [
      ["neilkristopher.guimmayen@dict.gov.ph", 360, 0],
      ["kyle.rafer@dict.gov.ph", 360, 0],
    ],
  },
  {
    memoNo: "8hrs.08.15.2025.TechQuest Finals Competition",
    purpose: "8hrs.08.15.2025.TechQuest Finals Competition",
    file: "8hrs08152025techquestfinalscompetition_20250815.pdf",
    date: "2025-08-15",
    approved: "2025-08-15",
    employees: [["rica.casuga@dict.gov.ph", 480, 150]],
  },
  {
    memoNo: "COC.08.15.25.8HRS",
    purpose: "COC.08.15.25.8HRS",
    file: "coc0815258hrs_20250815.pdf",
    date: "2025-08-15",
    approved: "2025-08-15",
    employees: [["cyzione.mendoza@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.08.15.2025.TechQuest Finals Competition",
    purpose: "Memo.COC.08.15.2025.TechQuest Finals Competition",
    file: "memococ08152025techquestfinalscompetition_20250815.pdf",
    date: "2025-08-15",
    approved: "2025-08-15",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 480, 420],
      ["neilkristopher.guimmayen@dict.gov.ph", 480, 0],
      ["kyle.rafer@dict.gov.ph", 480, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Memo.COC.08.21.2025.Jose (8hrs)",
    purpose: "Memo.COC.08.21.2025.Jose (8hrs)",
    file: "memococ08212025jose8hrs_20250821.pdf",
    date: "2025-08-21",
    approved: "2025-08-21",
    employees: [["danmark.jose@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.eGovMarketingIsabela.08.23.2025",
    purpose: "Memo.COC.eGovMarketingIsabela.08.23.2025",
    file: "memococegovmarketingisabela08232025_20250823.pdf",
    date: "2025-08-23",
    approved: "2025-08-23",
    employees: [["marcivan.guillermo@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC. 08.02.25 (Aug 24, 2025)",
    purpose: "Memo.COC. 08.02.25",
    file: "memococ080225_20250824.pdf",
    date: "2025-08-24",
    approved: "2025-08-24",
    employees: [
      ["alison.abbas@dict.gov.ph", 240, 0],
      ["leah.galolo@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo: "COC.Memos (Aug 30, 2025)",
    purpose: "COC.Memos",
    file: "cocmemos_20250918.pdf",
    date: "2025-08-30",
    approved: "2025-09-18",
    employees: [["kristine.valdez@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "8hrs.Memo.COC.Usman.Mohamadnor.08.30.2025",
    purpose: "8hrs.Memo.COC.Usman.Mohamadnor.08.30.2025",
    file: "8hrsmemococusmanmohamadnor08302025_20250830.pdf",
    date: "2025-08-30",
    approved: "2025-08-30",
    employees: [["mohamadnor.usman@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.CSU-Andrews.08.31.2025",
    purpose: "Memo.COC.CSU-Andrews.08.31.2025",
    file: "memococcsuandrews08312025_20250831.pdf",
    date: "2025-08-31",
    approved: "2025-08-31",
    employees: [["nardo.lim@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "8hrs.Memo.COC.Usman.Mohamadnor.09.05.2025",
    purpose: "8hrs.Memo.COC.Usman.Mohamadnor.09.05.2025",
    file: "8hrsmemococusmanmohamadnor09052025_20250905.pdf",
    date: "2025-09-05",
    approved: "2025-09-05",
    employees: [["mohamadnor.usman@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.09.7&14.2025",
    purpose: "Memo.COC.09.7&14.2025",
    file: "memococ097142025_20250907.pdf",
    date: "2025-09-07",
    approved: "2025-09-07",
    employees: [
      ["nardo.lim@dict.gov.ph", 480, 0],
      ["glenard.martin@dict.gov.ph", 480, 210],
      ["kyle.suyu@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Memo.COC. 09.12.25 (Sep 13, 2025)",
    purpose: "Memo.COC. 09.12.25",
    file: "memococ091225_20250923.pdf",
    date: "2025-09-13",
    approved: "2025-09-23",
    employees: [["leah.galolo@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Rendition-of-Overtime-September-13-2025",
    purpose: "Rendition-of-Overtime-September-13-2025",
    file: "renditionofovertimeseptember132025_20250913.pdf",
    date: "2025-09-13",
    approved: "2025-09-13",
    employees: [["marcivan.guillermo@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "COC.Memos (Sep 18, 2025)",
    purpose: "COC.Memos",
    file: "cocmemos_20250918.pdf",
    date: "2025-09-18",
    approved: "2025-09-18",
    employees: [["kristine.valdez@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "4hrs.09.18.2025.TechQuest",
    purpose: "4hrs.09.18.2025.TechQuest",
    file: "4hrs09182025techquest_20250918.pdf",
    date: "2025-09-18",
    approved: "2025-09-18",
    employees: [["rica.casuga@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "Memo.COC.09.18.2025",
    purpose: "Memo.COC.09.18.2025",
    file: "memococ09182025_20250918.pdf",
    date: "2025-09-18",
    approved: "2025-09-18",
    employees: [
      ["neilkristopher.guimmayen@dict.gov.ph", 240, 0],
      ["kyle.rafer@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo: "Memo.COC.09.18.2025 (4hrs)",
    purpose: "Memo.COC.09.18.2025 (4hrs)",
    file: "memococ091820254hrs_20250918.pdf",
    date: "2025-09-18",
    approved: "2025-09-18",
    employees: [["danmark.jose@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "Memo.COC. 09.12.25 (Sep 20, 2025)",
    purpose: "Memo.COC. 09.12.25",
    file: "memococ091225_20250923.pdf",
    date: "2025-09-20",
    approved: "2025-09-23",
    employees: [["leah.galolo@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.09.20&23.2025 (Sep 20, 2025)",
    purpose: "Memo.COC.09.20&23.2025",
    file: "memococ0920232025_20250923.pdf",
    date: "2025-09-20",
    approved: "2025-09-23",
    employees: [["darlenejoy.seguritan@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.09.20-22.2025 (Sep 20, 2025)",
    purpose: "Memo.COC.09.20-22.2025",
    file: "memococ0920222025_20250922.pdf",
    date: "2025-09-20",
    approved: "2025-09-22",
    employees: [["nardo.lim@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.09.20-22.2025 (Sep 21, 2025)",
    purpose: "Memo.COC.09.20-22.2025",
    file: "memococ0920222025_20250922.pdf",
    date: "2025-09-21",
    approved: "2025-09-22",
    employees: [
      ["glenard.martin@dict.gov.ph", 480, 0],
      ["kyle.rafer@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Memo.COC. 09.12.25 (Sep 22, 2025)",
    purpose: "Memo.COC. 09.12.25",
    file: "memococ091225_20250923.pdf",
    date: "2025-09-22",
    approved: "2025-09-23",
    employees: [
      ["alison.abbas@dict.gov.ph", 480, 0],
      ["leah.galolo@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Memo.COC.09.20-22.2025 (Sep 22, 2025)",
    purpose: "Memo.COC.09.20-22.2025",
    file: "memococ0920222025_20250922.pdf",
    date: "2025-09-22",
    approved: "2025-09-22",
    employees: [
      ["nardo.lim@dict.gov.ph", 360, 0],
      ["kyle.rafer@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Memo.COC.09.20-22.2025 (8hrs)",
    purpose: "Memo.COC.09.20-22.2025 (8hrs)",
    file: "memococ09202220258hrs_20250922.pdf",
    date: "2025-09-22",
    approved: "2025-09-22",
    employees: [["danmark.jose@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.Martin.09.22.2025",
    purpose: "Memo.COC.Martin.09.22.2025",
    file: "memococmartin09222025_20250922.pdf",
    date: "2025-09-22",
    approved: "2025-09-22",
    employees: [["glenard.martin@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC. 09.12.25 (Sep 23, 2025)",
    purpose: "Memo.COC. 09.12.25",
    file: "memococ091225_20250923.pdf",
    date: "2025-09-23",
    approved: "2025-09-23",
    employees: [
      ["alison.abbas@dict.gov.ph", 480, 0],
      ["leah.galolo@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Memo.COC.09.20&23.2025 (Sep 23, 2025)",
    purpose: "Memo.COC.09.20&23.2025",
    file: "memococ0920232025_20250923.pdf",
    date: "2025-09-23",
    approved: "2025-09-23",
    employees: [
      ["christopher.capili@dict.gov.ph", 360, 300],
      ["darlenejoy.seguritan@dict.gov.ph", 360, 0],
    ],
  },
  {
    memoNo: "4hrs.Memo.COC.Usman.Mohamadnor.09.27.2025",
    purpose: "4hrs.Memo.COC.Usman.Mohamadnor.09.27.2025",
    file: "4hrsmemococusmanmohamadnor09272025_20250927.pdf",
    date: "2025-09-27",
    approved: "2025-09-27",
    employees: [["mohamadnor.usman@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "Memo.COC.09.27.2025",
    purpose: "Memo.COC.09.27.2025",
    file: "memococ09272025_20250927.pdf",
    date: "2025-09-27",
    approved: "2025-09-27",
    employees: [
      ["nardo.lim@dict.gov.ph", 360, 0],
      ["kyle.rafer@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "8hrs.Memo.COC.Usman.Mohamadnor.10.04.2025",
    purpose: "8hrs.Memo.COC.Usman.Mohamadnor.10.04.2025",
    file: "8hrsmemococusmanmohamadnor10042025_20251004.pdf",
    date: "2025-10-04",
    approved: "2025-10-04",
    employees: [["mohamadnor.usman@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "COC.Guim.10.05.2025 - 8hrs",
    purpose: "COC.Guim.10.05.2025 - 8hrs",
    file: "cocguim100520258hrs_20251005.pdf",
    date: "2025-10-05",
    approved: "2025-10-05",
    employees: [["aries.guim@dict.gov.ph", 480, 240]],
  },
  {
    memoNo: "Memo.COC.PSA-ColorFunRun.10.05.2025",
    purpose: "Memo.COC.PSA-ColorFunRun.10.05.2025",
    file: "memococpsacolorfunrun10052025_20251005.pdf",
    date: "2025-10-05",
    approved: "2025-10-05",
    employees: [["kyle.suyu@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "COC.10.11.25.8HRS",
    purpose: "COC.10.11.25.8HRS",
    file: "coc1011258hrs_20251011.pdf",
    date: "2025-10-11",
    approved: "2025-10-11",
    employees: [["cyzione.mendoza@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "MEMO.COC.Oct11-18.2025-Cyber-x (Oct 11, 2025)",
    purpose: "MEMO.COC.Oct11-18.2025-Cyber-x",
    file: "memocococt11182025cyberx_20251018.pdf",
    date: "2025-10-11",
    approved: "2025-10-18",
    employees: [["exen.claro@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "Memo.COC. 10.10.25 (Oct 11, 2025)",
    purpose: "Memo.COC. 10.10.25",
    file: "memococ101025_20251012.pdf",
    date: "2025-10-11",
    approved: "2025-10-12",
    employees: [
      ["alison.abbas@dict.gov.ph", 480, 0],
      ["leah.galolo@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Memo.COC.FPIAP.10.11-12.2025 (Oct 11, 2025)",
    purpose: "Memo.COC.FPIAP.10.11-12.2025",
    file: "memococfpiap1011122025_20251012.pdf",
    date: "2025-10-11",
    approved: "2025-10-12",
    employees: [["kyle.rafer@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "October 11-12, 2025 (Oct 11, 2025)",
    purpose: "October 11-12, 2025",
    file: "october11122025_20251012.pdf",
    date: "2025-10-11",
    approved: "2025-10-12",
    employees: [["janet.catinoy@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "MEMO.COC.Oct11-18.2025-Cyber-x (Oct 12, 2025)",
    purpose: "MEMO.COC.Oct11-18.2025-Cyber-x",
    file: "memocococt11182025cyberx_20251018.pdf",
    date: "2025-10-12",
    approved: "2025-10-18",
    employees: [["exen.claro@dict.gov.ph", 780, 0]],
  },
  {
    memoNo: "Memo.COC. 10.10.25 (Oct 12, 2025)",
    purpose: "Memo.COC. 10.10.25",
    file: "memococ101025_20251012.pdf",
    date: "2025-10-12",
    approved: "2025-10-12",
    employees: [
      ["alison.abbas@dict.gov.ph", 240, 0],
      ["leah.galolo@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo: "Memo.COC.FPIAP.10.11-12.2025 (Oct 12, 2025)",
    purpose: "Memo.COC.FPIAP.10.11-12.2025",
    file: "memococfpiap1011122025_20251012.pdf",
    date: "2025-10-12",
    approved: "2025-10-12",
    employees: [["vladimir.nuval@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "October 11-12, 2025 (Oct 12, 2025)",
    purpose: "October 11-12, 2025",
    file: "october11122025_20251012.pdf",
    date: "2025-10-12",
    approved: "2025-10-12",
    employees: [["janet.catinoy@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.10.12.2025",
    purpose: "Memo.COC.10.12.2025",
    file: "memococ10122025_20251012.pdf",
    date: "2025-10-12",
    approved: "2025-10-12",
    employees: [
      ["kyle.rafer@dict.gov.ph", 480, 0],
      ["kyle.suyu@dict.gov.ph", 780, 0],
    ],
  },
  {
    memoNo: "MEMO.COC.Oct11-18.2025-Cyber-x (Oct 13, 2025)",
    purpose: "MEMO.COC.Oct11-18.2025-Cyber-x",
    file: "memocococt11182025cyberx_20251018.pdf",
    date: "2025-10-13",
    approved: "2025-10-18",
    employees: [["exen.claro@dict.gov.ph", 300, 0]],
  },
  {
    memoNo: "Memo.COC.10.11-18.2025 (Oct 13, 2025)",
    purpose: "Memo.COC.10.11-18.2025",
    file: "memococ1011182025_20251018.pdf",
    date: "2025-10-13",
    approved: "2025-10-18",
    employees: [["maelijah.pilotin@dict.gov.ph", 120, 0]],
  },
  {
    memoNo: "MEMO.COC.Oct11-18.2025-Cyber-x (Oct 15, 2025)",
    purpose: "MEMO.COC.Oct11-18.2025-Cyber-x",
    file: "memocococt11182025cyberx_20251018.pdf",
    date: "2025-10-15",
    approved: "2025-10-18",
    employees: [["exen.claro@dict.gov.ph", 360, 0]],
  },
  {
    memoNo: "Memo.COC.10.11-18.2025 (Oct 15, 2025)",
    purpose: "Memo.COC.10.11-18.2025",
    file: "memococ1011182025_20251018.pdf",
    date: "2025-10-15",
    approved: "2025-10-18",
    employees: [
      ["maelijah.pilotin@dict.gov.ph", 360, 0],
      ["kyle.rafer@dict.gov.ph", 300, 0],
    ],
  },
  {
    memoNo: "COC.Guim.10.15.2025 - 5hrs",
    purpose: "COC.Guim.10.15.2025 - 5hrs",
    file: "cocguim101520255hrs_20251015.pdf",
    date: "2025-10-15",
    approved: "2025-10-15",
    employees: [["aries.guim@dict.gov.ph", 300, 180]],
  },
  {
    memoNo: "MEMO.COC.Oct11-18.2025-Cyber-x (Oct 16, 2025)",
    purpose: "MEMO.COC.Oct11-18.2025-Cyber-x",
    file: "memocococt11182025cyberx_20251018.pdf",
    date: "2025-10-16",
    approved: "2025-10-18",
    employees: [["exen.claro@dict.gov.ph", 360, 0]],
  },
  {
    memoNo: "Memo.COC.10.11-18.2025 (Oct 16, 2025)",
    purpose: "Memo.COC.10.11-18.2025",
    file: "memococ1011182025_20251018.pdf",
    date: "2025-10-16",
    approved: "2025-10-18",
    employees: [
      ["maelijah.pilotin@dict.gov.ph", 360, 0],
      ["kyle.rafer@dict.gov.ph", 300, 0],
    ],
  },
  {
    memoNo: "COC.Guim.10.16.2025 - 5hrs",
    purpose: "COC.Guim.10.16.2025 - 5hrs",
    file: "cocguim101620255hrs_20251016.pdf",
    date: "2025-10-16",
    approved: "2025-10-16",
    employees: [["aries.guim@dict.gov.ph", 300, 0]],
  },
  {
    memoNo: "MEMO.COC.Oct11-18.2025-Cyber-x (Oct 17, 2025)",
    purpose: "MEMO.COC.Oct11-18.2025-Cyber-x",
    file: "memocococt11182025cyberx_20251018.pdf",
    date: "2025-10-17",
    approved: "2025-10-18",
    employees: [["exen.claro@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "Memo.COC.10.11-18.2025 (Oct 17, 2025)",
    purpose: "Memo.COC.10.11-18.2025",
    file: "memococ1011182025_20251018.pdf",
    date: "2025-10-17",
    approved: "2025-10-18",
    employees: [["kyle.rafer@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "COC.Guim.10.17.2025 - 4hrs",
    purpose: "COC.Guim.10.17.2025 - 4hrs",
    file: "cocguim101720254hrs_20251017.pdf",
    date: "2025-10-17",
    approved: "2025-10-17",
    employees: [["aries.guim@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "MEMO.COC.Oct11-18.2025-Cyber-x (Oct 18, 2025)",
    purpose: "MEMO.COC.Oct11-18.2025-Cyber-x",
    file: "memocococt11182025cyberx_20251018.pdf",
    date: "2025-10-18",
    approved: "2025-10-18",
    employees: [["exen.claro@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.10.11-18.2025 (Oct 18, 2025)",
    purpose: "Memo.COC.10.11-18.2025",
    file: "memococ1011182025_20251018.pdf",
    date: "2025-10-18",
    approved: "2025-10-18",
    employees: [["maelijah.pilotin@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.GECS.10.19.2025",
    purpose: "Memo.COC.GECS.10.19.2025",
    file: "memococgecs10192025_20251019.pdf",
    date: "2025-10-19",
    approved: "2025-10-19",
    employees: [["glenard.martin@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.GECS.10.19.2025(8hrs)",
    purpose: "Memo.COC.GECS.10.19.2025(8hrs)",
    file: "memococgecs101920258hrs_20251019.pdf",
    date: "2025-10-19",
    approved: "2025-10-19",
    employees: [["danmark.jose@dict.gov.ph", 480, 0]],
  },
  {
    memoNo:
      "Rendition of Overtime - Regional Pitching Competition-PSC X-Prep_November 05-06, 2025 (Nov 5, 2025)",
    purpose:
      "Rendition of Overtime - Regional Pitching Competition-PSC X-Prep_November 05-06, 2025",
    file: "renditionofovertimeregionalpitchingcompetitionpscxprepnovember05062025_20251106.pdf",
    date: "2025-11-05",
    approved: "2025-11-06",
    employees: [["christopher.capili@dict.gov.ph", 240, 0]],
  },
  {
    memoNo:
      "Rendition of Overtime-Regional Pitching Competition-PSC-Prep_November 05-06,2025 (Nov 5, 2025)",
    purpose:
      "Rendition of Overtime-Regional Pitching Competition-PSC-Prep_November 05-06,2025",
    file: "renditionofovertimeregionalpitchingcompetitionpscprepnovember05062025_20251106.pdf",
    date: "2025-11-05",
    approved: "2025-11-06",
    employees: [["darlenejoy.seguritan@dict.gov.ph", 240, 0]],
  },
  {
    memoNo:
      "Rendition of Overtime - Regional Pitching Competition-PSC X-Prep_November 05-06, 2025 (Nov 6, 2025)",
    purpose:
      "Rendition of Overtime - Regional Pitching Competition-PSC X-Prep_November 05-06, 2025",
    file: "renditionofovertimeregionalpitchingcompetitionpscxprepnovember05062025_20251106.pdf",
    date: "2025-11-06",
    approved: "2025-11-06",
    employees: [["christopher.capili@dict.gov.ph", 300, 0]],
  },
  {
    memoNo:
      "Rendition of Overtime-Regional Pitching Competition-PSC-Prep_November 05-06,2025 (Nov 6, 2025)",
    purpose:
      "Rendition of Overtime-Regional Pitching Competition-PSC-Prep_November 05-06,2025",
    file: "renditionofovertimeregionalpitchingcompetitionpscprepnovember05062025_20251106.pdf",
    date: "2025-11-06",
    approved: "2025-11-06",
    employees: [["darlenejoy.seguritan@dict.gov.ph", 300, 0]],
  },
  {
    memoNo: "COC.PILOTIN.11.11-12.25",
    purpose: "COC.PILOTIN.11.11-12.25",
    file: "cocpilotin11111225_20251112.pdf",
    date: "2025-11-12",
    approved: "2025-11-12",
    employees: [["maelijah.pilotin@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.AFD.11.12-16.2025 (Nov 13, 2025)",
    purpose: "Memo.COC.AFD.11.12-16.2025",
    file: "memococafd1112162025_20251115.pdf",
    date: "2025-11-13",
    approved: "2025-11-15",
    employees: [["leonor.tumaliuan@dict.gov.ph", 279, 73]],
  },
  {
    memoNo: "Memo.COC.AFD.11.12-16.2025 (Nov 15, 2025)",
    purpose: "Memo.COC.AFD.11.12-16.2025",
    file: "memococafd1112162025_20251115.pdf",
    date: "2025-11-15",
    approved: "2025-11-15",
    employees: [["leonor.tumaliuan@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.AFD.11.17-20.2025 (Nov 17, 2025)",
    purpose: "Memo.COC.AFD.11.17-20.2025",
    file: "memococafd1117202025_20251120.pdf",
    date: "2025-11-17",
    approved: "2025-11-20",
    employees: [["leonor.tumaliuan@dict.gov.ph", 206, 0]],
  },
  {
    memoNo: "COC.11.18-20.2025.15HRS (Nov 18, 2025)",
    purpose: "COC.11.18-20.2025.15HRS",
    file: "coc111820202515hrs_20251120.pdf",
    date: "2025-11-18",
    approved: "2025-11-20",
    employees: [["jaymar.recolizado@dict.gov.ph", 360, 300]],
  },
  {
    memoNo: "COC.11.18-20.2025.15HRS (Nov 19, 2025)",
    purpose: "COC.11.18-20.2025.15HRS",
    file: "coc111820202515hrs_20251120.pdf",
    date: "2025-11-19",
    approved: "2025-11-20",
    employees: [["jaymar.recolizado@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "COC.11.18-20.2025.15HRS (Nov 20, 2025)",
    purpose: "COC.11.18-20.2025.15HRS",
    file: "coc111820202515hrs_20251120.pdf",
    date: "2025-11-20",
    approved: "2025-11-20",
    employees: [["jaymar.recolizado@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "4hrs.ROTyphoon.11.26.2025",
    purpose: "4hrs.ROTyphoon.11.26.2025",
    file: "4hrsrotyphoon11262025_20251126.pdf",
    date: "2025-11-26",
    approved: "2025-11-26",
    employees: [["rica.casuga@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "COC.11.26.2025.3HRS",
    purpose: "COC.11.26.2025.3HRS",
    file: "coc112620253hrs_20251126.pdf",
    date: "2025-11-26",
    approved: "2025-11-26",
    employees: [
      ["maricar.pecson@dict.gov.ph", 180, 60],
      ["jaymar.recolizado@dict.gov.ph", 180, 0],
    ],
  },
  {
    memoNo: "COC.11.26.25.3HRS",
    purpose: "COC.11.26.25.3HRS",
    file: "coc1126253hrs_20251126.pdf",
    date: "2025-11-26",
    approved: "2025-11-26",
    employees: [["cyzione.mendoza@dict.gov.ph", 180, 0]],
  },
  {
    memoNo: "Memo.COC.RO.11.26.2025",
    purpose: "Memo.COC.RO.11.26.2025",
    file: "memococro11262025_20251126.pdf",
    date: "2025-11-26",
    approved: "2025-11-26",
    employees: [
      ["vladimir.nuval@dict.gov.ph", 180, 0],
      ["kyle.rafer@dict.gov.ph", 240, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 60, 0],
      ["leonor.tumaliuan@dict.gov.ph", 180, 0],
    ],
  },
  {
    memoNo: "Memo.COC.RO.11.26.2025 (3hrs)",
    purpose: "Memo.COC.RO.11.26.2025 (3hrs)",
    file: "memococro112620253hrs_20251126.pdf",
    date: "2025-11-26",
    approved: "2025-11-26",
    employees: [["danmark.jose@dict.gov.ph", 180, 0]],
  },
  {
    memoNo: "Memo.COC.Recolizado.11.30.2025.8HRS",
    purpose: "Memo.COC.Recolizado.11.30.2025.8HRS",
    file: "memococrecolizado113020258hrs_20251130.pdf",
    date: "2025-11-30",
    approved: "2025-11-30",
    employees: [["jaymar.recolizado@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.12.08.2025 (Dec 8, 2025)",
    purpose: "Memo.COC.12.08.2025",
    file: "memococ12082025_20251218.pdf",
    date: "2025-12-08",
    approved: "2025-12-18",
    employees: [
      ["christopher.capili@dict.gov.ph", 480, 0],
      ["leonor.tumaliuan@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo: "CTO application.Maggay Maylanie",
    purpose: "CTO application.Maggay Maylanie",
    file: "ctoapplicationmaggaymaylanie_20251217.pdf",
    date: "2025-12-17",
    approved: "2025-12-17",
    employees: [["maylanie.maggay@dict.gov.ph", 180, 0]],
  },
  {
    memoNo: "Memo.COC.12.08.2025 (Dec 18, 2025)",
    purpose: "Memo.COC.12.08.2025",
    file: "memococ12082025_20251218.pdf",
    date: "2025-12-18",
    approved: "2025-12-18",
    employees: [["darlenejoy.seguritan@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "8hrs.GIS.MAP-IT.12.18.2025",
    purpose: "8hrs.GIS.MAP-IT.12.18.2025",
    file: "8hrsgismapit12182025_20251218.pdf",
    date: "2025-12-18",
    approved: "2025-12-18",
    employees: [["rica.casuga@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "COC.12.18.25.4HRS",
    purpose: "COC.12.18.25.4HRS",
    file: "coc1218254hrs_20251218.pdf",
    date: "2025-12-18",
    approved: "2025-12-18",
    employees: [["cyzione.mendoza@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "December 18, 2025",
    purpose: "December 18, 2025",
    file: "december182025_20251218.pdf",
    date: "2025-12-18",
    approved: "2025-12-18",
    employees: [["janet.catinoy@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "Memo.COC.AFD.12.18.2025",
    purpose: "Memo.COC.AFD.12.18.2025",
    file: "memococafd12182025_20251218.pdf",
    date: "2025-12-18",
    approved: "2025-12-18",
    employees: [["leonor.tumaliuan@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "Memo.COC.Catinoy.Rafer.Mendoza.12.18.2025",
    purpose: "Memo.COC.Catinoy.Rafer.Mendoza.12.18.2025",
    file: "memococcatinoyrafermendoza12182025_20251218.pdf",
    date: "2025-12-18",
    approved: "2025-12-18",
    employees: [["kyle.rafer@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "Memo.COC.GIS.MAP-IT.12.18.2025",
    purpose: "Memo.COC.GIS.MAP-IT.12.18.2025",
    file: "memococgismapit12182025_20251218.pdf",
    date: "2025-12-18",
    approved: "2025-12-18",
    employees: [
      ["aries.guim@dict.gov.ph", 480, 0],
      ["jeiariston.jimenez@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Memo.COC.GIS.MAP-IT.12.18.2025.8HRS",
    purpose: "Memo.COC.GIS.MAP-IT.12.18.2025.8HRS",
    file: "memococgismapit121820258hrs_20251218.pdf",
    date: "2025-12-18",
    approved: "2025-12-18",
    employees: [["jaymar.recolizado@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "2025-12-20 YEPA - Memo",
    purpose: "2025-12-20 YEPA - Memo",
    file: "20251220yepamemo_20251220.pdf",
    date: "2025-12-20",
    approved: "2025-12-20",
    employees: [["enriqueluis.alvarado@dict.gov.ph", 360, 120]],
  },
  {
    memoNo: "COC.12.20.2025.6HRS",
    purpose: "COC.12.20.2025.6HRS",
    file: "coc122020256hrs_20251220.pdf",
    date: "2025-12-20",
    approved: "2025-12-20",
    employees: [
      ["maricar.pecson@dict.gov.ph", 360, 0],
      ["jaymar.recolizado@dict.gov.ph", 360, 0],
    ],
  },
  {
    memoNo: "COC.12.20.25.6HRS",
    purpose: "COC.12.20.25.6HRS",
    file: "coc1220256hrs_20251220.pdf",
    date: "2025-12-20",
    approved: "2025-12-20",
    employees: [["cyzione.mendoza@dict.gov.ph", 360, 0]],
  },
  {
    memoNo: "December 20, 2025",
    purpose: "December 20, 2025",
    file: "december202025_20251220.pdf",
    date: "2025-12-20",
    approved: "2025-12-20",
    employees: [["janet.catinoy@dict.gov.ph", 360, 0]],
  },
  {
    memoNo: "Memo.COC.2025YEPA.12.20.2025",
    purpose: "Memo.COC.2025YEPA.12.20.2025",
    file: "memococ2025yepa12202025_20251220.pdf",
    date: "2025-12-20",
    approved: "2025-12-20",
    employees: [
      ["janahpatrisha.albano@dict.gov.ph", 360, 180],
      ["christopher.capili@dict.gov.ph", 360, 0],
      ["exen.claro@dict.gov.ph", 480, 0],
      ["marcivan.guillermo@dict.gov.ph", 480, 0],
      ["aries.guim@dict.gov.ph", 360, 0],
      ["jeiariston.jimenez@dict.gov.ph", 360, 0],
      ["danmark.jose@dict.gov.ph", 360, 0],
      ["jasmine.macabangun@dict.gov.ph", 360, 0],
      ["glenard.martin@dict.gov.ph", 360, 0],
      ["kyle.rafer@dict.gov.ph", 360, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 360, 0],
      ["bryan.tomas@dict.gov.ph", 480, 0],
      ["leonor.tumaliuan@dict.gov.ph", 360, 0],
      ["joyceanne.urdillas@dict.gov.ph", 360, 120],
      ["kristine.valdez@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "COC.01.02-03.26.16HRS (Jan 2, 2026)",
    purpose: "COC.01.02-03.26.16HRS",
    file: "coc0102032616hrs_20260103.pdf",
    date: "2026-01-02",
    approved: "2026-01-03",
    employees: [["cyzione.mendoza@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "January 2-3, 2026 (Jan 2, 2026)",
    purpose: "January 2-3, 2026",
    file: "january232026_20260103.pdf",
    date: "2026-01-02",
    approved: "2026-01-03",
    employees: [["janet.catinoy@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.Catinoy.Rafer.Mendoza.01.2-3.2026 (Jan 2, 2026)",
    purpose: "Memo.COC.Catinoy.Rafer.Mendoza.01.2-3.2026",
    file: "memococcatinoyrafermendoza01232026_20260103.pdf",
    date: "2026-01-02",
    approved: "2026-01-03",
    employees: [["kyle.rafer@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "COC.01.02-03.26.16HRS (Jan 3, 2026)",
    purpose: "COC.01.02-03.26.16HRS",
    file: "coc0102032616hrs_20260103.pdf",
    date: "2026-01-03",
    approved: "2026-01-03",
    employees: [["cyzione.mendoza@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "January 2-3, 2026 (Jan 3, 2026)",
    purpose: "January 2-3, 2026",
    file: "january232026_20260103.pdf",
    date: "2026-01-03",
    approved: "2026-01-03",
    employees: [["janet.catinoy@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.Catinoy.Rafer.Mendoza.01.2-3.2026 (Jan 3, 2026)",
    purpose: "Memo.COC.Catinoy.Rafer.Mendoza.01.2-3.2026",
    file: "memococcatinoyrafermendoza01232026_20260103.pdf",
    date: "2026-01-03",
    approved: "2026-01-03",
    employees: [["kyle.rafer@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Memo.COC.FPIAP.01.10.2026",
    purpose: "Memo.COC.FPIAP.01.10.2026",
    file: "memococfpiap01102026_20260110.pdf",
    date: "2026-01-10",
    approved: "2026-01-10",
    employees: [
      ["janet.catinoy@dict.gov.ph", 120, 0],
      ["cyrill.cepeda@dict.gov.ph", 120, 0],
      ["neilkristopher.guimmayen@dict.gov.ph", 120, 0],
      ["cyzione.mendoza@dict.gov.ph", 120, 0],
    ],
  },
  {
    memoNo: "Certification.PhilGEPS.02.17.2026",
    purpose: "Certification.PhilGEPS.02.17.2026",
    file: "certificationphilgeps02172026_20260217.pdf",
    date: "2026-02-17",
    approved: "2026-02-17",
    employees: [
      ["aries.guim@dict.gov.ph", 360, 0],
      ["jeiariston.jimenez@dict.gov.ph", 360, 0],
    ],
  },
  {
    memoNo: "Certification.PhilGEPS.02.17.2026.6HRS",
    purpose: "Certification.PhilGEPS.02.17.2026.6HRS",
    file: "certificationphilgeps021720266hrs_20260217.pdf",
    date: "2026-02-17",
    approved: "2026-02-17",
    employees: [
      ["cyrill.cepeda@dict.gov.ph", 360, 0],
      ["vladimir.nuval@dict.gov.ph", 360, 0],
      ["jaymar.recolizado@dict.gov.ph", 360, 0],
    ],
  },
  {
    memoNo: "24hrs.03.20-21.2026.ProcTraining (Mar 20, 2026)",
    purpose: "24hrs.03.20-21.2026.ProcTraining",
    file: "24hrs0320212026proctraining_20260321.pdf",
    date: "2026-03-20",
    approved: "2026-03-21",
    employees: [["rica.casuga@dict.gov.ph", 720, 0]],
  },
  {
    memoNo: "COC.03.20-21.2026.12hrs (Mar 20, 2026)",
    purpose: "COC.03.20-21.2026.12hrs",
    file: "coc032021202612hrs_20260321.pdf",
    date: "2026-03-20",
    approved: "2026-03-21",
    employees: [["cyzione.mendoza@dict.gov.ph", 360, 0]],
  },
  {
    memoNo:
      "Certification.2026ProcurementTraining.03.20-21.2026.12hrs (Mar 20, 2026)",
    purpose: "Certification.2026ProcurementTraining.03.20-21.2026.12hrs",
    file: "certification2026procurementtraining032021202612hrs_20260321.pdf",
    date: "2026-03-20",
    approved: "2026-03-21",
    employees: [
      ["juliuscezar.baquiran@dict.gov.ph", 720, 215],
      ["kyle.suyu@dict.gov.ph", 360, 0],
      ["joyceanne.urdillas@dict.gov.ph", 360, 0],
    ],
  },
  {
    memoNo:
      "Certification.2026ProcurementTraining.03.20-21.2026.24hrs (Mar 20, 2026)",
    purpose: "Certification.2026ProcurementTraining.03.20-21.2026.24hrs",
    file: "certification2026procurementtraining032021202624hrs_20260321.pdf",
    date: "2026-03-20",
    approved: "2026-03-21",
    employees: [
      ["cyrill.cepeda@dict.gov.ph", 720, 0],
      ["neilkristopher.guimmayen@dict.gov.ph", 720, 0],
      ["jeiariston.jimenez@dict.gov.ph", 720, 0],
      ["vladimir.nuval@dict.gov.ph", 720, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 720, 0],
    ],
  },
  {
    memoNo:
      "Certification.ProcurementTraining.03.20-21.2026.24hrs (Mar 20, 2026)",
    purpose: "Certification.ProcurementTraining.03.20-21.2026.24hrs",
    file: "certificationprocurementtraining032021202624hrs_20260321.pdf",
    date: "2026-03-20",
    approved: "2026-03-21",
    employees: [["danmark.jose@dict.gov.ph", 720, 0]],
  },
  {
    memoNo: "MARCH 2026 (Mar 20, 2026)",
    purpose: "MARCH 2026",
    file: "march2026_20260321.pdf",
    date: "2026-03-20",
    approved: "2026-03-21",
    employees: [["maricar.pecson@dict.gov.ph", 720, 0]],
  },
  {
    memoNo: "24hrs.03.20-21.2026.ProcTraining (Mar 21, 2026)",
    purpose: "24hrs.03.20-21.2026.ProcTraining",
    file: "24hrs0320212026proctraining_20260321.pdf",
    date: "2026-03-21",
    approved: "2026-03-21",
    employees: [["rica.casuga@dict.gov.ph", 720, 0]],
  },
  {
    memoNo: "COC.03.20-21.2026.12hrs (Mar 21, 2026)",
    purpose: "COC.03.20-21.2026.12hrs",
    file: "coc032021202612hrs_20260321.pdf",
    date: "2026-03-21",
    approved: "2026-03-21",
    employees: [["cyzione.mendoza@dict.gov.ph", 360, 0]],
  },
  {
    memoNo:
      "Certification.2026ProcurementTraining.03.20-21.2026.12hrs (Mar 21, 2026)",
    purpose: "Certification.2026ProcurementTraining.03.20-21.2026.12hrs",
    file: "certification2026procurementtraining032021202612hrs_20260321.pdf",
    date: "2026-03-21",
    approved: "2026-03-21",
    employees: [
      ["kyle.suyu@dict.gov.ph", 360, 0],
      ["joyceanne.urdillas@dict.gov.ph", 360, 0],
    ],
  },
  {
    memoNo:
      "Certification.2026ProcurementTraining.03.20-21.2026.24hrs (Mar 21, 2026)",
    purpose: "Certification.2026ProcurementTraining.03.20-21.2026.24hrs",
    file: "certification2026procurementtraining032021202624hrs_20260321.pdf",
    date: "2026-03-21",
    approved: "2026-03-21",
    employees: [
      ["cyrill.cepeda@dict.gov.ph", 720, 0],
      ["neilkristopher.guimmayen@dict.gov.ph", 720, 0],
      ["jeiariston.jimenez@dict.gov.ph", 720, 0],
      ["roel.jimenez@dict.gov.ph", 720, 480],
      ["vladimir.nuval@dict.gov.ph", 720, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 720, 0],
    ],
  },
  {
    memoNo:
      "Certification.ProcurementTraining.03.20-21.2026.24hrs (Mar 21, 2026)",
    purpose: "Certification.ProcurementTraining.03.20-21.2026.24hrs",
    file: "certificationprocurementtraining032021202624hrs_20260321.pdf",
    date: "2026-03-21",
    approved: "2026-03-21",
    employees: [["danmark.jose@dict.gov.ph", 720, 0]],
  },
  {
    memoNo: "MARCH 2026 (Mar 21, 2026)",
    purpose: "MARCH 2026",
    file: "march2026_20260321.pdf",
    date: "2026-03-21",
    approved: "2026-03-21",
    employees: [["maricar.pecson@dict.gov.ph", 720, 0]],
  },
  {
    memoNo: "Memorandum for Rendition of Overtime .3.7.2026",
    purpose: "Memorandum for Rendition of Overtime .3.7.2026",
    file: "memorandumforrenditionofovertime372026_20260327.pdf",
    date: "2026-03-27",
    approved: "2026-03-27",
    employees: [["debora.backiawan@dict.gov.ph", 240, 0]],
  },
  {
    memoNo: "COC.05.01.2026.8HRS",
    purpose: "COC.05.01.2026.8HRS",
    file: "coc050120268hrs_20260501.pdf",
    date: "2026-05-01",
    approved: "2026-05-01",
    employees: [["maricar.pecson@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification.DigiGov.05.01.2026",
    purpose: "Certification.DigiGov.05.01.2026",
    file: "certificationdigigov05012026_20260501.pdf",
    date: "2026-05-01",
    approved: "2026-05-01",
    employees: [
      ["diether.abad@dict.gov.ph", 480, 0],
      ["marcivan.guillermo@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Certification.DigiGov.IIDB.Cyber.05.01.2026",
    purpose: "Certification.DigiGov.IIDB.Cyber.05.01.2026",
    file: "certificationdigigoviidbcyber05012026_20260501.pdf",
    date: "2026-05-01",
    approved: "2026-05-01",
    employees: [
      ["darlenejoy.seguritan@dict.gov.ph", 480, 0],
      ["kyle.suyu@dict.gov.ph", 480, 0],
      ["joyceanne.urdillas@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Memo.RenditionofOvertimeServices.04.28.26",
    purpose: "Memo.RenditionofOvertimeServices.04.28.26",
    file: "memorenditionofovertimeservices042826_20260501.pdf",
    date: "2026-05-01",
    approved: "2026-05-01",
    employees: [["nardo.lim@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification of COC8hrs_ILCDB",
    purpose: "Certification of COC8hrs_ILCDB",
    file: "certificationofcoc8hrsilcdb_20260508.pdf",
    date: "2026-05-08",
    approved: "2026-05-08",
    employees: [
      ["christopher.capili@dict.gov.ph", 480, 0],
      ["jasmine.macabangun@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo:
      "Certification of COC8hrs_DSWD Distribution.05-29-2026 (May 9, 2026)",
    purpose: "Certification of COC8hrs_DSWD Distribution.05-29-2026",
    file: "certificationofcoc8hrsdswddistribution05292026_20260529.pdf",
    date: "2026-05-09",
    approved: "2026-05-29",
    employees: [["kristine.valdez@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification of COC8hrs_NICT (May 27, 2026)",
    purpose: "Certification of COC8hrs_NICT",
    file: "certificationofcoc8hrsnict_20260531.pdf",
    date: "2026-05-27",
    approved: "2026-05-31",
    employees: [
      ["danmark.jose@dict.gov.ph", 480, 0],
      ["nardo.lim@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo:
      "Certification of COC8hrs_DSWD Distribution.05-29-2026 (May 29, 2026)",
    purpose: "Certification of COC8hrs_DSWD Distribution.05-29-2026",
    file: "certificationofcoc8hrsdswddistribution05292026_20260529.pdf",
    date: "2026-05-29",
    approved: "2026-05-29",
    employees: [
      ["marcivan.guillermo@dict.gov.ph", 480, 0],
      ["bryan.tomas@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Certification of COC8hrs_NICT (May 29, 2026)",
    purpose: "Certification of COC8hrs_NICT",
    file: "certificationofcoc8hrsnict_20260531.pdf",
    date: "2026-05-29",
    approved: "2026-05-31",
    employees: [
      ["leo.alilam@dict.gov.ph", 480, 0],
      ["danmark.jose@dict.gov.ph", 480, 0],
      ["nardo.lim@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "2026-05-29 DSWD Distribution - Cert",
    purpose: "2026-05-29 DSWD Distribution - Cert",
    file: "20260529dswddistributioncert_20260529.pdf",
    date: "2026-05-29",
    approved: "2026-05-29",
    employees: [["enriqueluis.alvarado@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification of COC8hrs_FPIAP.05-29-2026",
    purpose: "Certification of COC8hrs_FPIAP.05-29-2026",
    file: "certificationofcoc8hrsfpiap05292026_20260529.pdf",
    date: "2026-05-29",
    approved: "2026-05-29",
    employees: [
      ["neilkristopher.guimmayen@dict.gov.ph", 480, 0],
      ["vladimir.nuval@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Certification of COC8hrs_NICT (May 30, 2026)",
    purpose: "Certification of COC8hrs_NICT",
    file: "certificationofcoc8hrsnict_20260531.pdf",
    date: "2026-05-30",
    approved: "2026-05-31",
    employees: [
      ["danmark.jose@dict.gov.ph", 480, 0],
      ["nardo.lim@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Certification of COC8hrs_NICT (May 31, 2026)",
    purpose: "Certification of COC8hrs_NICT",
    file: "certificationofcoc8hrsnict_20260531.pdf",
    date: "2026-05-31",
    approved: "2026-05-31",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 480, 0],
      ["leo.alilam@dict.gov.ph", 480, 0],
      ["bieghjohn.alonzo@dict.gov.ph", 480, 0],
      ["christopher.capili@dict.gov.ph", 480, 0],
      ["aries.guim@dict.gov.ph", 480, 0],
      ["danmark.jose@dict.gov.ph", 480, 0],
      ["jasmine.macabangun@dict.gov.ph", 480, 0],
      ["maylanie.maggay@dict.gov.ph", 480, 0],
      ["kyle.rafer@dict.gov.ph", 480, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "COC.06.12.2026.8HRS",
    purpose: "COC.06.12.2026.8HRS",
    file: "coc061220268hrs_20260612.pdf",
    date: "2026-06-12",
    approved: "2026-06-12",
    employees: [["maricar.pecson@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification.DOLE.JobFair.06-12-2026",
    purpose: "Certification.DOLE.JobFair.06-12-2026",
    file: "certificationdolejobfair06122026_20260612.pdf",
    date: "2026-06-12",
    approved: "2026-06-12",
    employees: [
      ["leo.alilam@dict.gov.ph", 480, 0],
      ["christopher.capili@dict.gov.ph", 480, 0],
      ["jasmine.macabangun@dict.gov.ph", 480, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Certification.Backiawan.ILCDB.06-19-2026",
    purpose: "Certification.Backiawan.ILCDB.06-19-2026",
    file: "certificationbackiawanilcdb06192026_20260619.pdf",
    date: "2026-06-19",
    approved: "2026-06-19",
    employees: [["debora.backiawan@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "COC.06.26.2026.8hrs",
    purpose: "COC.06.26.2026.8hrs",
    file: "coc062620268hrs_20260626.pdf",
    date: "2026-06-26",
    approved: "2026-06-26",
    employees: [["cyzione.mendoza@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification of OT8hrs_CPO.06-26-2026",
    purpose: "Certification of OT8hrs_CPO.06-26-2026",
    file: "certificationofot8hrscpo06262026_20260626.pdf",
    date: "2026-06-26",
    approved: "2026-06-26",
    employees: [
      ["christopher.capili@dict.gov.ph", 480, 0],
      ["jasmine.macabangun@dict.gov.ph", 480, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Certification of OT8hrs_FPIAP.06-26-2026",
    purpose: "Certification of OT8hrs_FPIAP.06-26-2026",
    file: "certificationofot8hrsfpiap06262026_20260626.pdf",
    date: "2026-06-26",
    approved: "2026-06-26",
    employees: [["janet.catinoy@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification of OT8hrs_GovNet.06-26-2026",
    purpose: "Certification of OT8hrs_GovNet.06-26-2026",
    file: "certificationofot8hrsgovnet06262026_20260626.pdf",
    date: "2026-06-26",
    approved: "2026-06-26",
    employees: [["danmark.jose@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification.IsabelaPO.16hrs.06-26&27-2026 (Jun 26, 2026)",
    purpose: "Certification.IsabelaPO.16hrs.06-26&27-2026",
    file: "certificationisabelapo16hrs0626272026_20260627.pdf",
    date: "2026-06-26",
    approved: "2026-06-27",
    employees: [["bieghjohn.alonzo@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification.IsabelaPO.16hrs.06-26&27-2026 (Jun 27, 2026)",
    purpose: "Certification.IsabelaPO.16hrs.06-26&27-2026",
    file: "certificationisabelapo16hrs0626272026_20260627.pdf",
    date: "2026-06-27",
    approved: "2026-06-27",
    employees: [["bieghjohn.alonzo@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification of OT8hrs_GECS.06-29-2026",
    purpose: "Certification of OT8hrs_GECS.06-29-2026",
    file: "certificationofot8hrsgecs06292026_20260629.pdf",
    date: "2026-06-29",
    approved: "2026-06-29",
    employees: [
      ["nardo.lim@dict.gov.ph", 480, 0],
      ["glenard.martin@dict.gov.ph", 480, 0],
      ["kyle.rafer@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Certification.DigiGov.8hrs.06-29-2026",
    purpose: "Certification.DigiGov.8hrs.06-29-2026",
    file: "certificationdigigov8hrs06292026_20260629.pdf",
    date: "2026-06-29",
    approved: "2026-06-29",
    employees: [
      ["leo.alilam@dict.gov.ph", 480, 0],
      ["maricar.pecson@dict.gov.ph", 480, 0],
      ["jaymar.recolizado@dict.gov.ph", 480, 0],
      ["mohamadnor.usman@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional (Jul 3, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabelaadditional_20260714.pdf",
    date: "2026-07-03",
    approved: "2026-07-14",
    employees: [["christopher.capili@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification.IsabelaPO.8hrs.07-03-2026",
    purpose: "Certification.IsabelaPO.8hrs.07-03-2026",
    file: "certificationisabelapo8hrs07032026_20260703.pdf",
    date: "2026-07-03",
    approved: "2026-07-03",
    employees: [
      ["marcivan.guillermo@dict.gov.ph", 480, 0],
      ["bryan.tomas@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo: "Certification.Martin.Lim.4hrs.07-03-2026",
    purpose: "Certification.Martin.Lim.4hrs.07-03-2026",
    file: "certificationmartinlim4hrs07032026_20260703.pdf",
    date: "2026-07-03",
    approved: "2026-07-03",
    employees: [
      ["nardo.lim@dict.gov.ph", 480, 0],
      ["glenard.martin@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo: "Certification.Suyu.Maggay.4hrs.07-03-2026",
    purpose: "Certification.Suyu.Maggay.4hrs.07-03-2026",
    file: "certificationsuyumaggay4hrs07032026_20260703.pdf",
    date: "2026-07-03",
    approved: "2026-07-03",
    employees: [
      ["maylanie.maggay@dict.gov.ph", 240, 0],
      ["kyle.suyu@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela (Jul 7, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabela_20260715.pdf",
    date: "2026-07-07",
    approved: "2026-07-15",
    employees: [
      ["leo.alilam@dict.gov.ph", 90, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 90, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela (Jul 8, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabela_20260715.pdf",
    date: "2026-07-08",
    approved: "2026-07-15",
    employees: [
      ["leo.alilam@dict.gov.ph", 30, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 60, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional (Jul 9, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabelaadditional_20260714.pdf",
    date: "2026-07-09",
    approved: "2026-07-14",
    employees: [["rica.casuga@dict.gov.ph", 30, 0]],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela (Jul 9, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabela_20260715.pdf",
    date: "2026-07-09",
    approved: "2026-07-15",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 90, 0],
      ["janahpatrisha.albano@dict.gov.ph", 60, 0],
      ["roel.jimenez@dict.gov.ph", 90, 0],
      ["glenard.martin@dict.gov.ph", 90, 0],
      ["jaymar.recolizado@dict.gov.ph", 90, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 60, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional (Jul 10, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabelaadditional_20260714.pdf",
    date: "2026-07-10",
    approved: "2026-07-14",
    employees: [
      ["christopher.capili@dict.gov.ph", 480, 0],
      ["rica.casuga@dict.gov.ph", 360, 0],
      ["neilkristopher.guimmayen@dict.gov.ph", 540, 0],
      ["cyzione.mendoza@dict.gov.ph", 540, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela (Jul 10, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabela_20260715.pdf",
    date: "2026-07-10",
    approved: "2026-07-15",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 510, 0],
      ["janahpatrisha.albano@dict.gov.ph", 510, 0],
      ["leo.alilam@dict.gov.ph", 300, 0],
      ["bieghjohn.alonzo@dict.gov.ph", 300, 0],
      ["rito.banan@dict.gov.ph", 510, 240],
      ["janet.catinoy@dict.gov.ph", 510, 0],
      ["roel.jimenez@dict.gov.ph", 510, 0],
      ["maria.macasaddu@dict.gov.ph", 510, 0],
      ["glenard.martin@dict.gov.ph", 510, 0],
      ["maricar.pecson@dict.gov.ph", 420, 0],
      ["jaymar.recolizado@dict.gov.ph", 570, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 330, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional (Jul 11, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabelaadditional_20260714.pdf",
    date: "2026-07-11",
    approved: "2026-07-14",
    employees: [["rica.casuga@dict.gov.ph", 180, 0]],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela (Jul 11, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabela_20260715.pdf",
    date: "2026-07-11",
    approved: "2026-07-15",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 180, 0],
      ["bieghjohn.alonzo@dict.gov.ph", 360, 0],
      ["rito.banan@dict.gov.ph", 180, 0],
      ["roel.jimenez@dict.gov.ph", 180, 0],
      ["glenard.martin@dict.gov.ph", 180, 0],
      ["jaymar.recolizado@dict.gov.ph", 180, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 360, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional (Jul 12, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabelaadditional_20260714.pdf",
    date: "2026-07-12",
    approved: "2026-07-14",
    employees: [["rica.casuga@dict.gov.ph", 60, 0]],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela (Jul 12, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabela_20260715.pdf",
    date: "2026-07-12",
    approved: "2026-07-15",
    employees: [
      ["bieghjohn.alonzo@dict.gov.ph", 300, 0],
      ["maria.macasaddu@dict.gov.ph", 300, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 180, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional (Jul 13, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabelaadditional_20260714.pdf",
    date: "2026-07-13",
    approved: "2026-07-14",
    employees: [
      ["christopher.capili@dict.gov.ph", 390, 0],
      ["rica.casuga@dict.gov.ph", 330, 0],
      ["cyrill.cepeda@dict.gov.ph", 390, 0],
      ["aries.guim@dict.gov.ph", 390, 0],
      ["danmark.jose@dict.gov.ph", 390, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela (Jul 13, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabela_20260715.pdf",
    date: "2026-07-13",
    approved: "2026-07-15",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 390, 0],
      ["janahpatrisha.albano@dict.gov.ph", 330, 0],
      ["bieghjohn.alonzo@dict.gov.ph", 570, 0],
      ["rito.banan@dict.gov.ph", 390, 0],
      ["jeiariston.jimenez@dict.gov.ph", 510, 0],
      ["roel.jimenez@dict.gov.ph", 390, 0],
      ["maria.macasaddu@dict.gov.ph", 270, 0],
      ["glenard.martin@dict.gov.ph", 390, 0],
      ["jaymar.recolizado@dict.gov.ph", 390, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 330, 0],
      ["bryan.tomas@dict.gov.ph", 270, 0],
      ["kristine.valdez@dict.gov.ph", 270, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional (Jul 14, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela.Additional",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabelaadditional_20260714.pdf",
    date: "2026-07-14",
    approved: "2026-07-14",
    employees: [
      ["christopher.capili@dict.gov.ph", 120, 0],
      ["janet.catinoy@dict.gov.ph", 330, 0],
      ["neilkristopher.guimmayen@dict.gov.ph", 330, 0],
      ["danmark.jose@dict.gov.ph", 120, 0],
      ["glenard.martin@dict.gov.ph", 120, 0],
      ["vladimir.nuval@dict.gov.ph", 330, 0],
      ["kyle.rafer@dict.gov.ph", 330, 0],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela (Jul 14, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabela_20260715.pdf",
    date: "2026-07-14",
    approved: "2026-07-15",
    employees: [
      ["jeiariston.jimenez@dict.gov.ph", 540, 0],
      ["ivannpaul.santos@dict.gov.ph", 540, 135],
    ],
  },
  {
    memoNo:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela (Jul 15, 2026)",
    purpose:
      "Certification of COCs_R2 Personnel -Launching of GovNet & FPIAP in Ilagan City, Isabela",
    file: "certificationofcocsr2personnellaunchingofgovnetfpiapinilagancityisabela_20260715.pdf",
    date: "2026-07-15",
    approved: "2026-07-15",
    employees: [
      ["jeiariston.jimenez@dict.gov.ph", 150, 0],
      ["ivannpaul.santos@dict.gov.ph", 150, 0],
    ],
  },
  {
    memoNo:
      "Memorandum and Certification of Overtime Services – DICT AI Roadshow 2026 Working Committee (Jul 22, 2026)",
    purpose:
      "Memorandum and Certification of Overtime Services – DICT AI Roadshow 2026 Working Committee",
    file: "memorandumandcertificationofovertimeservicesdictairoadshow2026workingcommittee_20260725.pdf",
    date: "2026-07-22",
    approved: "2026-07-25",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 150, 0],
      ["janahpatrisha.albano@dict.gov.ph", 150, 0],
      ["bieghjohn.alonzo@dict.gov.ph", 120, 0],
      ["romelyn.arimbuyotan@dict.gov.ph", 120, 0],
      ["rito.banan@dict.gov.ph", 60, 0],
      ["juliuscezar.baquiran@dict.gov.ph", 120, 0],
      ["christopher.capili@dict.gov.ph", 120, 0],
      ["ricamae.carungi@dict.gov.ph", 120, 0],
      ["rica.casuga@dict.gov.ph", 240, 0],
      ["janet.catinoy@dict.gov.ph", 120, 0],
      ["cyrill.cepeda@dict.gov.ph", 120, 0],
      ["aries.guim@dict.gov.ph", 150, 0],
      ["neilkristopher.guimmayen@dict.gov.ph", 120, 0],
      ["roel.jimenez@dict.gov.ph", 120, 0],
      ["danmark.jose@dict.gov.ph", 150, 0],
      ["jasmine.macabangun@dict.gov.ph", 150, 0],
      ["maylanie.maggay@dict.gov.ph", 60, 0],
      ["vladimir.nuval@dict.gov.ph", 120, 0],
      ["hennessi.pedro@dict.gov.ph", 120, 0],
      ["jenny.prudenciado@dict.gov.ph", 150, 144],
      ["kyle.rafer@dict.gov.ph", 120, 0],
      ["jaymar.recolizado@dict.gov.ph", 60, 0],
      ["ivannpaul.santos@dict.gov.ph", 510, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 120, 0],
      ["leonor.tumaliuan@dict.gov.ph", 120, 0],
    ],
  },
  {
    memoNo:
      "Memorandum and Certification of Overtime Services – DICT AI Roadshow 2026 Working Committee (Jul 23, 2026)",
    purpose:
      "Memorandum and Certification of Overtime Services – DICT AI Roadshow 2026 Working Committee",
    file: "memorandumandcertificationofovertimeservicesdictairoadshow2026workingcommittee_20260725.pdf",
    date: "2026-07-23",
    approved: "2026-07-25",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 60, 0],
      ["janahpatrisha.albano@dict.gov.ph", 90, 0],
      ["romelyn.arimbuyotan@dict.gov.ph", 90, 0],
      ["rito.banan@dict.gov.ph", 240, 0],
      ["christopher.capili@dict.gov.ph", 240, 0],
      ["ricamae.carungi@dict.gov.ph", 90, 0],
      ["rica.casuga@dict.gov.ph", 360, 0],
      ["janet.catinoy@dict.gov.ph", 240, 0],
      ["cyrill.cepeda@dict.gov.ph", 240, 0],
      ["aries.guim@dict.gov.ph", 60, 0],
      ["neilkristopher.guimmayen@dict.gov.ph", 240, 0],
      ["roel.jimenez@dict.gov.ph", 240, 0],
      ["jasmine.macabangun@dict.gov.ph", 90, 0],
      ["maylanie.maggay@dict.gov.ph", 90, 0],
      ["vladimir.nuval@dict.gov.ph", 240, 0],
      ["jenny.prudenciado@dict.gov.ph", 90, 0],
      ["ivannpaul.santos@dict.gov.ph", 330, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 60, 0],
      ["leonor.tumaliuan@dict.gov.ph", 90, 0],
    ],
  },
  {
    memoNo:
      "Memorandum and Certification of Overtime Services – DICT AI Roadshow 2026 Working Committee (Jul 24, 2026)",
    purpose:
      "Memorandum and Certification of Overtime Services – DICT AI Roadshow 2026 Working Committee",
    file: "memorandumandcertificationofovertimeservicesdictairoadshow2026workingcommittee_20260725.pdf",
    date: "2026-07-24",
    approved: "2026-07-25",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 60, 0],
      ["janahpatrisha.albano@dict.gov.ph", 60, 0],
      ["romelyn.arimbuyotan@dict.gov.ph", 60, 0],
      ["rito.banan@dict.gov.ph", 60, 0],
      ["christopher.capili@dict.gov.ph", 60, 0],
      ["ricamae.carungi@dict.gov.ph", 60, 0],
      ["rica.casuga@dict.gov.ph", 240, 0],
      ["janet.catinoy@dict.gov.ph", 60, 0],
      ["cyrill.cepeda@dict.gov.ph", 60, 0],
      ["aries.guim@dict.gov.ph", 60, 0],
      ["neilkristopher.guimmayen@dict.gov.ph", 60, 0],
      ["roel.jimenez@dict.gov.ph", 60, 0],
      ["jasmine.macabangun@dict.gov.ph", 60, 0],
      ["maylanie.maggay@dict.gov.ph", 60, 0],
      ["vladimir.nuval@dict.gov.ph", 60, 0],
      ["jenny.prudenciado@dict.gov.ph", 60, 0],
      ["darlenejoy.seguritan@dict.gov.ph", 60, 0],
      ["leonor.tumaliuan@dict.gov.ph", 60, 0],
    ],
  },
  {
    memoNo:
      "Memorandum and Certification of Overtime Services – DICT AI Roadshow 2026 Working Committee (Jul 25, 2026)",
    purpose:
      "Memorandum and Certification of Overtime Services – DICT AI Roadshow 2026 Working Committee",
    file: "memorandumandcertificationofovertimeservicesdictairoadshow2026workingcommittee_20260725.pdf",
    date: "2026-07-25",
    approved: "2026-07-25",
    employees: [
      ["rica.casuga@dict.gov.ph", 360, 0],
      ["neilkristopher.guimmayen@dict.gov.ph", 360, 0],
    ],
  },
  {
    memoNo: "Certification.COC.6hrs.RegionalPNPKIAdvocacy&Awareness.8-07-2026",
    purpose: "Certification.COC.6hrs.RegionalPNPKIAdvocacy&Awareness.8-07-2026",
    file: "certificationcoc6hrsregionalpnpkiadvocacyawareness8072026_20260807.pdf",
    date: "2026-08-07",
    approved: "2026-08-07",
    employees: [
      ["deejay.anapi@dict.gov.ph", 360, 30],
      ["maylanie.maggay@dict.gov.ph", 360, 0],
      ["kyle.suyu@dict.gov.ph", 360, 0],
      ["joyceanne.urdillas@dict.gov.ph", 360, 0],
    ],
  },
  {
    memoNo: "Certification.COC.Jose.8-9-2026",
    purpose: "Certification.COC.Jose.8-9-2026",
    file: "certificationcocjose892026_20260809.pdf",
    date: "2026-08-09",
    approved: "2026-08-09",
    employees: [["danmark.jose@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification.COC.5hrs.DTCLaunchingLGUDelfinAlbano.8-14-2026",
    purpose: "Certification.COC.5hrs.DTCLaunchingLGUDelfinAlbano.8-14-2026",
    file: "certificationcoc5hrsdtclaunchinglgudelfinalbano8142026_20260814.pdf",
    date: "2026-08-14",
    approved: "2026-08-14",
    employees: [
      ["deejay.anapi@dict.gov.ph", 300, 0],
      ["juliuscezar.baquiran@dict.gov.ph", 300, 0],
      ["ivannpaul.santos@dict.gov.ph", 300, 0],
      ["kristine.valdez@dict.gov.ph", 300, 0],
    ],
  },
  {
    memoNo: "Certification.COC.4hrs.CAGELCO.RP.Urdillas.Pedro.8-28-2026",
    purpose: "Certification.COC.4hrs.CAGELCO.RP.Urdillas.Pedro.8-28-2026",
    file: "certificationcoc4hrscagelcorpurdillaspedro8282026_20260828.pdf",
    date: "2026-08-28",
    approved: "2026-08-28",
    employees: [
      ["hennessi.pedro@dict.gov.ph", 240, 0],
      ["joyceanne.urdillas@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo: "Certification.COC.6hrs.MCNP.RP.Casuga.8-28-2026",
    purpose: "Certification.COC.6hrs.MCNP.RP.Casuga.8-28-2026",
    file: "certificationcoc6hrsmcnprpcasuga8282026_20260828.pdf",
    date: "2026-08-28",
    approved: "2026-08-28",
    employees: [["rica.casuga@dict.gov.ph", 360, 0]],
  },
  {
    memoNo: "Certification.COC.8hrs.MSMETraining.Anapi.Macabangun.8-28-2026",
    purpose: "Certification.COC.8hrs.MSMETraining.Anapi.Macabangun.8-28-2026",
    file: "certificationcoc8hrsmsmetraininganapimacabangun8282026_20260828.pdf",
    date: "2026-08-28",
    approved: "2026-08-28",
    employees: [
      ["deejay.anapi@dict.gov.ph", 480, 0],
      ["jasmine.macabangun@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo:
      "Certification.COC.8hrs.PESOCaravan.Gazzingan.Baylon.Macasaddu.8-28-2026",
    purpose:
      "Certification.COC.8hrs.PESOCaravan.Gazzingan.Baylon.Macasaddu.8-28-2026",
    file: "certificationcoc8hrspesocaravangazzinganbaylonmacasaddu8282026_20260828.pdf",
    date: "2026-08-28",
    approved: "2026-08-28",
    employees: [["maria.macasaddu@dict.gov.ph", 480, 0]],
  },
  {
    memoNo: "Certification.COC.6hrs.TechQuest.09.2-4.2026 (Sep 2, 2026)",
    purpose: "Certification.COC.6hrs.TechQuest.09.2-4.2026",
    file: "certificationcoc6hrstechquest09242026_20260904.pdf",
    date: "2026-09-02",
    approved: "2026-09-04",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 120, 0],
      ["janahpatrisha.albano@dict.gov.ph", 120, 0],
      ["enriqueluis.alvarado@dict.gov.ph", 120, 0],
      ["deejay.anapi@dict.gov.ph", 120, 0],
      ["rica.casuga@dict.gov.ph", 120, 0],
      ["aries.guim@dict.gov.ph", 120, 0],
      ["jasmine.macabangun@dict.gov.ph", 120, 0],
      ["mohamadnor.usman@dict.gov.ph", 120, 0],
    ],
  },
  {
    memoNo: "Certification.COC.6hrs.TechQuest.09.2-4.2026 (Sep 3, 2026)",
    purpose: "Certification.COC.6hrs.TechQuest.09.2-4.2026",
    file: "certificationcoc6hrstechquest09242026_20260904.pdf",
    date: "2026-09-03",
    approved: "2026-09-04",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 120, 0],
      ["janahpatrisha.albano@dict.gov.ph", 120, 0],
      ["enriqueluis.alvarado@dict.gov.ph", 120, 0],
      ["deejay.anapi@dict.gov.ph", 120, 0],
      ["rica.casuga@dict.gov.ph", 120, 0],
      ["aries.guim@dict.gov.ph", 120, 0],
      ["jasmine.macabangun@dict.gov.ph", 120, 0],
      ["mohamadnor.usman@dict.gov.ph", 120, 0],
    ],
  },
  {
    memoNo: "Certification.COC.6hrs.TechQuest.09.2-4.2026 (Sep 4, 2026)",
    purpose: "Certification.COC.6hrs.TechQuest.09.2-4.2026",
    file: "certificationcoc6hrstechquest09242026_20260904.pdf",
    date: "2026-09-04",
    approved: "2026-09-04",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 120, 0],
      ["janahpatrisha.albano@dict.gov.ph", 120, 0],
      ["enriqueluis.alvarado@dict.gov.ph", 120, 0],
      ["deejay.anapi@dict.gov.ph", 120, 0],
      ["rica.casuga@dict.gov.ph", 120, 0],
      ["aries.guim@dict.gov.ph", 120, 0],
      ["jasmine.macabangun@dict.gov.ph", 120, 0],
      ["mohamadnor.usman@dict.gov.ph", 120, 0],
    ],
  },
  {
    memoNo: "Certification.COC.10hrs.Batang.Lim.09.05.2026",
    purpose: "Certification.COC.10hrs.Batang.Lim.09.05.2026",
    file: "certificationcoc10hrsbatanglim09052026_20260905.pdf",
    date: "2026-09-05",
    approved: "2026-09-05",
    employees: [["nardo.lim@dict.gov.ph", 600, 0]],
  },
  {
    memoNo: "Certification.COC.10hrs.TechQuest.09.05.2026",
    purpose: "Certification.COC.10hrs.TechQuest.09.05.2026",
    file: "certificationcoc10hrstechquest09052026_20260905.pdf",
    date: "2026-09-05",
    approved: "2026-09-05",
    employees: [
      ["christiandale.aguda@dict.gov.ph", 600, 0],
      ["janahpatrisha.albano@dict.gov.ph", 600, 0],
      ["enriqueluis.alvarado@dict.gov.ph", 600, 0],
      ["deejay.anapi@dict.gov.ph", 600, 0],
      ["rito.banan@dict.gov.ph", 600, 0],
      ["rica.casuga@dict.gov.ph", 600, 0],
      ["aries.guim@dict.gov.ph", 600, 0],
      ["jasmine.macabangun@dict.gov.ph", 600, 0],
      ["jaymar.recolizado@dict.gov.ph", 600, 0],
      ["mohamadnor.usman@dict.gov.ph", 600, 0],
    ],
  },
  {
    memoNo: "Certification.COC.4hrs.FPIAP.Jose.Guimmayen.Mendoza.09.05.2026",
    purpose: "Certification.COC.4hrs.FPIAP.Jose.Guimmayen.Mendoza.09.05.2026",
    file: "certificationcoc4hrsfpiapjoseguimmayenmendoza09052026_20260905.pdf",
    date: "2026-09-05",
    approved: "2026-09-05",
    employees: [
      ["neilkristopher.guimmayen@dict.gov.ph", 240, 0],
      ["danmark.jose@dict.gov.ph", 240, 0],
      ["cyzione.mendoza@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo: "Certification.COC.8hrs.Anapi.09.06.2026",
    purpose: "Certification.COC.8hrs.Anapi.09.06.2026",
    file: "certificationcoc8hrsanapi09062026_20260906.pdf",
    date: "2026-09-06",
    approved: "2026-09-06",
    employees: [["deejay.anapi@dict.gov.ph", 480, 0]],
  },
  {
    memoNo:
      "Certification.COC.FPIAP.GECS.GOVNET.2026BarExam.09.6&9&12.2026 (Sep 6, 2026)",
    purpose: "Certification.COC.FPIAP.GECS.GOVNET.2026BarExam.09.6&9&12.2026",
    file: "certificationcocfpiapgecsgovnet2026barexam0969122026_20260913.pdf",
    date: "2026-09-06",
    approved: "2026-09-13",
    employees: [
      ["janet.catinoy@dict.gov.ph", 720, 0],
      ["neilkristopher.guimmayen@dict.gov.ph", 720, 0],
      ["danmark.jose@dict.gov.ph", 720, 0],
      ["cyzione.mendoza@dict.gov.ph", 720, 0],
      ["kyle.rafer@dict.gov.ph", 720, 0],
    ],
  },
  {
    memoNo:
      "Certification.COC.FPIAP.GECS.GOVNET.2026BarExam.09.6&9&12.2026 (Sep 9, 2026)",
    purpose: "Certification.COC.FPIAP.GECS.GOVNET.2026BarExam.09.6&9&12.2026",
    file: "certificationcocfpiapgecsgovnet2026barexam0969122026_20260913.pdf",
    date: "2026-09-09",
    approved: "2026-09-13",
    employees: [["cyzione.mendoza@dict.gov.ph", 420, 0]],
  },
  {
    memoNo:
      "Certification.COC.FPIAP.GECS.GOVNET.2026BarExam.09.6&9&12.2026 (Sep 12, 2026)",
    purpose: "Certification.COC.FPIAP.GECS.GOVNET.2026BarExam.09.6&9&12.2026",
    file: "certificationcocfpiapgecsgovnet2026barexam0969122026_20260913.pdf",
    date: "2026-09-12",
    approved: "2026-09-13",
    employees: [
      ["janet.catinoy@dict.gov.ph", 480, 0],
      ["cyzione.mendoza@dict.gov.ph", 240, 0],
      ["kyle.rafer@dict.gov.ph", 720, 0],
    ],
  },
  {
    memoNo: "Certification.COC.NTE.FPIAP.09.12.2026",
    purpose: "Certification.COC.NTE.FPIAP.09.12.2026",
    file: "certificationcocntefpiap09122026_20260912.pdf",
    date: "2026-09-12",
    approved: "2026-09-12",
    employees: [
      ["cyrill.cepeda@dict.gov.ph", 240, 0],
      ["roel.jimenez@dict.gov.ph", 240, 0],
      ["vladimir.nuval@dict.gov.ph", 240, 0],
    ],
  },
  {
    memoNo:
      "Certification.COC.FPIAP.GECS.GOVNET.2026BarExam.09.6&9&12.2026 (Sep 13, 2026)",
    purpose: "Certification.COC.FPIAP.GECS.GOVNET.2026BarExam.09.6&9&12.2026",
    file: "certificationcocfpiapgecsgovnet2026barexam0969122026_20260913.pdf",
    date: "2026-09-13",
    approved: "2026-09-13",
    employees: [
      ["janet.catinoy@dict.gov.ph", 720, 0],
      ["cyzione.mendoza@dict.gov.ph", 720, 0],
    ],
  },
  {
    memoNo: "Certification.COC.HNP.FPIAP.09.13.2026",
    purpose: "Certification.COC.HNP.FPIAP.09.13.2026",
    file: "certificationcochnpfpiap09132026_20260913.pdf",
    date: "2026-09-13",
    approved: "2026-09-13",
    employees: [
      ["rito.banan@dict.gov.ph", 480, 0],
      ["christopher.capili@dict.gov.ph", 480, 0],
      ["roel.jimenez@dict.gov.ph", 480, 0],
      ["glenard.martin@dict.gov.ph", 480, 0],
      ["kyle.rafer@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo:
      "Certification.COC.Jimenez.Alvarado.16hrs.09.19-20.2026 (Sep 19, 2026)",
    purpose: "Certification.COC.Jimenez.Alvarado.16hrs.09.19-20.2026",
    file: "certificationcocjimenezalvarado16hrs0919202026_20260920.pdf",
    date: "2026-09-19",
    approved: "2026-09-20",
    employees: [
      ["enriqueluis.alvarado@dict.gov.ph", 480, 0],
      ["roel.jimenez@dict.gov.ph", 480, 0],
    ],
  },
  {
    memoNo:
      "Certification.COC.Jimenez.Alvarado.16hrs.09.19-20.2026 (Sep 20, 2026)",
    purpose: "Certification.COC.Jimenez.Alvarado.16hrs.09.19-20.2026",
    file: "certificationcocjimenezalvarado16hrs0919202026_20260920.pdf",
    date: "2026-09-20",
    approved: "2026-09-20",
    employees: [
      ["enriqueluis.alvarado@dict.gov.ph", 480, 0],
      ["roel.jimenez@dict.gov.ph", 480, 0],
    ],
  },
];

const CREDITED_BY_EMAIL = "leonor.tumaliuan@dict.gov.ph";

// Where the memo files are hosted; uploadedMemo = `${MEMO_BASE_PATH}/${file}`
const MEMO_BASE_PATH = "/uploads/cto_memos";
const MAX_MEMO_HOURS = 40; // ctoCreditModel duration cap

// The model caps a memo's duration at 40 hrs, but a few memos in the workbook
// are longer. For those, only the duration cap is skipped; every other field
// is still validated.
const DURATION_PATHS = ["duration.hours", "duration.minutes"];

const validateCredit = async (credit, overCap) => {
  try {
    await credit.validate();
  } catch (err) {
    const otherErrors = Object.keys(err.errors || {}).filter(
      (path) => !(overCap && DURATION_PATHS.includes(path)),
    );
    if (!err.errors || otherErrors.length > 0) throw err;
  }
};

// Flags:
//   --dry-run          validate everything, write nothing
//   --clean, --delete  remove the CTO credits this seeder created
//   --force            with --clean: delete even if CTO was used/reserved on them since seeding
const DRY_RUN = process.argv.includes("--dry-run");
const CLEAN =
  process.argv.includes("--clean") || process.argv.includes("--delete");
const FORCE = process.argv.includes("--force");

const round = (n) => Math.round(n * 10000) / 10000;
const toHours = (minutes) => round(minutes / 60);

// Recompute balances.ctoHours from every active credit, not just seeded ones
const recomputeCtoBalances = async (employeeIds) => {
  if (employeeIds.size === 0) return;

  const ids = [...employeeIds].map((id) => new mongoose.Types.ObjectId(id));
  const totals = await CtoCredit.aggregate([
    { $match: { status: "CREDITED" } },
    { $unwind: "$employees" },
    {
      $match: {
        "employees.employee": { $in: ids },
        "employees.status": { $ne: "ROLLEDBACK" },
      },
    },
    {
      $group: {
        _id: "$employees.employee",
        remaining: { $sum: "$employees.remainingHours" },
      },
    },
  ]);

  const totalById = new Map(totals.map((t) => [String(t._id), t.remaining]));
  await Employee.bulkWrite(
    ids.map((id) => ({
      updateOne: {
        filter: { _id: id },
        update: {
          $set: {
            "balances.ctoHours": round(totalById.get(String(id)) || 0),
          },
        },
      },
    })),
  );
  console.log(`  🔄 Updated CTO balance of ${ids.length} employee/s`);
};

// Deletes only the credits this seeder created (matched by memoNo)
const cleanCtoCredits = async () => {
  const seededUsedHours = new Map(); // `${memoNo}|${email}` -> usedHours at seeding
  const memoNos = ctoCreditsData.map(({ memoNo, employees }) => {
    employees.forEach(([email, , usedMinutes]) =>
      seededUsedHours.set(`${memoNo}|${email}`, toHours(usedMinutes)),
    );
    return memoNo;
  });

  const credits = await CtoCredit.find({ memoNo: { $in: memoNos } })
    .populate("employees.employee", "email")
    .lean();

  if (credits.length === 0) {
    console.log("  ⏩ Nothing to delete (no seeded CTO credits found)");
    return;
  }

  // Refuse to delete credits the app has used or reserved CTO against since seeding
  const touched = [];
  for (const credit of credits) {
    for (const e of credit.employees) {
      const email = e.employee?.email;
      const seededUsed = seededUsedHours.get(`${credit.memoNo}|${email}`) ?? 0;
      if (
        (e.reservedHours || 0) > 0 ||
        round(e.usedHours || 0) !== seededUsed
      ) {
        touched.push(
          `${credit.memoNo} → ${email} (used ${e.usedHours}, reserved ${e.reservedHours})`,
        );
      }
    }
  }

  if (touched.length > 0) {
    console.warn(
      `  ⚠️  ${touched.length} seeded credit/s have CTO used or reserved since seeding:`,
    );
    touched.forEach((t) => console.warn(`     - ${t}`));
    if (!FORCE) {
      throw new Error(
        "Refusing to delete. Cancel those CTO applications first, or re-run with --force.",
      );
    }
  }

  const employeeIds = new Set(
    credits.flatMap((c) =>
      c.employees.map((e) => String(e.employee?._id || e.employee)),
    ),
  );

  if (DRY_RUN) {
    credits.forEach((c) => console.log(`  🗑️  Would delete: ${c.memoNo}`));
    console.log(
      `\n✅ Dry run. Would delete ${credits.length} CTO credit/s and update ${employeeIds.size} employee balance/s`,
    );
    return;
  }

  const { deletedCount } = await CtoCredit.deleteMany({
    _id: { $in: credits.map((c) => c._id) },
  });
  console.log(`  🗑️  Deleted ${deletedCount} CTO credit/s`);

  await recomputeCtoBalances(employeeIds);
  console.log("\n✅ Done cleaning.");
};

const seedCtoCredits = async () => {
  if (!process.env.MONGO_URI) {
    console.error(
      "❌ MONGO_URI is not set. Run with: node --env-file=.env.production seeders/seed-ctoCredit.js",
    );
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(
      `✅ Connected to MongoDB (database: "${mongoose.connection.name}")`,
    );

    if (CLEAN) {
      console.log(
        `⏳ Deleting seeded CTO credits${DRY_RUN ? " (dry run)" : ""}...`,
      );
      await cleanCtoCredits();
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`⏳ Seeding CTO credits${DRY_RUN ? " (dry run)" : ""}...`);

    // 1. Employees
    const emails = [
      ...new Set(ctoCreditsData.flatMap((m) => m.employees.map(([e]) => e))),
    ];
    const employees = await Employee.find(
      { email: { $in: [...emails, CREDITED_BY_EMAIL] } },
      { _id: 1, email: 1 },
    ).lean();
    const employeeByEmail = new Map(employees.map((e) => [e.email, e._id]));

    const creditedBy = employeeByEmail.get(CREDITED_BY_EMAIL);
    if (!creditedBy) {
      throw new Error(
        `creditedBy employee "${CREDITED_BY_EMAIL}" not found. Run seed-joEmployee.js first.`,
      );
    }

    const missing = emails.filter((e) => !employeeByEmail.has(e));
    missing.forEach((e) =>
      console.warn(`  ⚠️  Employee not found: ${e}; their credits are skipped`),
    );

    // 2. Credits (one failure does not stop the rest)
    const touchedEmployeeIds = new Set();

    for (const memo of ctoCreditsData) {
      const { memoNo } = memo;
      try {
        if (await CtoCredit.exists({ memoNo })) {
          skipped++;
          console.log(`  ⏩ Skipped: ${memoNo} (already exists)`);
          continue;
        }

        const overtimeDate = new Date(memo.date);
        const approvedDate = new Date(memo.approved);
        const employeeEntries = memo.employees
          .filter(([email]) => employeeByEmail.has(email))
          .map(([email, creditedMinutes, usedMinutes]) => {
            const creditedHours = toHours(creditedMinutes);
            const usedHours = toHours(usedMinutes);
            return {
              employee: employeeByEmail.get(email),
              creditedHours,
              usedHours,
              reservedHours: 0,
              remainingHours: round(creditedHours - usedHours),
              status: "ACTIVE",
              dateCredited: approvedDate,
            };
          });

        if (employeeEntries.length === 0) {
          skipped++;
          console.log(`  ⏩ Skipped: ${memoNo} (no matching employees)`);
          continue;
        }

        // Duration = longest overtime rendered by one employee that day
        const durationMinutes = Math.max(...memo.employees.map(([, c]) => c));
        const overCap = durationMinutes > MAX_MEMO_HOURS * 60;
        if (overCap) {
          console.warn(
            `  ⚠️  ${memoNo}: ${toHours(durationMinutes)} hrs is above the model's ${MAX_MEMO_HOURS}-hr cap; saved as-is`,
          );
        }

        const credit = new CtoCredit({
          memoNo,
          dateApproved: approvedDate,
          uploadedMemo: `${MEMO_BASE_PATH}/${memo.file}`,
          inclusiveDates: {
            startDate: overtimeDate,
            endDate: overtimeDate,
          },
          purpose: memo.purpose,
          duration: {
            hours: Math.floor(durationMinutes / 60),
            minutes: durationMinutes % 60,
          },
          employees: employeeEntries,
          status: "CREDITED",
          dateCredited: approvedDate,
          creditedBy,
        });

        await validateCredit(credit, overCap);
        if (!DRY_RUN) {
          await credit.save({ validateBeforeSave: false }); // validated above
        }
        employeeEntries.forEach((e) =>
          touchedEmployeeIds.add(String(e.employee)),
        );
        inserted++;
        console.log(
          `  ➕ ${DRY_RUN ? "Would insert" : "Inserted"}: ${memoNo} (${employeeEntries.length} employee/s) → ${memo.file}`,
        );
      } catch (err) {
        failed++;
        const details = err?.errors
          ? Object.values(err.errors)
              .map((e) => e.message)
              .join("; ")
          : err.message;
        console.error(`  ❌ Failed: ${memoNo} → ${details}`);
      }
    }

    // 3. Balances
    if (!DRY_RUN) {
      await recomputeCtoBalances(touchedEmployeeIds);
    }

    console.log(
      `\n✅ Done. Inserted: ${inserted}, Skipped: ${skipped}, Failed: ${failed}`,
    );
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error(
      `❌ Error ${CLEAN ? "deleting" : "seeding"} CTO credits:`,
      error.message,
    );
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seedCtoCredits();
