// src/components/settings/designations/DesignationSettings.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Breadcrumbs from "../../breadCrumbs";
import FilterSelect from "../../filterSelect";
import { toast } from "react-toastify";
import { useAuth } from "../../../store/authStore";
import {
  fetchAllDesignations,
  createDesignation,
  updateDesignation,
  updateDesignationStatus,
  deleteDesignation,
} from "../../../api/designation";
import { RotateCcw, Plus, ChevronLeft, ChevronRight } from "lucide-react";

const pageSizeOptions = [20, 50, 100];
const qk = (status, page, limit) => ["designations", status, page, limit];

/* ------------------ Resolve theme ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

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
      : Array.isArray(raw?.designations)
        ? raw.designations
        : Array.isArray(raw)
          ? raw
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

const getActionToneStyle = (tone, resolvedTheme) => {
  const isDark = resolvedTheme === "dark";

  const map = {
    neutral: {
      bg: "var(--app-surface)",
      color: "var(--app-text)",
      border: isDark ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.12)",
      hoverBg: "var(--app-surface-2)",
    },
    blue: {
      bg: isDark ? "rgba(59,130,246,0.14)" : "rgba(59,130,246,0.10)",
      color: isDark ? "#93c5fd" : "#1d4ed8",
      border: isDark ? "rgba(59,130,246,0.24)" : "rgba(59,130,246,0.16)",
      hoverBg: isDark ? "rgba(59,130,246,0.20)" : "rgba(59,130,246,0.16)",
    },
    red: {
      bg: isDark ? "rgba(244,63,94,0.14)" : "rgba(244,63,94,0.10)",
      color: isDark ? "#fda4af" : "#be123c",
      border: isDark ? "rgba(244,63,94,0.24)" : "rgba(244,63,94,0.16)",
      hoverBg: isDark ? "rgba(244,63,94,0.20)" : "rgba(244,63,94,0.16)",
    },
    green: {
      bg: isDark ? "rgba(16,185,129,0.14)" : "rgba(16,185,129,0.10)",
      color: isDark ? "#6ee7b7" : "#047857",
      border: isDark ? "rgba(16,185,129,0.24)" : "rgba(16,185,129,0.16)",
      hoverBg: isDark ? "rgba(16,185,129,0.20)" : "rgba(16,185,129,0.16)",
    },
    dark: {
      bg: "var(--accent)",
      color: "#fff",
      border: "var(--accent)",
      hoverBg: "var(--accent)",
    },
  };

  return map[tone] || map.neutral;
};

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

const CountPill = ({ value, resolvedTheme }) => (
  <span
    className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-[11px] font-medium border transition-colors duration-300 ease-out"
    style={{
      backgroundColor:
        resolvedTheme === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(15,23,42,0.06)",
      color: "var(--app-text)",
      borderColor:
        resolvedTheme === "dark"
          ? "rgba(255,255,255,0.08)"
          : "rgba(15,23,42,0.08)",
    }}
  >
    {value}
  </span>
);

const InlineError = ({ message, resolvedTheme }) => {
  if (!message) return null;
  return (
    <div
      className="mt-3 rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-300 ease-out"
      style={{
        borderColor:
          resolvedTheme === "dark"
            ? "rgba(244,63,94,0.22)"
            : "rgba(244,63,94,0.16)",
        backgroundColor:
          resolvedTheme === "dark"
            ? "rgba(244,63,94,0.10)"
            : "rgba(244,63,94,0.06)",
        color: resolvedTheme === "dark" ? "#fda4af" : "#be123c",
      }}
    >
      {message}
    </div>
  );
};

const EmptyState = ({ borderColor }) => (
  <div className="p-6">
    <div
      className="rounded-xl px-4 py-8 text-center transition-colors duration-300 ease-out"
      style={{
        border: `1px dashed ${borderColor}`,
        backgroundColor: "var(--app-surface-2)",
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
        Add a new designation above or refresh the list.
      </div>
    </div>
  </div>
);

const SkeletonList = ({ borderColor, skeletonColor }) => (
  <div className="p-4 space-y-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="rounded-xl p-4 transition-colors duration-300 ease-out"
        style={{
          border: `1px solid ${borderColor}`,
          backgroundColor: "var(--app-surface)",
        }}
      >
        <div
          className="h-4 w-1/2 rounded"
          style={{ backgroundColor: skeletonColor }}
        />
        <div
          className="mt-2 h-3 w-1/3 rounded"
          style={{ backgroundColor: skeletonColor }}
        />
        <div className="mt-4 flex gap-2 justify-end">
          <div
            className="h-7 w-16 rounded-full"
            style={{ backgroundColor: skeletonColor }}
          />
          <div
            className="h-7 w-24 rounded-full"
            style={{ backgroundColor: skeletonColor }}
          />
          <div
            className="h-7 w-16 rounded-full"
            style={{ backgroundColor: skeletonColor }}
          />
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
  resolvedTheme,
}) => {
  const toneStyle = getActionToneStyle(tone, resolvedTheme);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition whitespace-nowrap duration-200 ease-out",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
      style={{
        backgroundColor: toneStyle.bg,
        color: toneStyle.color,
        borderColor: toneStyle.border,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = toneStyle.hoverBg;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = toneStyle.bg;
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
  noun = "items",
  borderColor,
}) => {
  return (
    <div
      className="px-4 md:px-6 py-3 border-t rounded-xl transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor,
      }}
    >
      {/* Mobile/tablet */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            borderColor,
            backgroundColor: "var(--app-surface)",
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
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            borderColor,
            backgroundColor: "var(--app-surface)",
            color: "var(--app-text)",
          }}
          type="button"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop */}
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
          {noun}
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-lg border transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface-2)",
            borderColor,
          }}
        >
          <button
            onClick={onPrev}
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md hover:shadow-sm disabled:opacity-30 transition-all"
            style={{ color: "var(--app-muted)" }}
            type="button"
            onMouseEnter={(e) => {
              if (page === 1 || total === 0) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
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
            className="p-1.5 rounded-md hover:shadow-sm disabled:opacity-30 transition-all"
            style={{ color: "var(--app-muted)" }}
            type="button"
            onMouseEnter={(e) => {
              if (page >= totalPages || total === 0) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
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
  noun,
  borderColor,
  resolvedTheme,
  skeletonColor,
}) {
  return (
    <Card
      borderColor={borderColor}
      className="h-[calc(100vh-16rem)] flex flex-col overflow-hidden"
    >
      <div
        className="px-4 py-3 border-b flex items-center justify-between transition-colors duration-300 ease-out"
        style={{
          borderColor,
          backgroundColor: "var(--app-surface)",
        }}
      >
        <div
          className="text-sm font-semibold transition-colors duration-300 ease-out"
          style={{ color: "var(--app-text)" }}
        >
          {title}
        </div>
        <CountPill value={count} resolvedTheme={resolvedTheme} />
      </div>

      <div className="flex-1 overflow-y-auto cto-scrollbar">
        {loading ? (
          <SkeletonList
            borderColor={borderColor}
            skeletonColor={skeletonColor}
          />
        ) : items.length === 0 ? (
          <EmptyState borderColor={borderColor} />
        ) : (
          <div className="p-4 space-y-3">
            {items.map((d) => {
              const isEditing = editingId === d._id;
              const isStatusBusy = statusBusyIds?.has(d._id);
              const isDeleteBusy = deleteBusyIds?.has(d._id);
              const isRenameBusy = renameBusyIds?.has(d._id);
              const rowBusy = isStatusBusy || isDeleteBusy || isRenameBusy;

              return (
                <div
                  key={d._id}
                  className="rounded-xl p-4 transition-colors duration-300 ease-out"
                  style={{
                    border: `1px solid ${borderColor}`,
                    backgroundColor: "var(--app-surface)",
                    boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onSubmitRename(d._id);
                            if (e.key === "Escape") onCancelRename();
                          }}
                          autoFocus
                          className="w-full h-10 rounded-lg border px-3 text-sm outline-none transition"
                          style={{
                            borderColor,
                            backgroundColor: "var(--app-surface-2)",
                            color: "var(--app-text)",
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "var(--app-surface)";
                            e.currentTarget.style.borderColor = "var(--accent)";
                            e.currentTarget.style.boxShadow =
                              "0 0 0 3px var(--accent-soft)";
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "var(--app-surface-2)";
                            e.currentTarget.style.borderColor = borderColor;
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        />
                      ) : (
                        <div
                          className="text-sm font-semibold truncate transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-text)" }}
                        >
                          {d.name}
                        </div>
                      )}

                      <div
                        className="mt-1 text-[11px] transition-colors duration-300 ease-out"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Status:{" "}
                        <span
                          className="font-medium transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-text)" }}
                        >
                          {d.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-none">
                      {isEditing ? (
                        <>
                          <ActionPill
                            onClick={() => onSubmitRename(d._id)}
                            disabled={isRenameBusy}
                            tone="dark"
                            resolvedTheme={resolvedTheme}
                          >
                            {isRenameBusy ? "Saving..." : "Save"}
                          </ActionPill>
                          <ActionPill
                            onClick={onCancelRename}
                            disabled={isRenameBusy}
                            tone="neutral"
                            resolvedTheme={resolvedTheme}
                          >
                            Cancel
                          </ActionPill>
                        </>
                      ) : (
                        <>
                          <ActionPill
                            onClick={() => onStartRename(d)}
                            disabled={rowBusy}
                            tone="blue"
                            resolvedTheme={resolvedTheme}
                          >
                            Rename
                          </ActionPill>

                          <ActionPill
                            onClick={() => onToggleStatus(d)}
                            disabled={isStatusBusy || isDeleteBusy}
                            tone={actionTone}
                            resolvedTheme={resolvedTheme}
                          >
                            {isStatusBusy ? "Updating..." : actionLabel}
                          </ActionPill>

                          <ActionPill
                            onClick={() => onDelete(d)}
                            disabled={isDeleteBusy || isStatusBusy}
                            tone="neutral"
                            resolvedTheme={resolvedTheme}
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
          noun={noun}
          borderColor={borderColor}
        />
      </div>
    </Card>
  );
}

export default function DesignationSettings() {
  const queryClient = useQueryClient();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColor = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(15,23,42,0.08)",
    [resolvedTheme],
  );

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
      fetchAllDesignations({ status: "Active", page: activePage, limit }),
    placeholderData: (prev) => prev,
    select: (raw) => normalizeListResponse(raw, activePage, limit),
  });

  const inactiveQuery = useQuery({
    queryKey: qk("Inactive", inactivePage, limit),
    queryFn: () =>
      fetchAllDesignations({ status: "Inactive", page: inactivePage, limit }),
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
    mutationFn: createDesignation,
    onSuccess: async (_data, vars) => {
      setNewName("");
      setInlineError("");
      toast.success(`Added "${vars?.name}"`);
      await queryClient.invalidateQueries({ queryKey: ["designations"] });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to add designation");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, payload }) => updateDesignation(id, payload),
    onMutate: ({ id }) => addBusy(setRenameBusyIds, id),
    onSettled: (_d, _e, vars) =>
      vars?.id && removeBusy(setRenameBusyIds, vars.id),
    onSuccess: async (_data, vars) => {
      setEditingId(null);
      setEditingName("");
      setInlineError("");
      toast.success(`Renamed to "${vars?.payload?.name}"`);
      await queryClient.invalidateQueries({ queryKey: ["designations"] });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to rename designation");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateDesignationStatus(id, status),
    onMutate: ({ id }) => addBusy(setStatusBusyIds, id),
    onSettled: (_d, _e, vars) =>
      vars?.id && removeBusy(setStatusBusyIds, vars.id),
    onSuccess: async (_data, vars) => {
      setInlineError("");
      toast.success(`Set to ${vars?.status}`);
      await queryClient.invalidateQueries({ queryKey: ["designations"] });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to update status");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteDesignation(id),
    onMutate: (id) => addBusy(setDeleteBusyIds, id),
    onSettled: (_d, _e, id) => id && removeBusy(setDeleteBusyIds, id),
    onSuccess: async () => {
      setInlineError("");
      toast.success("Deleted designation");
      await queryClient.invalidateQueries({ queryKey: ["designations"] });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to delete designation");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const onCreate = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      const msg = "Designation name is required.";
      setInlineError(msg);
      toast.error(msg);
      return;
    }
    setInlineError("");
    createMutation.mutate({ name, status: "Active" });
  };

  const startRename = (d) => {
    setInlineError("");
    setEditingId(d._id);
    setEditingName(d.name || "");
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

  const toggleStatus = (d) => {
    const next = d.status === "Active" ? "Inactive" : "Active";
    statusMutation.mutate({ id: d._id, status: next });
  };

  const onDelete = (d) => {
    if (!window.confirm(`Delete designation "${d.name}"?`)) return;
    deleteMutation.mutate(d._id);
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

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              Office <span className="font-bold">Designations</span>
            </h1>
            <p
              className="text-sm mt-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Manage designation options used in employee registration and
              storage.
            </p>
          </div>

          <button
            onClick={refetchBoth}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold border transition disabled:opacity-40"
            type="button"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
              color: "var(--accent)",
            }}
            onMouseEnter={(e) => {
              if (isRefreshing) return;
              e.currentTarget.style.backgroundColor = "var(--accent-soft)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
          >
            <RotateCcw className="w-4 h-4" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Add Bar */}
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
                  placeholder="Add new designation"
                  className="w-full h-11 rounded-lg border px-3 text-sm outline-none transition"
                  style={{
                    borderColor,
                    backgroundColor: "var(--app-surface-2)",
                    color: "var(--app-text)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface)";
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px var(--accent-soft)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface-2)";
                    e.currentTarget.style.borderColor = borderColor;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={!canCreate}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg text-sm font-bold border transition"
                style={
                  canCreate
                    ? {
                        backgroundColor: "var(--accent)",
                        color: "#fff",
                        borderColor: "var(--accent)",
                      }
                    : {
                        backgroundColor: "var(--app-surface-2)",
                        color: "var(--app-muted)",
                        borderColor,
                        cursor: "not-allowed",
                      }
                }
                onMouseEnter={(e) => {
                  if (!canCreate) return;
                  e.currentTarget.style.filter = "brightness(0.95)";
                }}
                onMouseLeave={(e) => {
                  if (!canCreate) return;
                  e.currentTarget.style.filter = "none";
                }}
              >
                <Plus className="w-4 h-4" />
                {createMutation.isPending ? "Adding..." : "Add designation"}
              </button>
            </form>

            <div
              className="mt-2 text-xs transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Tip: You can deactivate a designation instead of deleting it.
            </div>

            <InlineError message={inlineError} resolvedTheme={resolvedTheme} />

            {/* Page-size controls */}
            <div className="mt-4 flex items-center justify-between gap-3">
              {/* Desktop select */}
              <div className="hidden md:flex items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Show
                </span>
                <select
                  value={limit}
                  onChange={(e) => onLimitChange(Number(e.target.value))}
                  className="text-xs rounded-lg block p-1.5 font-medium outline-none cursor-pointer border transition"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderColor,
                    color: "var(--app-text)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px var(--accent-soft)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = borderColor;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {pageSizeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mobile FilterSelect */}
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

              {/* Quick chips */}
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
                    className="px-3 py-1.5 rounded-full text-xs font-bold border transition"
                    style={
                      limit === n
                        ? {
                            backgroundColor: "var(--accent-soft)",
                            color: "var(--accent)",
                            borderColor: "var(--accent-soft2)",
                          }
                        : {
                            backgroundColor: "var(--app-surface)",
                            color: "var(--app-text)",
                            borderColor,
                          }
                    }
                    onMouseEnter={(e) => {
                      if (limit === n) return;
                      e.currentTarget.style.backgroundColor =
                        "var(--app-surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      if (limit === n) return;
                      e.currentTarget.style.backgroundColor =
                        "var(--app-surface)";
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Two Columns */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <StatusCard
              title="Active designations"
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
              noun="designations"
              borderColor={borderColor}
              resolvedTheme={resolvedTheme}
              skeletonColor={skeletonColor}
            />
          </div>

          <div className="flex flex-col gap-3">
            <StatusCard
              title="Inactive designations"
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
              noun="designations"
              borderColor={borderColor}
              resolvedTheme={resolvedTheme}
              skeletonColor={skeletonColor}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
