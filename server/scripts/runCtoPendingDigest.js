// scripts/runCtoPendingDigest.js
// Run the pending CTO approvals digest by hand (run from the server folder).
//
//   node scripts/runCtoPendingDigest.js --check     shows which env file and settings it found, then stops
//   node scripts/runCtoPendingDigest.js --dry-run   builds the emails, sends nothing,
//                                                   saves HTML previews to ./cto-digest-previews/
//   node scripts/runCtoPendingDigest.js --force     sends now; does NOT use up today's scheduled run
//   node scripts/runCtoPendingDigest.js             sends now, but counts as today's run
//
// Env files: reads .env.<NODE_ENV> (default .env.development), then .env.local, then .env,
// from the server folder. The first file that sets a value wins.
// Use --env=.env.staging to read one specific file instead.
const fs = require("fs");
const path = require("path");

const SERVER_DIR = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const envArg = args.find((a) => a.startsWith("--env="));

function loadEnvFiles() {
  const mode = process.env.NODE_ENV || "development";
  const names = envArg
    ? [envArg.slice("--env=".length)]
    : [`.env.${mode}.local`, `.env.${mode}`, ".env.local", ".env"];

  let dotenv = null;
  try {
    dotenv = require("dotenv");
  } catch {
    /* not installed: fall back to Node's built-in loader */
  }

  const loaded = [];
  for (const name of names) {
    const file = path.isAbsolute(name) ? name : path.join(SERVER_DIR, name);
    if (!fs.existsSync(file)) {
      if (envArg) throw new Error("Env file not found: " + file);
      continue;
    }
    // Neither loader overrides a value that is already set, so earlier files win
    if (dotenv) dotenv.config({ path: file, quiet: true });
    else if (typeof process.loadEnvFile === "function")
      process.loadEnvFile(file);
    else
      throw new Error(
        "Install dotenv (npm i dotenv) or use Node 20.12+ to read " + name,
      );
    loaded.push(path.basename(file));
  }
  return loaded;
}

const MONGO_KEYS = [
  "MONGO_URI",
  "MONGODB_URI",
  "MONGO_URL",
  "MONGODB_URL",
  "DATABASE_URL",
  "DB_URI",
];

function findMongoUri() {
  const key = MONGO_KEYS.find((k) => process.env[k]);
  if (key) return { key, uri: process.env[key] };

  // Any other variable whose value is a MongoDB connection string
  const byValue = Object.keys(process.env).filter((k) =>
    /^mongodb(\+srv)?:\/\//i.test(String(process.env[k] || "").trim()),
  );
  return byValue.length === 1
    ? { key: byValue[0], uri: process.env[byValue[0]] }
    : null;
}

const mask = (uri) =>
  String(uri).replace(/\/\/([^:/@]+):([^@]+)@/, "//$1:****@");

async function main() {
  const loaded = loadEnvFiles();
  const mongo = findMongoUri();
  const frontendUrl = process.env.FRONTEND_URL || "";

  console.log(
    "Env files loaded :",
    loaded.length ? loaded.join(", ") : "(none found in " + SERVER_DIR + ")",
  );
  console.log(
    "MongoDB          :",
    mongo ? `${mongo.key} = ${mask(mongo.uri)}` : "NOT FOUND",
  );
  console.log(
    "FRONTEND_URL     :",
    frontendUrl || "NOT SET (emails will not be sent without it)",
  );

  if (!mongo) {
    const similar = Object.keys(process.env).filter((k) =>
      /MONGO|(^|_)DB(_|$)|DATABASE/i.test(k),
    );
    throw new Error(
      "No MongoDB connection string found. Looked for: " +
        MONGO_KEYS.join(", ") +
        "." +
        (similar.length
          ? " Found these similar variables: " + similar.join(", ") + "."
          : ""),
    );
  }

  if (flag("--check")) {
    console.log("Check only: nothing was run.");
    return;
  }

  const mongoose = require("mongoose");
  const {
    runCtoPendingDigest,
  } = require("../services/ctoPendingDigest.service");

  const dryRun = flag("--dry-run");
  const force = flag("--force");

  await mongoose.connect(mongo.uri);
  try {
    const stats = await runCtoPendingDigest({ dryRun, force });

    if (dryRun && stats.previews?.length) {
      const outDir = path.join(SERVER_DIR, "cto-digest-previews");
      fs.mkdirSync(outDir, { recursive: true });
      for (const p of stats.previews) {
        fs.writeFileSync(path.join(outDir, p.approverId + ".html"), p.html);
        console.log(
          `${p.to || "(no email)"}  ${p.pending} pending  →  ${p.approverId}.html`,
        );
      }
      console.log("Previews saved to " + outDir);
    } else if (dryRun) {
      console.log(
        "No approvers have pending CTO applications right now, so there is nothing to preview.",
      );
    }

    const { previews, ...summary } = stats;
    console.log(summary);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
