const {
  listBackups,
  createBackup,
  getBackupFilePath,
  restoreBackupFromFile,
  markBackupDownloaded,
  deleteBackup,
} = require("../services/ctoBackupService.js");

const getErrMsg = (err, fallback = "Something went wrong") =>
  err?.response?.data?.message || err?.message || fallback;

async function listBackupsController(req, res) {
  try {
    const data = await listBackups();
    return res.json({ ok: true, data });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: getErrMsg(err, "Failed to list backups") });
  }
}

async function createBackupController(req, res) {
  try {
    const note = String(req.body?.note || "").slice(0, 200);
    const userId = req.user?._id || req.user?.id || null;

    const meta = await createBackup({ note, userId });
    return res.json({ ok: true, data: meta });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: getErrMsg(err, "Backup failed") });
  }
}
async function downloadBackupController(req, res) {
  try {
    const backupId = String(req.params.backupId || "");
    const userId = req.user?._id || req.user?.id || null;

    const filePath = await getBackupFilePath(backupId);

    // IMPORTANT: allow frontend to read Content-Disposition header
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    return res.download(filePath, `${backupId}.archive.gz`, (err) => {
      if (!err) {
        markBackupDownloaded(backupId, userId).catch(() => {});
      }
    });
  } catch (err) {
    const msg = getErrMsg(err, "Download failed");
    const status = msg.toLowerCase().includes("not found") ? 404 : 500;
    return res.status(status).json({ ok: false, message: msg });
  }
}

async function restoreBackupController(req, res) {
  const filePath = req.file?.path;

  try {
    const confirm = String(req.body?.confirm || "")
      .trim()
      .toLowerCase();
    const mode = req.body?.mode === "merge" ? "merge" : "replace";
    const userId = req.user?._id || req.user?.id || null;

    if (!filePath) {
      return res
        .status(400)
        .json({ ok: false, message: "No backup file uploaded." });
    }

    if (confirm !== "restore") {
      return res.status(400).json({
        ok: false,
        message: 'Confirmation required. Provide form field confirm="restore".',
      });
    }

    const result = await restoreBackupFromFile({ filePath, mode, userId });
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: getErrMsg(err, "Restore failed") });
  }
}

async function deleteBackupController(req, res) {
  try {
    const backupId = String(req.params.backupId || "");
    const userId = req.user?._id || req.user?.id || null;

    const result = await deleteBackup({ backupId, userId });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const msg = getErrMsg(err, "Delete failed");
    const status = msg.toLowerCase().includes("not found") ? 404 : 500;
    return res.status(status).json({ ok: false, message: msg });
  }
}

module.exports = {
  listBackupsController,
  createBackupController,
  downloadBackupController,
  restoreBackupController,
  deleteBackupController,
};
