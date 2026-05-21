// services/backup.service.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

// --- CONSTANTS & CONFIGURATION ---

const BACKUP_DIR = path.resolve(
  process.cwd(),
  process.env.CTO_BACKUP_DIR || path.join("backups", "cto"),
);

const MONGO_URI = process.env.MONGO_URI || "";
const FORCED_DB_NAME = process.env.CTO_BACKUP_DB_NAME || "";

const ALLOW_RESTORE =
  String(process.env.CTO_ALLOW_RESTORE || "true").toLowerCase() === "true";
const PRE_RESTORE_SAFETY_BACKUP =
  String(process.env.CTO_PRERESTORE_BACKUP || "true").toLowerCase() === "true";

// --- HELPER FUNCTIONS ---

/**
 * Standardizes service-level errors.
 */
function createServiceError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Scrubs sensitive connection strings from child process logs before throwing.
 */
function redactLog(text) {
  if (!text || !MONGO_URI) return text || "";
  // Split and join is a fast way to replace all occurrences without regex escaping issues
  return String(text).split(MONGO_URI).join("[REDACTED_URI]");
}

/**
 * Ensures backup directory exists with strict OS permissions (700 = owner rwx only).
 */
function ensureDirs() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Strictly sanitizes the backup ID to prevent Path Traversal (e.g., "../../etc/passwd").
 * Rejects any character that isn't alphanumeric, an underscore, or a hyphen.
 */
function sanitizeId(id) {
  const clean = String(id || "").trim();
  if (!clean) throw createServiceError("Backup ID is required.", 400);

  // Stripped out '.' to guarantee path traversal is impossible
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw createServiceError("Invalid backup ID format.", 400);
  }
  return clean;
}

/**
 * Generates a collision-resistant, URL-safe backup ID.
 */
function makeBackupId(prefix = "cto") {
  // Replaces colons and dots with hyphens to satisfy the strict sanitizeId regex
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = crypto.randomBytes(3).toString("hex");
  return `${prefix}_${stamp}_${rand}`;
}

/**
 * Executes OS commands safely, bypassing the shell.
 */
