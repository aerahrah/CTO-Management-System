const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  listBackupsController,
  createBackupController,
  downloadBackupController,
  restoreBackupController,
  deleteBackupController,
} = require("../controllers/ctoBackupController.js");

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];

// =============================
// MULTER SETUP (RESTORE)
// =============================
const TMP_DIR =
  process.env.CTO_BACKUP_TMP_DIR ||
  path.join(process.cwd(), "tmp", "cto-restore");

fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: 1024 * 1024 * 500, // 500MB
  },
  fileFilter: (req, file, cb) => {
    // allow .gz / .archive.gz / application/gzip
    const okExt =
      file.originalname.endsWith(".gz") ||
      file.originalname.endsWith(".archive.gz");
    if (!okExt) return cb(new Error("Only .gz backups are allowed"));
    cb(null, true);
  },
});

// =============================
// SYSTEM BACKUPS & RESTORE
// =============================

// List all backups
router.get("/", ...requirePerm("backups.manage"), listBackupsController);

// Create a new backup
router.post("/", ...requirePerm("backups.manage"), createBackupController);

// Download a specific backup file
router.get(
  "/:backupId/download",
  ...requirePerm("backups.manage"),
  downloadBackupController,
);

// Upload and restore a backup file
router.post(
  "/restore",
  ...requirePerm("backups.manage"),
  upload.single("file"),
  restoreBackupController,
);

// Delete a specific backup file
router.delete(
  "/:backupId",
  ...requirePerm("backups.manage"),
  deleteBackupController,
);

module.exports = router;
