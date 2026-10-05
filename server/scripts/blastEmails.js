#!/usr/bin/env node
// scripts/blastEmails.js
// Blasts each employee their portal credentials (email + password).
//
// Safe by default: without --send it only previews (lists recipients and writes
// previews/credentials.html). Every real send is logged to logs/, and re-running
// skips anyone already sent, so an interrupted blast can be resumed.
//
// Usage:
//   node --env-file=.env.development scripts/blastEmails.js                 # dry run
//   node --env-file=.env.development scripts/blastEmails.js --only a@b --send
//   node --env-file=.env.development scripts/blastEmails.js --send          # real blast
//
// Options:
//   --send              Actually send. Without it, nothing is sent.
//   --test              Redirect every message to TEST_TO from .env
//   --to <email>        Redirect every message to this address instead
//   --only <a,b,...>    Only these recipient emails
//   --limit <n>         Stop after n recipients
//   --delay <ms>        Pause between sends (default 1500)
//   --resend            Ignore the sent log and send to everyone again
//
// Environment:
//   EMAIL_USER               Gmail address used to send
//   EMAIL_PASS               Gmail app password
//   FRONTEND_URL             portal link for the "Sign In to Portal" button
//   PORTAL_LOGIN_URL         (optional) overrides FRONTEND_URL for the button
//   TEST_TO                  address used by --test
//   BLAST_DEFAULT_PASSWORD   password sent to everyone

const fs = require("fs");
const path = require("path");
const {
  blastAccountCredentialsEmail,
} = require("../utils/blastEmailTemplates");

