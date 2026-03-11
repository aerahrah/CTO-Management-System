import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Breadcrumbs from "../../breadCrumbs";
import {
  fetchAllProjects,
  createProject,
  updateProject,
  updateProjectStatus,
  deleteProject,
} from "../../../api/project";
import { RotateCcw, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import FilterSelect from "../../filterSelect";
import { toast } from "react-toastify";
import { useAuth } from "../../../store/authStore";

const pageSizeOptions = [20, 50, 100];
const qk = (status, page, limit) => ["projects", status, page, limit];

/* ------------------ helpers ------------------ */
const toInt = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const normalizeListResponse = (raw, fallbackPage, fallbackLimit) => {
  const items = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.projects)
        ? raw.projects
        : [];

  const total = toInt(
    raw?.total ?? raw?.count ?? raw?.totalCount ?? items.length,
    items.length,
  );

  const pagesRaw =
    raw?.pages ?? raw?.totalPages ?? Math.ceil(total / (fallbackLimit || 20));
  const pages = Math.max(toInt(pagesRaw, 1), 1);

  const page = Math.max(toInt(raw?.page, fallbackPage), 1);
  const limit = Math.max(toInt(raw?.limit, fallbackLimit), 1);

  return { items, total, pages, page, limit };
};

const getErrMsg = (err, fallback = "Failed") =>
  err?.response?.data?.message || err?.message || fallback;

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
    green: isDark
      ? {
          bg: "rgba(34,197,94,0.12)",
          border: "rgba(34,197,94,0.18)",
          text: "#86efac",
        }
      : {
          bg: "rgba(34,197,94,0.08)",
          border: "rgba(34,197,94,0.16)",
          text: "#15803d",
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

/* ------------------ UI ------------------ */
const Card = ({ children, className = "", borderColor }) => (
  <div
    className={`rounded-xl shadow-sm transition-colors duration-300 ease-out ${className}`}
    style={{
      backgroundColor: "var(--app-surface)",
      border: `1px solid ${borderColor}`,
    }}
  >
    {children}
  </div>
);

const CountPill = ({ value, borderColor, subtleBg }) => (
  <span
    className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-[11px] font-medium transition-colors duration-300 ease-out"
    style={{
      backgroundColor: subtleBg,
      color: "var(--app-text)",
      border: `1px solid ${borderColor}`,
    }}
  >
    {value}
  </span>
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
        No items found
      </div>
      <div
        className="text-xs mt-1 transition-colors duration-300 ease-out"
        style={{ color: "var(--app-muted)" }}
      >
        Add a new project above or refresh the list.
      </div>
    </div>
  </div>
);

const SkeletonList = ({ theme, borderColor }) => (
  <div className="p-4 space-y-3">
    {Array.from({ length: 6 }).map((_, i) => (
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
          {[16, 24, 16].map((w, idx) => (
            <div
              key={idx}
              className="h-7 rounded-full animate-pulse"
              style={{
                width: `${w * 4}px`,
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

const ActionPill = ({
  children,
  onClick,
  disabled,
  tone = "neutral",
  type = "button",
  theme,
}) => {
  const t = getActionToneStyles(theme, tone);

  return (
    <button
      type={type}
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

const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
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
          <ChevronLeft className="w-4 h-4" />
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
            {total === 0 ? "0 results" : `${startItem}-${endItem} of ${total}`}
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
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="hidden md:flex flex-col md:flex-row items-center justify-between gap-4">
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
          projects
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
            <ChevronLeft className="w-4 h-4" />
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
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

function StatusCard({
  title,
  count,
  loading,
  items,
  editingId,
  editingName,
  setEditingName,
  onStartRename,
  onCancelRename,
  onSubmitRename,
  onToggleStatus,
  onDelete,
  actionLabel,
  actionTone,
  statusBusyIds,
  deleteBusyIds,
  renameBusyIds,
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  theme,
  borderColor,
  subtleBg,
  inputBg,
}) {
  return (
    <Card
      borderColor={borderColor}
      className="h-[calc(100vh-16rem)] flex flex-col overflow-hidden"
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
          {title}
        </div>
        <CountPill
          value={count}
          borderColor={borderColor}
          subtleBg={subtleBg}
        />
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <SkeletonList theme={theme} borderColor={borderColor} />
        ) : items.length === 0 ? (
          <EmptyState borderColor={borderColor} subtleBg={subtleBg} />
        ) : (
          <div className="p-4 space-y-3">
            {items.map((p) => {
              const isEditing = editingId === p._id;
              const isStatusBusy = statusBusyIds?.has(p._id);
              const isDeleteBusy = deleteBusyIds?.has(p._id);
              const isRenameBusy = renameBusyIds?.has(p._id);
              const rowBusy = isStatusBusy || isDeleteBusy || isRenameBusy;

              return (
                <div
                  key={p._id}
                  className="rounded-xl p-4 transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    border: `1px solid ${borderColor}`,
                    boxShadow:
                      theme === "dark"
                        ? "0 1px 0 rgba(255,255,255,0.03)"
                        : "0 1px 0 rgba(0,0,0,0.02)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onSubmitRename(p._id);
                            if (e.key === "Escape") onCancelRename();
                          }}
                          autoFocus
                          className="w-full h-10 rounded-lg px-3 text-sm outline-none transition-colors duration-200 ease-out"
                          style={{
                            backgroundColor: inputBg,
                            border: `1px solid ${borderColor}`,
                            color: "var(--app-text)",
                          }}
                        />
                      ) : (
                        <div
                          className="text-sm font-semibold truncate transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-text)" }}
                        >
                          {p.name}
                        </div>
                      )}

                      <div
                        className="mt-1 text-[11px] transition-colors duration-300 ease-out"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Status:{" "}
                        <span
                          className="font-medium"
                          style={{ color: "var(--app-text)" }}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-none">
                      {isEditing ? (
                        <>
                          <ActionPill
                            onClick={() => onSubmitRename(p._id)}
                            disabled={isRenameBusy}
                            tone="dark"
                            theme={theme}
                          >
                            {isRenameBusy ? "Saving..." : "Save"}
                          </ActionPill>
                          <ActionPill
                            onClick={onCancelRename}
                            disabled={isRenameBusy}
                            tone="neutral"
                            theme={theme}
                          >
                            Cancel
                          </ActionPill>
                        </>
                      ) : (
                        <>
                          <ActionPill
                            onClick={() => onStartRename(p)}
                            disabled={rowBusy}
                            tone="blue"
                            theme={theme}
                          >
                            Rename
                          </ActionPill>

                          <ActionPill
                            onClick={() => onToggleStatus(p)}
                            disabled={isStatusBusy || isDeleteBusy}
                            tone={actionTone}
                            theme={theme}
                          >
                            {isStatusBusy ? "Updating..." : actionLabel}
                          </ActionPill>

                          <ActionPill
                            onClick={() => onDelete(p)}
                            disabled={isDeleteBusy || isStatusBusy}
                            tone="neutral"
                            theme={theme}
                          >
                            {isDeleteBusy ? "Deleting..." : "Delete"}
                          </ActionPill>
                        </>
                      )}
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
          page={page}
          totalPages={totalPages}
          total={total}
          startItem={startItem}
          endItem={endItem}
          onPrev={onPrev}
          onNext={onNext}
          borderColor={borderColor}
          subtleBg={subtleBg}
        />
      </div>
    </Card>
  );
}

export default function ProjectSettings() {
  const queryClient = useQueryClient();

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

  const [limit, setLimit] = useState(20);
  const [activePage, setActivePage] = useState(1);
  const [inactivePage, setInactivePage] = useState(1);

  const [newName, setNewName] = useState("");
  const [inlineError, setInlineError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const [statusBusyIds, setStatusBusyIds] = useState(() => new Set());
  const [deleteBusyIds, setDeleteBusyIds] = useState(() => new Set());
  const [renameBusyIds, setRenameBusyIds] = useState(() => new Set());

  const addBusy = (setFn, id) =>
    setFn((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const removeBusy = (setFn, id) =>
    setFn((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const activeQuery = useQuery({
    queryKey: qk("Active", activePage, limit),
    queryFn: () =>
      fetchAllProjects({ status: "Active", page: activePage, limit }),
    placeholderData: (prev) => prev,
    select: (raw) => normalizeListResponse(raw, activePage, limit),
  });

  const inactiveQuery = useQuery({
    queryKey: qk("Inactive", inactivePage, limit),
    queryFn: () =>
      fetchAllProjects({ status: "Inactive", page: inactivePage, limit }),
    placeholderData: (prev) => prev,
    select: (raw) => normalizeListResponse(raw, inactivePage, limit),
  });

  const activeItems = activeQuery.data?.items ?? [];
  const inactiveItems = inactiveQuery.data?.items ?? [];

  const activeTotal = activeQuery.data?.total ?? 0;
  const inactiveTotal = inactiveQuery.data?.total ?? 0;

  const activePages = activeQuery.data?.pages ?? 1;
  const inactivePages = inactiveQuery.data?.pages ?? 1;

  useEffect(() => {
    if (activePage > activePages) setActivePage(activePages);
    if (activePage < 1) setActivePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePages]);

  useEffect(() => {
    if (inactivePage > inactivePages) setInactivePage(inactivePages);
    if (inactivePage < 1) setInactivePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inactivePages]);

  const refetchBoth = useCallback(async () => {
    await Promise.all([activeQuery.refetch(), inactiveQuery.refetch()]);
    toast.info("List refreshed");
  }, [activeQuery, inactiveQuery]);

  const isRefreshing = activeQuery.isRefetching || inactiveQuery.isRefetching;

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async (_data, vars) => {
      setNewName("");
      setInlineError("");
      toast.success(`Added "${vars?.name}"`);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to add project");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, payload }) => updateProject(id, payload),
    onMutate: ({ id }) => addBusy(setRenameBusyIds, id),
    onSettled: (_d, _e, vars) =>
      vars?.id && removeBusy(setRenameBusyIds, vars.id),
    onSuccess: async (_data, vars) => {
      setEditingId(null);
      setEditingName("");
      setInlineError("");
      toast.success(`Renamed to "${vars?.payload?.name}"`);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to rename project");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateProjectStatus(id, status),
    onMutate: ({ id }) => addBusy(setStatusBusyIds, id),
    onSettled: (_d, _e, vars) =>
      vars?.id && removeBusy(setStatusBusyIds, vars.id),
    onSuccess: async (_data, vars) => {
      setInlineError("");
      toast.success(`Set to ${vars?.status}`);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to update status");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteProject(id),
    onMutate: (id) => addBusy(setDeleteBusyIds, id),
    onSettled: (_d, _e, id) => id && removeBusy(setDeleteBusyIds, id),
    onSuccess: async () => {
      setInlineError("");
      toast.success("Deleted project");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to delete project");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const onCreate = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      const msg = "Project name is required.";
      setInlineError(msg);
      toast.error(msg);
      return;
    }
    setInlineError("");
    createMutation.mutate({ name, status: "Active" });
  };

  const startRename = (p) => {
    setInlineError("");
    setEditingId(p._id);
    setEditingName(p.name || "");
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  const submitRename = (id) => {
    const name = editingName.trim();
    if (!name) {
      const msg = "Name cannot be empty.";
      setInlineError(msg);
      toast.error(msg);
      return;
    }
    renameMutation.mutate({ id, payload: { name } });
  };

  const toggleStatus = (p) => {
    const next = p.status === "Active" ? "Inactive" : "Active";
    statusMutation.mutate({ id: p._id, status: next });
  };

  const onDelete = (p) => {
    if (!window.confirm(`Delete project "${p.name}"?`)) return;
    deleteMutation.mutate(p._id);
  };

  const onLimitChange = (n) => {
    setLimit(n);
    setActivePage(1);
    setInactivePage(1);
  };

  const canCreate = useMemo(
    () => newName.trim().length > 0 && !createMutation.isPending,
    [newName, createMutation.isPending],
  );

  const activeTotalPages = Math.max(activePages, 1);
  const inactiveTotalPages = Math.max(inactivePages, 1);

  const activeStartItem = activeTotal === 0 ? 0 : (activePage - 1) * limit + 1;
  const activeEndItem =
    activeTotal === 0 ? 0 : Math.min(activePage * limit, activeTotal);

  const inactiveStartItem =
    inactiveTotal === 0 ? 0 : (inactivePage - 1) * limit + 1;
  const inactiveEndItem =
    inactiveTotal === 0 ? 0 : Math.min(inactivePage * limit, inactiveTotal);

  return (
    <div
      className="w-full flex-1 flex h-full flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="px-1 w-full mx-auto py-2 pb-2">
        <Breadcrumbs
          items={[{ label: "USER MANAGEMENT", to: "/app/user-management" }]}
        />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              Office <span className="font-bold">Projects</span>
            </h1>
            <p
              className="text-sm mt-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Manage project options used in registration and storage.
            </p>
          </div>

          <button
            onClick={refetchBoth}
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
          <div className="p-4">
            <form
              onSubmit={onCreate}
              className="flex flex-col md:flex-row gap-3 md:items-center"
            >
              <div className="flex-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Add new project"
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
                {createMutation.isPending ? "Adding..." : "Add project"}
              </button>
            </form>

            <div
              className="mt-2 text-xs transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Tip: You can deactivate a project instead of deleting it.
            </div>

            <InlineError message={inlineError} theme={resolvedTheme} />

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="hidden md:flex items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Show
                </span>
                <select
                  value={limit}
                  onChange={(e) => {
                    onLimitChange(Number(e.target.value));
                  }}
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

              <div className="md:hidden flex items-center gap-1.5">
                <span
                  className="text-xs font-medium uppercase tracking-wider transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Rows
                </span>
                <FilterSelect
                  label=""
                  value={limit}
                  onChange={(v) => onLimitChange(v)}
                  options={pageSizeOptions}
                  className="!mb-0 w-20 text-xs"
                />
              </div>

              <div className="hidden md:flex items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Quick
                </span>
                {pageSizeOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onLimitChange(n)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 ease-out"
                    style={{
                      backgroundColor:
                        limit === n
                          ? "var(--accent-soft)"
                          : "var(--app-surface)",
                      color: limit === n ? "var(--accent)" : "var(--app-text)",
                      border: `1px solid ${
                        limit === n ? "var(--accent-soft2)" : borderColor
                      }`,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <StatusCard
              title="Active projects"
              count={activeTotal}
              loading={activeQuery.isLoading}
              items={activeItems}
              editingId={editingId}
              editingName={editingName}
              setEditingName={setEditingName}
              onStartRename={startRename}
              onCancelRename={cancelRename}
              onSubmitRename={submitRename}
              onToggleStatus={toggleStatus}
              onDelete={onDelete}
              actionLabel="Deactivate"
              actionTone="red"
              statusBusyIds={statusBusyIds}
              deleteBusyIds={deleteBusyIds}
              renameBusyIds={renameBusyIds}
              page={activePage}
              totalPages={activeTotalPages}
              total={activeTotal}
              startItem={activeStartItem}
              endItem={activeEndItem}
              onPrev={() => setActivePage((p) => Math.max(p - 1, 1))}
              onNext={() =>
                setActivePage((p) => Math.min(p + 1, activeTotalPages))
              }
              theme={resolvedTheme}
              borderColor={borderColor}
              subtleBg={subtleBg}
              inputBg={inputBg}
            />
          </div>

          <div className="flex flex-col gap-3">
            <StatusCard
              title="Inactive projects"
              count={inactiveTotal}
              loading={inactiveQuery.isLoading}
              items={inactiveItems}
              editingId={editingId}
              editingName={editingName}
              setEditingName={setEditingName}
              onStartRename={startRename}
              onCancelRename={cancelRename}
              onSubmitRename={submitRename}
              onToggleStatus={toggleStatus}
              onDelete={onDelete}
              actionLabel="Activate"
              actionTone="green"
              statusBusyIds={statusBusyIds}
              deleteBusyIds={deleteBusyIds}
              renameBusyIds={renameBusyIds}
              page={inactivePage}
              totalPages={inactiveTotalPages}
              total={inactiveTotal}
              startItem={inactiveStartItem}
              endItem={inactiveEndItem}
              onPrev={() => setInactivePage((p) => Math.max(p - 1, 1))}
              onNext={() =>
                setInactivePage((p) => Math.min(p + 1, inactiveTotalPages))
              }
              theme={resolvedTheme}
              borderColor={borderColor}
              subtleBg={subtleBg}
              inputBg={inputBg}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
