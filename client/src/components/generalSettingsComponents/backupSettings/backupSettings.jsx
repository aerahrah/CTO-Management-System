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
import { useAuth } from "../../../store/authStore";

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

function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

const getErrorStyles = (theme) =>
  theme === "dark"
    ? {
        wrapBg: "rgba(244,63,94,0.12)",
        wrapBorder: "rgba(244,63,94,0.22)",
        wrapText: "#fda4af",
      }
    : {
        wrapBg: "rgba(244,63,94,0.08)",
        wrapBorder: "rgba(244,63,94,0.18)",
        wrapText: "#be123c",
      };

const getActionToneStyles = (theme, tone = "neutral") => {
  const isDark = theme === "dark";

  const tones = {
    neutral: isDark
      ? {
          bg: "var(--app-surface)",
          border: "rgba(255,255,255,0.08)",
          text: "var(--app-text)",
        }
      : {
          bg: "#ffffff",
          border: "rgba(15,23,42,0.10)",
          text: "#475569",
        },
    blue: isDark
      ? {
          bg: "rgba(59,130,246,0.12)",
          border: "rgba(59,130,246,0.18)",
          text: "#93c5fd",
        }
      : {
          bg: "rgba(59,130,246,0.08)",
          border: "rgba(59,130,246,0.16)",
          text: "#1d4ed8",
        },
    red: isDark
      ? {
          bg: "rgba(244,63,94,0.12)",
          border: "rgba(244,63,94,0.18)",
          text: "#fda4af",
        }
      : {
          bg: "rgba(244,63,94,0.08)",
          border: "rgba(244,63,94,0.16)",
          text: "#be123c",
        },
    dark: isDark
      ? {
          bg: "#ffffff",
          border: "#ffffff",
          text: "#111827",
        }
      : {
          bg: "#111827",
          border: "#111827",
          text: "#ffffff",
        },
  };

  return tones[tone] || tones.neutral;
};

/* =========================
   UI primitives
========================= */
const Card = ({ children, className = "", borderColor }) => (
  <div
    className={`rounded-xl shadow-sm overflow-hidden transition-colors duration-300 ease-out ${className}`}
    style={{
      backgroundColor: "var(--app-surface)",
      border: `1px solid ${borderColor}`,
    }}
  >
    {children}
  </div>
);

const InlineError = ({ message, theme }) => {
  if (!message) return null;

  const s = getErrorStyles(theme);

  return (
    <div
      className="mt-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-300 ease-out"
      style={{
        backgroundColor: s.wrapBg,
        border: `1px solid ${s.wrapBorder}`,
        color: s.wrapText,
      }}
    >
      {message}
    </div>
  );
};