const ROOT = path.resolve(__dirname, "..");
const LOG_FILE = path.join(ROOT, "logs", "blast-credentials.jsonl");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ───────────────────────────────────────────────────────────────
// PERSONNEL — DICT Region 2
// (Regional Director and Assistant Regional Director excluded)
// mi = middle initial
// ───────────────────────────────────────────────────────────────
const PERSONNEL = [
  // Chiefs / Provincial Officers
  {
    firstName: "Magdalena",
    lastName: "Gomez",
    mi: "D",
    email: "magie.gomez@dict.gov.ph",
  },
  {
    firstName: "Ronald",
    lastName: "Bariuan",
    mi: "S",
    email: "ronie.bariuan@dict.gov.ph",
  },
  {
    firstName: "Rogelio",
    lastName: "Layugan",
    mi: "T",
    email: "rogelio.layugan@dict.gov.ph",
  },
  {
    firstName: "Cirilo Jr.",
    lastName: "Gazzingan",
    mi: "N",
    email: "jr.gazzingan@dict.gov.ph",
  },
  {
    firstName: "Virginia",
    lastName: "Baculi",
    mi: "C",
    email: "gie.baculi@dict.gov.ph",
  },
  {
    firstName: "Edison",
    lastName: "Agaoid",
    mi: "S",
    email: "edison.agaoid@dict.gov.ph",
  },
  {
    firstName: "Johanna",
    lastName: "Tulauan",
    mi: "F",
    email: "johanna.tulauan@dict.gov.ph",
  },

  // Office of the Regional Director
  {
    firstName: "Samantha",
    lastName: "Dawideo",
    mi: "P",
    email: "samantha.dawideo@dict.gov.ph",
  },
  {
    firstName: "Mark John",
    lastName: "Tumaliuan",
    mi: "C",
    email: "markjohn.tumaliuan@dict.gov.ph",
  },

  // Technical Operations Division
  {
    firstName: "Johny",
    lastName: "Batang",
    mi: "C",
    email: "johny.batang@dict.gov.ph",
  },
  {
    firstName: "Joey Mark",
    lastName: "Elchico",
    mi: "D",
    email: "joeymark.elchico@dict.gov.ph",
  },
  {
    firstName: "Kyle Ruzzel",
    lastName: "Suyu",
    mi: "C",
    email: "kyle.suyu@dict.gov.ph",
  },
  {
    firstName: "Rica",
    lastName: "Casuga",
    mi: "V",
    email: "rica.casuga@dict.gov.ph",
  },
  {
    firstName: "Christian Dale",
    lastName: "Aguda",
    mi: "C",
    email: "christiandale.aguda@dict.gov.ph",
  },
  {
    firstName: "Aries Anthony",
    lastName: "Guim",
    mi: "F",
    email: "aries.guim@dict.gov.ph",
  },
  {
    firstName: "Jei Ariston",
    lastName: "Jimenez",
    mi: "C",
    email: "jeiariston.jimenez@dict.gov.ph",
  },
  {
    firstName: "Dan Mark",
    lastName: "Jose",
    mi: "R",
    email: "danmark.jose@dict.gov.ph",
  },
  {
    firstName: "Yancee Kearvin Kyle",
    lastName: "Rafer",
    mi: "A",
    email: "kyle.rafer@dict.gov.ph",
  },
  {
    firstName: "Glenard",
    lastName: "Martin",
    mi: "F",
    email: "glenard.martin@dict.gov.ph",
  },
  {
    firstName: "Nardo",
    lastName: "Lim",
    mi: "A",
    email: "nardo.lim@dict.gov.ph",
  },
  {
    firstName: "Janet",
    lastName: "Catinoy",
    mi: "T",
    email: "janet.catinoy@dict.gov.ph",
  },
  {
    firstName: "Cyrill Shane",
    lastName: "Cepeda",
    mi: "T",
    email: "cyrill.cepeda@dict.gov.ph",
  },
  {
    firstName: "Neil Kristopher",
    lastName: "Guimmayen",
    mi: "C",
    email: "neilkristopher.guimmayen@dict.gov.ph",
  },
  {
    firstName: "Czyione Dayl",
    lastName: "Mendoza",
    mi: "A",
    email: "cyzione.mendoza@dict.gov.ph",
  },
  {
    firstName: "Rito",
    lastName: "Banan",
    mi: "G",
    email: "rito.banan@dict.gov.ph",
  },
  {
    firstName: "Roel",
    lastName: "Jimenez",
    mi: "U",
    email: "roel.jimenez@dict.gov.ph",
  },
  {
    firstName: "Christopher Eleeson",
    lastName: "Capili",
    mi: "L",
    email: "christopher.capili@dict.gov.ph",
  },
  {
    firstName: "Vladimir Viktor",
    lastName: "Nuval",
    mi: "G",
    email: "vladimir.nuval@dict.gov.ph",
  },
  {
    firstName: "Maricar",
    lastName: "Pecson",
    mi: "S",
    email: "maricar.pecson@dict.gov.ph",
  },
  {
    firstName: "Jaymar",
    lastName: "Recolizado",
    mi: "C",
    email: "jaymar.recolizado@dict.gov.ph",
  },
  {
    firstName: "Mohamadnor",
    lastName: "Usman",
    mi: "G",
    email: "mohamadnor.usman@dict.gov.ph",
  },
  {
    firstName: "Hennessi",
    lastName: "Pedro",
    mi: "S",
    email: "hennessi.pedro@dict.gov.ph",
  },
  {
    firstName: "Joyce Ann",
    lastName: "Urdillas",
    mi: "P",
    email: "joyceanne.urdillas@dict.gov.ph",
  },

  // Administrative and Finance Division
  {
    firstName: "Jemar Jay",
    lastName: "Del Rosario",
    mi: "C",
    email: "jemar.delrosario@dict.gov.ph",
  },
  {
    firstName: "Lot-Lot",
    lastName: "Abrigo",
    mi: "A",
    email: "lotlot.acera@dict.gov.ph",
  },
  {
    firstName: "Jayfer",
    lastName: "Ammasi",
    mi: "T",
    email: "jayfer.ammasi@dict.gov.ph",
  },
  {
    firstName: "Christine Joyce",
    lastName: "Bueno",
    mi: "V",
    email: "christine.bueno@dict.gov.ph",
  },
  {
    firstName: "Edward",
    lastName: "Manuel",
    mi: "C",
    email: "edward.manuel@dict.gov.ph",
  },
  {
    firstName: "Edmund",
    lastName: "Manuel",
    mi: "C",
    email: "edmund.manuel@dict.gov.ph",
  },
  {
    firstName: "Elon",
    lastName: "Domingo",
    mi: "F",
    email: "elon.domingo@dict.gov.ph",
  },
  {
    firstName: "Claro",
    lastName: "Maggay",
    mi: "M",
    email: "claro.maggay@dict.gov.ph",
  },
  {
    firstName: "Pablo",
    lastName: "Fugaban",
    mi: "G",
    email: "pablo.fugaban@dict.gov.ph",
  },
  {
    firstName: "Nodel",
    lastName: "Tumaliuan",
    mi: "M",
    email: "nodel.tumaliuan@dict.gov.ph",
  },
  {
    firstName: "Julius Cezar",
    lastName: "Baquiran",
    mi: "C",
    email: "juliuscezar.baquiran@dict.gov.ph",
  },
  {
    firstName: "Kate Angelie",
    lastName: "Villagracia",
    mi: "M",
    email: "kate.villagracia@dict.gov.ph",
  },
  {
    firstName: "Jenny",
    lastName: "Prudenciado",
    mi: "S",
    email: "jenny.prudenciado@dict.gov.ph",
  },
  {
    firstName: "Leonor",
    lastName: "Tumaliuan",
    mi: "J",
    email: "leonor.tumaliuan@dict.gov.ph",
  },
  {
    firstName: "Mar Elvison",
    lastName: "Baquiran",
    mi: "A",
    email: "mar.baquiran@dict.gov.ph",
  },
  {
    firstName: "Rica Mae",
    lastName: "Carungi",
    mi: "M",
    email: "ricamae.carungi@dict.gov.ph",
  },
  {
    firstName: "Romelyn",
    lastName: "Arimbuyotan",
    mi: "R",
    email: "romelyn.arimbuyotan@dict.gov.ph",
  },
  {
    firstName: "Janah Patrisha",
    lastName: "Albano",
    mi: "D",
    email: "janahpatrisha.albano@dict.gov.ph",
  },
  {
    firstName: "Ivann Paul",
    lastName: "Santos",
    mi: "M",
    email: "ivannpaul.santos@dict.gov.ph",
  },

  // Batanes Provincial Office
  {
    firstName: "Roland",
    lastName: "Hubalde",
    mi: "B",
    email: "roland.hubalde@dict.gov.ph",
  },
  {
    firstName: "Adelmo",
    lastName: "Cano",
    mi: "G",
    email: "delmo.cano@dict.gov.ph",
  },
  {
    firstName: "Alison",
    lastName: "Abbas",
    mi: "A",
    email: "alison.abbas@dict.gov.ph",
  },
  {
    firstName: "Nyssa Mae",
    lastName: "Telmo",
    mi: "H",
    email: "nyssamae.telmo@dict.gov.ph",
  },
  {
    firstName: "Jayson",
    lastName: "Guisando",
    mi: "S",
    email: "jayson.guisando@dict.gov.ph",
  },

  // Cagayan Provincial Office
  {
    firstName: "Ferdinand",
    lastName: "Abad",
    mi: "B",
    email: "ferdie.abad@dict.gov.ph",
  },
  {
    firstName: "Richard",
    lastName: "Baligod",
    mi: "P",
    email: "ricky.baligod@dict.gov.ph",
  },
  {
    firstName: "Alvin",
    lastName: "Bermejo",
    mi: "B",
    email: "alvin.bermejo@dict.gov.ph",
  },
  {
    firstName: "Deejay",
    lastName: "Anapi",
    mi: "G",
    email: "deejay.anapi@dict.gov.ph",
  },
  {
    firstName: "Maylanie",
    lastName: "Maggay",
    mi: "O",
    email: "maylanie.maggay@dict.gov.ph",
  },
  {
    firstName: "Darlene Joy",
    lastName: "Seguritan",
    mi: "B",
    email: "darlenejoy.seguritan@dict.gov.ph",
  },
  {
    firstName: "Leo Jay",
    lastName: "Alilam",
    mi: "L",
    email: "leo.alilam@dict.gov.ph",
  },

  // Isabela Provincial Office - Cauayan
  {
    firstName: "Eugene",
    lastName: "Pabro",
    mi: "L",
    email: "eugene.pabro@dict.gov.ph",
  },
  {
    firstName: "Concepcion",
    lastName: "Nazarita",
    mi: "C",
    email: "conie.nazarita@dict.gov.ph",
  },
  {
    firstName: "Daniel",
    lastName: "Ramirez",
    mi: "P",
    email: "daniel.ramirez@dict.gov.ph",
  },
  {
    firstName: "Marilyn",
    lastName: "Robles",
    mi: "F",
    email: "marilyn.robles@dict.gov.ph",
  },
  {
    firstName: "Biegh John Paul",
    lastName: "Alonzo",
    mi: "B",
    email: "bieghjohn.alonzo@dict.gov.ph",
  },
  {
    firstName: "Maria Kristine",
    lastName: "Valdez",
    mi: "T",
    email: "kristine.valdez@dict.gov.ph",
  },
  {
    firstName: "Bryan",
    lastName: "Tomas",
    mi: "H",
    email: "bryan.tomas@dict.gov.ph",
  },
  {
    firstName: "Maria Ea Katrina",
    lastName: "Macasaddu",
    mi: "G",
    email: "maria.macasaddu@dict.gov.ph",
  },
  {
    firstName: "Jesus",
    lastName: "Baylon",
    mi: "B",
    email: "jesus.baylon@dict.gov.ph",
  },

  // Isabela Provincial Office - Santiago
  {
    firstName: "Lanie",
    lastName: "Cabacungan",
    mi: "A",
    email: "lanie.cabacungan@dict.gov.ph",
  },
  {
    firstName: "Medy Jose",
    lastName: "Cabacungan",
    mi: "M",
    email: "jose.cabacungan@dict.gov.ph",
  },
  {
    firstName: "Marc Ivan",
    lastName: "Guillermo",
    mi: "D",
    email: "marcivan.guillermo@dict.gov.ph",
  },
  {
    firstName: "Jasmine",
    lastName: "Macabangun",
    mi: "E",
    email: "jasmine.macabangun@dict.gov.ph",
  },

  // Quirino Provincial Office
  {
    firstName: "Enrique Luis",
    lastName: "Alvarado",
    mi: "P",
    email: "enriqueluis.alvarado@dict.gov.ph",
  },
  {
    firstName: "Exen",
    lastName: "Claro",
    mi: "B",
    email: "exen.claro@dict.gov.ph",
  },
  {
    firstName: "Jeanne Shannon",
    lastName: "Garcia",
    mi: "O",
    email: "jeanne.garcia@dict.gov.ph",
  },

  // Nueva Vizcaya Provincial Office
  {
    firstName: "Ma. Elijah",
    lastName: "Pilotin",
    mi: "H",
    email: "maelijah.pilotin@dict.gov.ph",
  },
  {
    firstName: "Debora",
    lastName: "Backiawan",
    mi: "P",
    email: "debora.backiawan@dict.gov.ph",
  },
  {
    firstName: "Karl Steven",
    lastName: "Maddela",
    mi: "A",
    email: "karlsteven.maddela@dict.gov.ph",
  },
  {
    firstName: "Diether",
    lastName: "Abad",
    mi: "A",
    email: "diether.abad@dict.gov.ph",
  },
];

