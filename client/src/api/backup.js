import API from "./api";

/**
 * LIST backups
 * GET /cto/backups
 */
export const fetchCtoBackups = async () => {
  const res = await API.get("/settings/mongodb", {
    withCredentials: true,
  });
  return res.data; // { ok, data: [...] }
};

/**
 * CREATE backup
 * POST /cto/backups
 * body: { note?: string }
 */
export const createCtoBackup = async ({ note = "" } = {}) => {
  const res = await API.post(
    "/settings/mongodb",
    { note },
    { withCredentials: true },
  );
  return res.data; // { ok, data: meta }
};

/**
 * DOWNLOAD backup
 * GET /cto/backups/:backupId/download
 *
 * IMPORTANT:
 * - This returns a file (gzip), so we use responseType: "blob"
 * - Then we trigger browser download
 */
export const downloadCtoBackup = async (backupId) => {
  if (!backupId) throw new Error("backupId is required");

  const res = await API.get(`/settings/mongodb/${backupId}/download`, {
    responseType: "blob",
  });

  const disposition = res.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="(.+?)"/);
  const filename = match?.[1] || `${backupId}.archive.gz`;

  const url = window.URL.createObjectURL(res.data); // ✅ use blob directly
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);

  return { ok: true, filename };
};

/**
 * RESTORE backup (upload .gz)
 * POST /cto/backups/restore
 * form-data:
 *  - file: File
 *  - confirm: "restore"  (required)
 *  - mode: "replace" | "merge" (optional, default replace)
 */
export const restoreCtoBackup = async ({
  file,
  mode = "replace",
  confirm = "restore",
} = {}) => {
  if (!file) throw new Error("Backup file is required");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("confirm", confirm);
  formData.append("mode", mode);

  const res = await API.post("/settings/mongodb/restore", formData, {
    withCredentials: true,
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data; // { ok, message, mode, preRestoreBackupId? }
};

/**
 * DELETE backup
 * DELETE /cto/backups/:backupId
 */
export const deleteCtoBackup = async (backupId) => {
  if (!backupId) throw new Error("backupId is required");

  const res = await API.delete(`/settings/mongodb/${backupId}`, {
    withCredentials: true,
  });

  return res.data; // { ok, message, ... }
};
