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
  authorizeRoles,
} = require("../middlewares/authMiddleware");

const router = express.Router();

const TMP_DIR =
  process.env.CTO_BACKUP_TMP_DIR ||
  path.join(process.cwd(), "tmp", "cto-restore");

fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: 1024 * 1024 * 500, // 500MB (adjust)
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

router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  listBackupsController,
);

router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  createBackupController,
);

router.get(
  "/:backupId/download",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  downloadBackupController,
);

router.post(
  "/restore",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  upload.single("file"),
  restoreBackupController,
);

// optional
router.delete(
  "/:backupId",
  authenticateToken,
  authorizeRoles("admin", "hr"),
  deleteBackupController,
);

module.exports = router;