// "Marc Ivan" + "Guillermo" + "D" -> "MARC IVAN GUILLERMO D."
function fullNameOf(p) {
  const mi = p.mi ? `${String(p.mi).trim().replace(/\.$/, "")}.` : "";
  return [p.firstName, p.lastName, mi].filter(Boolean).join(" ").toUpperCase();
}

// ── .env loader (no dependency) ────────────────────────────────
// Loads .env.<NODE_ENV> (default: development), then .env.development, then .env.
// Values already set (e.g. via --env-file) are never overwritten.
function loadDotEnv() {
  const envName = process.env.NODE_ENV || "development";
  const candidates = [`.env.${envName}`, ".env.development", ".env"];
  for (const name of [...new Set(candidates)]) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

// ── args ───────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

// ── recipients ─────────────────────────────────────────────────
function getRecipients() {
  const valid = [];
  const skipped = [];
  const seen = new Set();
  for (const p of PERSONNEL) {
    const email = String(p.email || "")
      .trim()
      .toLowerCase();
    const name = fullNameOf(p);
    if (!EMAIL_RE.test(email))
      skipped.push(`${name}: invalid email "${email}"`);
    else if (seen.has(email)) skipped.push(`${name}: duplicate email ${email}`);
    else {
      seen.add(email);
      valid.push({ ...p, email, fullName: name });
    }
  }
  return { valid, skipped };
}

// ── sent log (JSON lines) ──────────────────────────────────────
function readSentSet() {
  const sent = new Set();
  if (!fs.existsSync(LOG_FILE)) return sent;
  for (const line of fs.readFileSync(LOG_FILE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e.status === "sent") sent.add(e.email);
    } catch {
      /* ignore broken line */
    }
  }
  return sent;
}