function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    // shell: false is CRITICAL to prevent shell injection attacks
    const p = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));

    p.on("error", (spawnError) =>
      reject(new Error(`Failed to start process: ${spawnError.message}`)),
    );

    p.on("close", (code) => {
      if (code === 0) {
        resolve({ out, err });
      } else {
        // Redact URI from output to prevent credential leakage in logs
        const safeOut = redactLog(out);
        const safeErr = redactLog(err);
        reject(
          createServiceError(
            `${cmd} failed (code ${code}): ${safeErr || safeOut}`,
            500,
          ),
        );
      }
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
  const p = metaFilePath(backupId);
  fs.writeFileSync(p, JSON.stringify(meta, null, 2), "utf-8");
  // Restrict read/write to the owner to protect metadata
  fs.chmodSync(p, 0o600);
}

function buildDumpArgs(outPath) {
  if (!MONGO_URI)
    throw createServiceError("Server missing MONGO_URI configuration.", 500);

  const args = [`--uri=${MONGO_URI}`, `--archive=${outPath}`, "--gzip"];
  if (FORCED_DB_NAME) args.push(`--db=${FORCED_DB_NAME}`);
  return args;
}

function buildRestoreArgs(inPath, mode) {
  if (!MONGO_URI)
    throw createServiceError("Server missing MONGO_URI configuration.", 500);

  const args = [`--uri=${MONGO_URI}`, `--archive=${inPath}`, "--gzip"];
  if (mode === "replace") args.push("--drop");
  return args;
}

// --- SERVICE METHODS ---

async function listBackups() {
  ensureDirs();

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".archive.gz"))
    .map((f) => {
      const fullPath = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(fullPath);

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

  // Lock down the database dump permissions (Read/Write for owner only)
  fs.chmodSync(outPath, 0o600);

  const stat = fs.statSync(outPath);
  const checksum = await sha256File(outPath);

  const meta = {
    backupId,
    fileName: path.basename(outPath),
    size: stat.size,
    checksum,
    createdAt: new Date().toISOString(),
    createdBy: userId ? String(userId) : null,
    note: String(note || "").slice(0, 200), // Limit note length to prevent bloat
    dbName: FORCED_DB_NAME || null,
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

  if (!fs.existsSync(filePath)) {
    throw createServiceError("Backup not found.", 404);
  }

  return filePath;
}

async function markBackupDownloaded(backupIdRaw, userId = null) {
  ensureDirs();
  const backupId = sanitizeId(backupIdRaw);
  const filePath = backupFilePath(backupId);

  if (!fs.existsSync(filePath)) {
    throw createServiceError("Backup not found.", 404);
  }

  const meta = readMeta(backupId) || {
    backupId,
    fileName: path.basename(filePath),
    createdAt: new Date().toISOString(),
    downloadsCount: 0,
  };

  meta.downloadsCount = Number(meta.downloadsCount || 0) + 1;
  meta.lastDownloadedAt = new Date().toISOString();
  meta.lastDownloadedBy = userId ? String(userId) : null;

  writeMeta(backupId, meta);
  return meta;
}

async function restoreBackupFromFile({
  filePath,
  mode = "replace",
  userId = null,
} = {}) {
  if (!ALLOW_RESTORE) {
    throw createServiceError(
      "Restore capabilities are disabled by server configuration.",
      403,
    );
  }

  ensureDirs();

  if (!filePath || !fs.existsSync(filePath)) {
    throw createServiceError("Uploaded restore file not found on server.", 404);
  }

  // Double check that it's actually a file, not a directory bypass
  if (!fs.statSync(filePath).isFile()) {
    throw createServiceError("Invalid file provided for restore.", 400);
  }

  const normalizedMode = mode === "merge" ? "merge" : "replace";
  let preRestoreBackupId = null;

  if (PRE_RESTORE_SAFETY_BACKUP) {
    preRestoreBackupId = makeBackupId("cto_prerestore");
    const prePath = backupFilePath(preRestoreBackupId);

    await runCmd("mongodump", buildDumpArgs(prePath));
    fs.chmodSync(prePath, 0o600);

    const stat = fs.statSync(prePath);
    const checksum = await sha256File(prePath);

    const meta = {
      backupId: preRestoreBackupId,
      fileName: path.basename(prePath),
      size: stat.size,
      checksum,
      createdAt: new Date().toISOString(),
      createdBy: userId ? String(userId) : null,
      note: "Auto backup before restore execution",
      dbName: FORCED_DB_NAME || null,
      downloadsCount: 0,
      lastDownloadedAt: null,
      lastDownloadedBy: null,
    };

    writeMeta(preRestoreBackupId, meta);
  }

  // Execute restore
  await runCmd("mongorestore", buildRestoreArgs(filePath, normalizedMode));

  // Secure cleanup of the temporary uploaded file
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (cleanupError) {
    console.error(
      `[WARN] Failed to delete temporary restore file at ${filePath}:`,
      cleanupError,
    );
  }

  return {
    message:
      normalizedMode === "replace"
        ? "Restore completed successfully (replace mode)."
        : "Restore completed successfully (merge mode).",
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
    throw createServiceError("Backup not found.", 404);
  }

  let deletedArchive = false;
  let deletedMeta = false;

  // Use try/catch blocks for discrete file deletions to avoid partial failure stalls
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      deletedArchive = true;
    } catch (e) {
      console.error(`Failed to delete archive ${filePath}:`, e);
    }
  }

  if (fs.existsSync(metaPath)) {
    try {
      fs.unlinkSync(metaPath);
      deletedMeta = true;
    } catch (e) {
      console.error(`Failed to delete metadata ${metaPath}:`, e);
    }
  }

  return {
    message: "Backup processing completed.",
    backupId,
    deletedArchive,
    deletedMeta,
    deletedBy: userId ? String(userId) : null,
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
