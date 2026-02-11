// pages/cto/BackupSettings.jsx
import React, { useMemo, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Breadcrumbs from "../../breadCrumbs";
import {
  fetchCtoBackups,
  createCtoBackup,
  downloadCtoBackup,
  restoreCtoBackup,
  deleteCtoBackup,
} from "../../../api/backup";
import {
  RotateCcw,
  Plus,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";

/* =========================
   Helpers
========================= */
const getErrMsg = (err, fallback = "Failed") =>
  err?.response?.data?.message || err?.message || fallback;

const toInt = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const fmtBytes = (bytes) => {
  const b = Number(bytes || 0);
  if (!Number.isFinite(b) || b <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(b) / Math.log(1024)),
    units.length - 1,
  );
  const val = b / Math.pow(1024, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const fmtDateTime = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

/* =========================
   UI primitives (match your minimalist style)
========================= */
const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${className}`}
  >
    {children}
  </div>
);

const InlineError = ({ message }) => {
  if (!message) return null;
  return (
    <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700 font-medium">
      {message}
    </div>
  );
};

const ActionPill = ({ children, onClick, disabled, tone = "neutral" }) => {
  const tones = {
    neutral:
      "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50",
    blue: "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100/60",
    red: "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100/60",
    dark: "bg-gray-900 text-white border-gray-900 hover:bg-gray-800",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition whitespace-nowrap",
        tones[tone] || tones.neutral,
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      {children}
    </button>
  );
};

const SkeletonList = () => (
  <div className="p-4 space-y-3 animate-pulse">
    {Array.from({ length: 7 }).map((_, i) => (
      <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="h-4 w-1/2 bg-gray-100 rounded" />
        <div className="mt-2 h-3 w-1/3 bg-gray-100 rounded" />
        <div className="mt-4 flex gap-2 justify-end">
          <div className="h-7 w-20 bg-gray-100 rounded-full" />
          <div className="h-7 w-24 bg-gray-100 rounded-full" />
          <div className="h-7 w-16 bg-gray-100 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = () => (
  <div className="p-6">
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
      <div className="text-sm font-medium text-gray-700">No backups found</div>
      <div className="text-xs text-gray-500 mt-1">
        Create a backup to start building your recovery history.
      </div>
    </div>
  </div>
);

const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  label = "backups",
}) => {
  return (
    <div className="px-4 md:px-6 py-3 border-t border-gray-100 bg-white">
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-30"
          type="button"
        >
          Prev
        </button>

        <div className="text-center min-w-0">
          <div className="text-xs font-mono font-semibold text-gray-700">
            {page} / {totalPages}
          </div>
          <div className="text-[11px] text-gray-500 truncate">
            {total === 0 ? `0 ${label}` : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-30"
          type="button"
        >
          Next
        </button>
      </div>

      <div className="hidden md:flex items-center justify-between gap-4">
        <div className="text-xs text-gray-500 font-medium">
          Showing{" "}
          <span className="font-bold text-gray-900">
            {total === 0 ? 0 : `${startItem}-${endItem}`}
          </span>{" "}
          of <span className="font-bold text-gray-900">{total}</span> {label}
        </div>

        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
          <button
            onClick={onPrev}
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-gray-600"
            type="button"
          >
            Prev
          </button>
          <span className="text-xs font-mono font-medium px-3 text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={onNext}
            disabled={page >= totalPages || total === 0}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-gray-600"
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   Main
========================= */
const pageSizeOptions = [10, 20, 50, 100];

export default function BackupSettings() {
  const queryClient = useQueryClient();

  const fileInputRef = useRef(null);

  const [note, setNote] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [mode, setMode] = useState("replace"); // replace | merge

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [rowBusyIds, setRowBusyIds] = useState(() => new Set());

  const addBusy = (id) =>
    setRowBusyIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const removeBusy = (id) =>
    setRowBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const backupsQuery = useQuery({
    queryKey: ["ctoBackups"],
    queryFn: fetchCtoBackups,
    staleTime: 1000 * 60 * 3,
  });

  const allBackups = useMemo(() => {
    const raw = backupsQuery.data;
    const items = Array.isArray(raw?.data) ? raw.data : [];
    return items;
  }, [backupsQuery.data]);

  const total = allBackups.length;
  const totalPages = Math.max(Math.ceil(total / limit) || 1, 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * limit;
  const items = allBackups.slice(startIndex, startIndex + limit);

  const startItem = total === 0 ? 0 : startIndex + 1;
  const endItem = total === 0 ? 0 : Math.min(startIndex + limit, total);

  const refetch = useCallback(async () => {
    await backupsQuery.refetch();
    toast.info("List refreshed");
  }, [backupsQuery]);

  /* ---------- Mutations ---------- */
  const createMutation = useMutation({
    mutationFn: createCtoBackup,
    onSuccess: async () => {
      setInlineError("");
      setNote("");
      toast.success("Backup created");
      await queryClient.invalidateQueries({ queryKey: ["ctoBackups"] });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to create backup");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreCtoBackup,
    onSuccess: async (data) => {
      setInlineError("");
      setConfirmText("");
      toast.success(
        data?.message || "Restore completed. Please refresh the system.",
      );
      await queryClient.invalidateQueries({ queryKey: ["ctoBackups"] });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Restore failed");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCtoBackup,
    onSuccess: async () => {
      setInlineError("");
      toast.success("Backup deleted");
      await queryClient.invalidateQueries({ queryKey: ["ctoBackups"] });

      // clamp page after deletion
      const nextTotal = Math.max(total - 1, 0);
      const nextPages = Math.max(Math.ceil(nextTotal / limit) || 1, 1);
      setPage((p) => Math.min(p, nextPages));
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to delete backup");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  /* ---------- Actions ---------- */
  const onCreate = (e) => {
    e.preventDefault();
    setInlineError("");
    createMutation.mutate({ note: note.trim() });
  };

  const onPickRestoreFile = () => fileInputRef.current?.click();

  const onRestoreFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow same file re-select
    if (!file) return;

    if (!file.name.endsWith(".gz")) {
      const msg = "Only .gz backups are allowed.";
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    if (confirmText.trim().toLowerCase() !== "restore") {
      const msg = 'Type "restore" in the confirmation field before uploading.';
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    setInlineError("");
    restoreMutation.mutate({ file, mode, confirm: "restore" });
  };

  const onDownload = async (backupId) => {
    try {
      addBusy(backupId);
      await downloadCtoBackup(backupId);
      toast.success("Download started");
    } catch (err) {
      const msg = getErrMsg(err, "Download failed");
      setInlineError(msg);
      toast.error(msg);
    } finally {
      removeBusy(backupId);
    }
  };

  const onDelete = (backup) => {
    const id = backup?.backupId;
    if (!id) return;

    const ok = window.confirm(
      `Delete this backup?\n\n${id}\n\nThis cannot be undone.`,
    );
    if (!ok) return;

    setInlineError("");
    deleteMutation.mutate(id);
  };

  const onLimitChange = (n) => {
    setLimit(n);
    setPage(1);
  };

  const isRefreshing = backupsQuery.isRefetching;
  const canCreate = !createMutation.isPending;
  const canRestore =
    !restoreMutation.isPending &&
    confirmText.trim().toLowerCase() === "restore";

  return (
    <div className="w-full flex-1 flex h-full flex-col bg-gray-50/50">
      <div className="px-1 w-full mx-auto py-2 pb-2">
        <Breadcrumbs items={[{ label: "CTO", to: "/app/cto" }]} />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              Backup & restore
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Create backups, download archived snapshots, or restore from a .gz
              file.
            </p>
          </div>

          <button
            onClick={refetch}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 bg-white border border-gray-200 text-sm font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition disabled:opacity-40"
            type="button"
          >
            <RotateCcw className="w-4 h-4" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Create backup + Restore controls */}
        <Card className="mt-5">
          <div className="p-4 space-y-4">
            <form
              onSubmit={onCreate}
              className="flex flex-col md:flex-row gap-3 md:items-center"
            >
              <div className="flex-1">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note (e.g., before payroll run)"
                  className="w-full h-11 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={!canCreate}
                className={[
                  "inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg text-sm font-bold border transition",
                  canCreate
                    ? "bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed",
                ].join(" ")}
              >
                <Plus className="w-4 h-4" />
                {createMutation.isPending ? "Creating..." : "Create backup"}
              </button>
            </form>

            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div className="leading-relaxed">
                Restoring can overwrite your current data (replace mode). Use
                merge only if your backup is designed for additive restore.
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  >
                    <option value="replace">replace (drop & restore)</option>
                    <option value="merge">merge (no drop)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder='Type "restore" to enable upload'
                    className="w-full h-11 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".gz"
                  onChange={onRestoreFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={onPickRestoreFile}
                  disabled={!canRestore}
                  className={[
                    "inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg text-sm font-bold border transition",
                    canRestore
                      ? "bg-white text-blue-600 border-gray-200 hover:bg-blue-50"
                      : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed",
                  ].join(" ")}
                >
                  <Upload className="w-4 h-4" />
                  {restoreMutation.isPending
                    ? "Restoring..."
                    : "Upload & restore"}
                </button>
              </div>
            </div>

            <InlineError message={inlineError} />
          </div>
        </Card>

        {/* List */}
        <div className="mt-5">
          <Card className="h-[calc(100vh-18rem)] flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Backups</div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Show
                </span>
                <select
                  value={limit}
                  onChange={(e) => onLimitChange(Number(e.target.value))}
                  className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 font-medium outline-none cursor-pointer"
                >
                  {pageSizeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {backupsQuery.isLoading ? (
                <SkeletonList />
              ) : backupsQuery.isError ? (
                <div className="p-6">
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium">
                    {getErrMsg(backupsQuery.error, "Failed to load backups")}
                  </div>
                </div>
              ) : items.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="p-4 space-y-3">
                  {items.map((b) => {
                    const busy = rowBusyIds.has(b.backupId);
                    const deleting = deleteMutation.isPending; // global
                    const createdAt =
                      b?.meta?.createdAt || b?.createdAt || b?.updatedAt;
                    const createdBy = b?.meta?.createdBy || "-";

                    return (
                      <div
                        key={b.backupId}
                        className="rounded-xl border border-gray-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {b.backupId}
                            </div>

                            <div className="mt-1 text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                              <span>{fmtBytes(b.size)}</span>
                              <span>•</span>
                              <span>{fmtDateTime(createdAt)}</span>
                              <span>•</span>
                              <span>
                                downloads {toInt(b.downloadsCount, 0)}
                              </span>
                            </div>

                            {b?.meta?.note ? (
                              <div className="mt-2 text-xs text-gray-600">
                                {b.meta.note}
                              </div>
                            ) : null}

                            <div className="mt-2 text-[11px] text-gray-400">
                              created by {createdBy || "-"}{" "}
                              {b?.meta?.checksum
                                ? `• sha ${b.meta.checksum.slice(0, 10)}…`
                                : ""}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-none">
                            <ActionPill
                              onClick={() => onDownload(b.backupId)}
                              disabled={busy}
                              tone="blue"
                            >
                              <Download className="w-4 h-4" />
                              {busy ? "Starting..." : "Download"}
                            </ActionPill>

                            <ActionPill
                              onClick={() => onDelete(b)}
                              disabled={deleting}
                              tone="neutral"
                            >
                              <Trash2 className="w-4 h-4" />
                              {deleting ? "Deleting..." : "Delete"}
                            </ActionPill>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0">
              <CompactPagination
                page={safePage}
                totalPages={totalPages}
                total={total}
                startItem={startItem}
                endItem={endItem}
                onPrev={() => setPage((p) => Math.max(p - 1, 1))}
                onNext={() => setPage((p) => Math.min(p + 1, totalPages))}
                label="backups"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