const ActionPill = ({
  children,
  onClick,
  disabled,
  tone = "neutral",
  theme,
}) => {
  const t = getActionToneStyles(theme, tone);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out whitespace-nowrap"
      style={{
        backgroundColor: t.bg,
        color: t.text,
        border: `1px solid ${t.border}`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
};

const SkeletonList = ({ theme, borderColor }) => (
  <div className="p-4 space-y-3">
    {Array.from({ length: 7 }).map((_, i) => (
      <div
        key={i}
        className="rounded-xl p-4 transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface)",
          border: `1px solid ${borderColor}`,
        }}
      >
        <div
          className="h-4 w-1/2 rounded animate-pulse"
          style={{
            backgroundColor:
              theme === "dark"
                ? "rgba(255,255,255,0.06)"
                : "rgba(15,23,42,0.06)",
          }}
        />
        <div
          className="mt-2 h-3 w-1/3 rounded animate-pulse"
          style={{
            backgroundColor:
              theme === "dark"
                ? "rgba(255,255,255,0.06)"
                : "rgba(15,23,42,0.06)",
          }}
        />
        <div className="mt-4 flex gap-2 justify-end">
          {[80, 96, 64].map((w, idx) => (
            <div
              key={idx}
              className="h-7 rounded-full animate-pulse"
              style={{
                width: `${w}px`,
                backgroundColor:
                  theme === "dark"
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(15,23,42,0.06)",
              }}
            />
          ))}
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ borderColor, subtleBg }) => (
  <div className="p-6">
    <div
      className="rounded-xl px-4 py-8 text-center transition-colors duration-300 ease-out"
      style={{
        backgroundColor: subtleBg,
        border: `1px dashed ${borderColor}`,
      }}
    >
      <div
        className="text-sm font-medium transition-colors duration-300 ease-out"
        style={{ color: "var(--app-text)" }}
      >
        No backups found
      </div>
      <div
        className="text-xs mt-1 transition-colors duration-300 ease-out"
        style={{ color: "var(--app-muted)" }}
      >
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
  borderColor,
  subtleBg,
}) => {
  return (
    <div
      className="px-4 md:px-6 py-3 border-t transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor,
      }}
    >
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            border: `1px solid ${borderColor}`,
            color: "var(--app-text)",
          }}
          type="button"
        >
          Prev
        </button>

        <div className="text-center min-w-0">
          <div
            className="text-xs font-mono font-semibold transition-colors duration-300 ease-out"
            style={{ color: "var(--app-text)" }}
          >
            {page} / {totalPages}
          </div>
          <div
            className="text-[11px] truncate transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {total === 0 ? `0 ${label}` : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            border: `1px solid ${borderColor}`,
            color: "var(--app-text)",
          }}
          type="button"
        >
          Next
        </button>
      </div>

      <div className="hidden md:flex items-center justify-between gap-4">
        <div
          className="text-xs font-medium transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          Showing{" "}
          <span className="font-bold" style={{ color: "var(--app-text)" }}>
            {total === 0 ? 0 : `${startItem}-${endItem}`}
          </span>{" "}
          of{" "}
          <span className="font-bold" style={{ color: "var(--app-text)" }}>
            {total}
          </span>{" "}
          {label}
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-lg transition-colors duration-300 ease-out"
          style={{
            backgroundColor: subtleBg,
            border: `1px solid ${borderColor}`,
          }}
        >
          <button
            onClick={onPrev}
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
            type="button"
          >
            Prev
          </button>
          <span
            className="text-xs font-mono font-medium px-3 transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {page} / {totalPages}
          </span>
          <button
            onClick={onNext}
            disabled={page >= totalPages || total === 0}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
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

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const subtleBg = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.03)"
      : "rgba(15,23,42,0.03)";
  }, [resolvedTheme]);

  const inputBg = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.04)"
      : "rgba(15,23,42,0.03)";
  }, [resolvedTheme]);

  const disabledBg = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.05)"
      : "rgba(15,23,42,0.04)";
  }, [resolvedTheme]);

  const warningStyles = useMemo(() => {
    return resolvedTheme === "dark"
      ? {
          bg: "rgba(245,158,11,0.12)",
          border: "rgba(245,158,11,0.20)",
          text: "#fcd34d",
          icon: "#fbbf24",
        }
      : {
          bg: "rgba(245,158,11,0.08)",
          border: "rgba(245,158,11,0.16)",
          text: "#b45309",
          icon: "#d97706",
        };
  }, [resolvedTheme]);

  const [note, setNote] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [mode, setMode] = useState("replace");

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
    e.target.value = "";
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
    <div
      className="w-full flex-1 flex h-full flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="px-1 w-full mx-auto py-2 pb-2">
        <Breadcrumbs items={[{ label: "CTO", to: "/app/cto" }]} />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              Backup & restore
            </h1>
            <p
              className="text-sm mt-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Create backups, download archived snapshots, or restore from a .gz
              file.
            </p>
          </div>

          <button
            onClick={refetch}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-colors duration-200 ease-out disabled:opacity-40"
            style={{
              backgroundColor: "var(--app-surface)",
              border: `1px solid ${borderColor}`,
              color: "var(--accent)",
            }}
            type="button"
          >
            <RotateCcw className="w-4 h-4" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <Card borderColor={borderColor} className="mt-5">
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
                  className="w-full h-11 rounded-lg px-3 text-sm outline-none transition-colors duration-200 ease-out"
                  style={{
                    backgroundColor: inputBg,
                    border: `1px solid ${borderColor}`,
                    color: "var(--app-text)",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={!canCreate}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg text-sm font-bold transition-colors duration-200 ease-out"
                style={{
                  backgroundColor: canCreate ? "var(--accent)" : disabledBg,
                  color: canCreate ? "#ffffff" : "var(--app-muted)",
                  border: `1px solid ${canCreate ? "var(--accent)" : borderColor}`,
                  cursor: canCreate ? "pointer" : "not-allowed",
                }}
              >
                <Plus className="w-4 h-4" />
                {createMutation.isPending ? "Creating..." : "Create backup"}
              </button>
            </form>

            <div
              className="rounded-xl px-3 py-2 text-xs flex items-start gap-2 transition-colors duration-300 ease-out"
              style={{
                backgroundColor: warningStyles.bg,
                border: `1px solid ${warningStyles.border}`,
                color: warningStyles.text,
              }}
            >
              <AlertTriangle
                className="w-4 h-4 mt-0.5"
                style={{ color: warningStyles.icon }}
              />
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
                    className="w-full h-11 rounded-lg px-3 text-sm outline-none transition-colors duration-200 ease-out"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      border: `1px solid ${borderColor}`,
                      color: "var(--app-text)",
                    }}
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
                    className="w-full h-11 rounded-lg px-3 text-sm outline-none transition-colors duration-200 ease-out"
                    style={{
                      backgroundColor: inputBg,
                      border: `1px solid ${borderColor}`,
                      color: "var(--app-text)",
                    }}
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
                  className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg text-sm font-bold transition-colors duration-200 ease-out"
                  style={{
                    backgroundColor: canRestore
                      ? "var(--app-surface)"
                      : disabledBg,
                    color: canRestore ? "var(--accent)" : "var(--app-muted)",
                    border: `1px solid ${borderColor}`,
                    cursor: canRestore ? "pointer" : "not-allowed",
                  }}
                >
                  <Upload className="w-4 h-4" />
                  {restoreMutation.isPending
                    ? "Restoring..."
                    : "Upload & restore"}
                </button>
              </div>
            </div>

            <InlineError message={inlineError} theme={resolvedTheme} />
          </div>
        </Card>

        <div className="mt-5">
          <Card
            borderColor={borderColor}
            className="h-[calc(100vh-18rem)] flex flex-col"
          >
            <div
              className="px-4 py-3 border-b flex items-center justify-between transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor,
              }}
            >
              <div
                className="text-sm font-semibold transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                Backups
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Show
                </span>
                <select
                  value={limit}
                  onChange={(e) => onLimitChange(Number(e.target.value))}
                  className="text-xs rounded-lg block p-1.5 font-medium outline-none cursor-pointer transition-colors duration-200 ease-out"
                  style={{
                    backgroundColor: inputBg,
                    border: `1px solid ${borderColor}`,
                    color: "var(--app-text)",
                  }}
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
                <SkeletonList theme={resolvedTheme} borderColor={borderColor} />
              ) : backupsQuery.isError ? (
                <div className="p-6">
                  <div
                    className="rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: getErrorStyles(resolvedTheme).wrapBg,
                      border: `1px solid ${
                        getErrorStyles(resolvedTheme).wrapBorder
                      }`,
                      color: getErrorStyles(resolvedTheme).wrapText,
                    }}
                  >
                    {getErrMsg(backupsQuery.error, "Failed to load backups")}
                  </div>
                </div>
              ) : items.length === 0 ? (
                <EmptyState borderColor={borderColor} subtleBg={subtleBg} />
              ) : (
                <div className="p-4 space-y-3">
                  {items.map((b) => {
                    const busy = rowBusyIds.has(b.backupId);
                    const deleting = deleteMutation.isPending;
                    const createdAt =
                      b?.meta?.createdAt || b?.createdAt || b?.updatedAt;
                    const createdBy = b?.meta?.createdBy || "-";

                    return (
                      <div
                        key={b.backupId}
                        className="rounded-xl p-4 transition-colors duration-300 ease-out"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          border: `1px solid ${borderColor}`,
                          boxShadow:
                            resolvedTheme === "dark"
                              ? "0 1px 0 rgba(255,255,255,0.03)"
                              : "0 1px 0 rgba(0,0,0,0.02)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div
                              className="text-sm font-semibold truncate transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-text)" }}
                            >
                              {b.backupId}
                            </div>

                            <div
                              className="mt-1 text-[11px] flex flex-wrap gap-x-3 gap-y-1 transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-muted)" }}
                            >
                              <span>{fmtBytes(b.size)}</span>
                              <span>•</span>
                              <span>{fmtDateTime(createdAt)}</span>
                              <span>•</span>
                              <span>
                                downloads {toInt(b.downloadsCount, 0)}
                              </span>
                            </div>

                            {b?.meta?.note ? (
                              <div
                                className="mt-2 text-xs transition-colors duration-300 ease-out"
                                style={{ color: "var(--app-text)" }}
                              >
                                {b.meta.note}
                              </div>
                            ) : null}

                            <div
                              className="mt-2 text-[11px] transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-muted)" }}
                            >
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
                              theme={resolvedTheme}
                            >
                              <Download className="w-4 h-4" />
                              {busy ? "Starting..." : "Download"}
                            </ActionPill>

                            <ActionPill
                              onClick={() => onDelete(b)}
                              disabled={deleting}
                              tone="neutral"
                              theme={resolvedTheme}
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
                borderColor={borderColor}
                subtleBg={subtleBg}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
