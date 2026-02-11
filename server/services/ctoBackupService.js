const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const BACKUP_DIR = path.resolve(
  process.cwd(),
  process.env.CTO_BACKUP_DIR || path.join("backups", "cto"),
);

const mongoUri = process.env.MONGO_URI;
const forcedDbName = process.env.CTO_BACKUP_DB_NAME || "";

const allowRestore =
  String(process.env.CTO_ALLOW_RESTORE || "true").toLowerCase() === "true";

const preRestoreSafetyBackup =
  String(process.env.CTO_PRERESTORE_BACKUP || "true").toLowerCase() === "true";

/* =========================
   Helpers
========================= */
function ensureDirs() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function sanitizeId(id) {
  const clean = String(id || "").trim();
  if (!clean) throw new Error("Backup not found");
  if (!/^[a-zA-Z0-9._-]+$/.test(clean)) throw new Error("Invalid backup id");
  return clean;
}

function makeBackupId(prefix = "cto") {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = crypto.randomBytes(3).toString("hex");
  return `${prefix}_${stamp}_${rand}`;
}

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));

    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve({ out, err });
      else reject(new Error(`${cmd} failed (code ${code}): ${err || out}`));
    });
  });
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const s = fs.createReadStream(filePath);
    s.on("error", reject);
    s.on("data", (chunk) => hash.update(chunk));
    s.on("end", () => resolve(hash.digest("hex")));
  });
}

function backupFilePath(backupId) {
  return path.join(BACKUP_DIR, `${backupId}.archive.gz`);
}

function metaFilePath(backupId) {
  return path.join(BACKUP_DIR, `${backupId}.meta.json`);
}

function readMeta(backupId) {
  const p = metaFilePath(backupId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function writeMeta(backupId, meta) {
  fs.writeFileSync(
    metaFilePath(backupId),
    JSON.stringify(meta, null, 2),
    "utf-8",
  );
}

function buildDumpArgs(outPath) {
  if (!mongoUri) throw new Error("Server missing MONGO_URI");

  const args = [`--uri=${mongoUri}`, `--archive=${outPath}`, "--gzip"];
  if (forcedDbName) args.push(`--db=${forcedDbName}`);
  return args;
}

function buildRestoreArgs(inPath, mode) {
  if (!mongoUri) throw new Error("Server missing MONGO_URI");

  const args = [`--uri=${mongoUri}`, `--archive=${inPath}`, "--gzip"];

  // Note: nsFrom/nsTo is typically for rename; safe to omit unless you really need it.
  if (mode === "replace") args.push("--drop");

  return args;
}

/* =========================
   Public
========================= */
async function listBackups() {
  ensureDirs();

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".archive.gz"))
    .map((f) => {
      const full = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(full);

      const backupId = f.replace(/\.archive\.gz$/, "");
      const meta = readMeta(backupId);

      return {
        backupId,
        file: f,
        size: stat.size,
        createdAt: stat.birthtime || stat.ctime,
        updatedAt: stat.mtime,
        downloadsCount: meta?.downloadsCount || 0,
        lastDownloadedAt: meta?.lastDownloadedAt || null,
        lastDownloadedBy: meta?.lastDownloadedBy || null,
        meta,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return files;
}

async function createBackup({ note = "", userId = null } = {}) {
  ensureDirs();

  const backupId = makeBackupId("cto");
  const outPath = backupFilePath(backupId);

  await runCmd("mongodump", buildDumpArgs(outPath));

  const stat = fs.statSync(outPath);
  const checksum = await sha256File(outPath);

  const meta = {
    backupId,
    fileName: path.basename(outPath),
    size: stat.size,
    checksum,
    createdAt: new Date().toISOString(),
    createdBy: userId,
    note: String(note || "").slice(0, 200),
    dbName: forcedDbName || null,
    downloadsCount: 0,
    lastDownloadedAt: null,
    lastDownloadedBy: null,
  };

  writeMeta(backupId, meta);
  return meta;
}

async function getBackupFilePath(backupIdRaw) {
  ensureDirs();
  const backupId = sanitizeId(backupIdRaw);
  const filePath = backupFilePath(backupId);

  if (!fs.existsSync(filePath)) throw new Error("Backup not found");
  return filePath;
}

async function markBackupDownloaded(backupIdRaw, userId = null) {
  ensureDirs();
  const backupId = sanitizeId(backupIdRaw);

  const filePath = backupFilePath(backupId);
  if (!fs.existsSync(filePath)) throw new Error("Backup not found");

  const meta = readMeta(backupId) || {
    backupId,
    fileName: path.basename(filePath),
    createdAt: new Date().toISOString(),
    downloadsCount: 0,
  };

  meta.downloadsCount = Number(meta.downloadsCount || 0) + 1;
  meta.lastDownloadedAt = new Date().toISOString();
  meta.lastDownloadedBy = userId;

  writeMeta(backupId, meta);
  return meta;
}

async function restoreBackupFromFile({
  filePath,
  mode = "replace",
  userId = null,
} = {}) {
  if (!allowRestore) {
    throw new Error("Restore is disabled by server configuration.");
  }

  ensureDirs();

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Uploaded file not found on server.");
  }

  const normalizedMode = mode === "merge" ? "merge" : "replace";

  let preRestoreBackupId = null;

  if (preRestoreSafetyBackup) {
    preRestoreBackupId = makeBackupId("cto_prerestore");
    const prePath = backupFilePath(preRestoreBackupId);

    await runCmd("mongodump", buildDumpArgs(prePath));

    const stat = fs.statSync(prePath);
    const checksum = await sha256File(prePath);

    const meta = {
      backupId: preRestoreBackupId,
      fileName: path.basename(prePath),
      size: stat.size,
      checksum,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      note: "Auto backup before restore",
      dbName: forcedDbName || null,
      downloadsCount: 0,
      lastDownloadedAt: null,
      lastDownloadedBy: null,
    };

    writeMeta(preRestoreBackupId, meta);
  }

  await runCmd("mongorestore", buildRestoreArgs(filePath, normalizedMode));

  // cleanup uploaded restore file only
  try {
    fs.unlinkSync(filePath);
  } catch {}

  return {
    message:
      normalizedMode === "replace"
        ? "Restore completed (replace mode)."
        : "Restore completed (merge mode).",
    mode: normalizedMode,
    preRestoreBackupId,
  };
}

async function deleteBackup({ backupId: backupIdRaw, userId = null } = {}) {
  ensureDirs();
  const backupId = sanitizeId(backupIdRaw);

  const filePath = backupFilePath(backupId);
  const metaPath = metaFilePath(backupId);

  if (!fs.existsSync(filePath) && !fs.existsSync(metaPath)) {
    throw new Error("Backup not found");
  }

  let deletedArchive = false;
  let deletedMeta = false;

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    deletedArchive = true;
  }

  if (fs.existsSync(metaPath)) {
    fs.unlinkSync(metaPath);
    deletedMeta = true;
  }

  return {
    message: "Backup deleted",
    backupId,
    deletedArchive,
    deletedMeta,
    deletedBy: userId,
  };
}

module.exports = {
  listBackups,
  createBackup,
  getBackupFilePath,
  restoreBackupFromFile,
  markBackupDownloaded,
  deleteBackup,
};