function appendLog(entry) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(
    LOG_FILE,
    JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n",
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendWithRetry(transporter, mail, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await transporter.sendMail(mail);
    } catch (err) {
      lastErr = err;
      // 5xx = permanent rejection (bad mailbox etc.), retrying won't help
      if (err.responseCode >= 500 && err.responseCode < 600) break;
      if (i < attempts) await sleep(2000 * 2 ** (i - 1));
    }
  }
  throw lastErr;
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// ── main ───────────────────────────────────────────────────────
async function main() {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));

  const password = process.env.BLAST_DEFAULT_PASSWORD;
  if (!password)
    fail("BLAST_DEFAULT_PASSWORD is not set (put it in your .env file).");

  const loginUrl =
    process.env.PORTAL_LOGIN_URL || process.env.FRONTEND_URL || "";
  if (!loginUrl)
    console.warn(
      "⚠ FRONTEND_URL is not set — emails will have no sign-in button.",
    );

  if (args.test) {
    if (!process.env.TEST_TO) fail("--test needs TEST_TO in your .env file");
    args.to = process.env.TEST_TO;
  }

  const render = (r) =>
    blastAccountCredentialsEmail({
      fullName: r.fullName,
      email: r.email,
      defaultPassword: password,
      loginUrl,
    });

  const { valid, skipped } = getRecipients();
  let recipients = valid;
  if (args.only) {
    const only = new Set(
      String(args.only)
        .split(",")
        .map((e) => e.trim().toLowerCase()),
    );
    recipients = recipients.filter((r) => only.has(r.email));
  }

  const alreadySent = args.resend || args.to ? new Set() : readSentSet();
  const pending = recipients.filter((r) => !alreadySent.has(r.email));
  const batch = args.limit ? pending.slice(0, Number(args.limit)) : pending;

  console.log(`\nPersonnel    : ${PERSONNEL.length}`);
  console.log(`Valid emails : ${valid.length}`);
  if (skipped.length) {
    console.log(`Skipped      : ${skipped.length}`);
    skipped.forEach((s) => console.log(`   - ${s}`));
  }
  if (alreadySent.size)
    console.log(
      `Already sent : ${recipients.length - pending.length} (from logs/blast-credentials.jsonl)`,
    );
  console.log(
    `This run     : ${batch.length}${args.to ? ` (all redirected to ${args.to})` : ""}`,
  );

  if (batch.length === 0) {
    console.log("\nNothing to send.\n");
    return;
  }

  // Always write a preview of the first message
  const previewDir = path.join(ROOT, "previews");
  fs.mkdirSync(previewDir, { recursive: true });
  const sample = render(batch[0]);
  fs.writeFileSync(path.join(previewDir, "credentials.html"), sample.html);
  fs.writeFileSync(path.join(previewDir, "credentials.txt"), sample.text);
  console.log(`\nSubject      : ${sample.subject}`);
  console.log("Preview      : previews/credentials.html (and .txt)");

  if (!args.send) {
    console.log("\nDRY RUN — nothing was sent. Recipients:");
    batch.forEach((r, i) =>
      console.log(`  ${String(i + 1).padStart(3)}. ${r.fullName} <${r.email}>`),
    );
    console.log("\nAdd --send to deliver.\n");
    return;
  }

  // ── real send (Gmail, same account as the backend) ──
  const { EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS)
    fail("EMAIL_USER and EMAIL_PASS must be set in your .env file.");

  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch {
    fail('nodemailer is not installed. Run "npm install nodemailer".');
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    pool: true,
    maxConnections: 1,
  });
  await transporter
    .verify()
    .catch((err) => fail(`Cannot connect to Gmail: ${err.message}`));

  const from = `"DICT CTO & Wellness" <${EMAIL_USER}>`;
  const delay = Number(args.delay ?? 1500);
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const r = batch[i];
    const msg = render(r);
    const to = args.to || r.email;
    const label = `[${i + 1}/${batch.length}] ${r.fullName} <${to}>`;
    try {
      const info = await sendWithRetry(transporter, {
        from,
        to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      ok++;
      console.log(`✔ ${label}`);
      if (!args.to)
        appendLog({
          email: r.email,
          status: "sent",
          messageId: info.messageId,
        });
    } catch (err) {
      failed++;
      console.log(`✖ ${label} — ${err.message}`);
      if (!args.to)
        appendLog({ email: r.email, status: "failed", error: err.message });
    }
    if (i < batch.length - 1) await sleep(delay);
  }

  transporter.close();
  console.log(`\nDone. Sent: ${ok}  Failed: ${failed}`);
  if (failed)
    console.log(
      "Re-run the same command to retry only the failed/unsent ones.",
    );
  console.log("");
}

main().catch((err) => fail(err.stack || err.message));
