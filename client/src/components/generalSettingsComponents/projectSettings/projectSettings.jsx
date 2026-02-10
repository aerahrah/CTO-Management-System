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

const pageSizeOptions = [20, 50, 100];
const qk = (status, page, limit) => ["projects", status, page, limit];

// ---- helpers ----
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

const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}
  >
    {children}
  </div>
);

const CountPill = ({ value }) => (
  <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
    {value}
  </span>
);

const InlineError = ({ message }) => {
  if (!message) return null;
  return (
    <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700 font-medium">
      {message}
    </div>
  );
};

const EmptyState = () => (
  <div className="p-6">
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
      <div className="text-sm font-medium text-gray-700">No items found</div>
      <div className="text-xs text-gray-500 mt-1">
        Add a new project above or refresh the list.
      </div>
    </div>
  </div>
);

const SkeletonList = () => (
  <div className="p-4 space-y-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="h-4 w-1/2 bg-gray-100 rounded" />
        <div className="mt-2 h-3 w-1/3 bg-gray-100 rounded" />
        <div className="mt-4 flex gap-2 justify-end">
          <div className="h-7 w-16 bg-gray-100 rounded-full" />
          <div className="h-7 w-24 bg-gray-100 rounded-full" />
          <div className="h-7 w-16 bg-gray-100 rounded-full" />
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
}) => {
  const tones = {
    neutral:
      "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50",
    blue: "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100/60",
    red: "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100/60",
    green:
      "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/60",
    dark: "bg-gray-900 text-white border-gray-900 hover:bg-gray-800",
  };

  return (
    <button
      type={type}
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

/* ✅ Pagination component styled like MyCtoCreditHistory */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
}) => {
  return (
    <div className="px-4 md:px-6 py-3 border-t border-gray-100 bg-white rounded-xl">
      {/* Mobile/tablet */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-30"
          type="button"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="text-center min-w-0">
          <div className="text-xs font-mono font-semibold text-gray-700">
            {page} / {totalPages}
          </div>
          <div className="text-[11px] text-gray-500 truncate">
            {total === 0 ? "0 results" : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-30"
          type="button"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-xs text-gray-500 font-medium">
          Showing{" "}
          <span className="font-bold text-gray-900">
            {total === 0 ? 0 : `${startItem}-${endItem}`}
          </span>{" "}
          of <span className="font-bold text-gray-900">{total}</span> projects
        </div>

        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
          <button
            onClick={onPrev}
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-gray-600"
            type="button"
          >
            <ChevronLeft className="w-4 h-4" />
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
}) {
  return (
    <Card className="min-h-[420px] flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <CountPill value={count} />
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <SkeletonList />
        ) : items.length === 0 ? (
          <EmptyState />
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
                  className="rounded-xl border border-gray-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)] p-4"
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
                          className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                        />
                      ) : (
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {p.name}
                        </div>
                      )}

                      <div className="mt-1 text-[11px] text-gray-500">
                        Status:{" "}
                        <span className="font-medium text-gray-700">
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
                          >
                            {isRenameBusy ? "Saving..." : "Save"}
                          </ActionPill>
                          <ActionPill
                            onClick={onCancelRename}
                            disabled={isRenameBusy}
                            tone="neutral"
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
                          >
                            Rename
                          </ActionPill>

                          <ActionPill
                            onClick={() => onToggleStatus(p)}
                            disabled={isStatusBusy || isDeleteBusy}
                            tone={actionTone}
                          >
                            {isStatusBusy ? "Updating..." : actionLabel}
                          </ActionPill>

                          <ActionPill
                            onClick={() => onDelete(p)}
                            disabled={isDeleteBusy || isStatusBusy}
                            tone="neutral"
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
    </Card>
  );
}

export default function ProjectSettings() {
  const queryClient = useQueryClient();

  const [limit, setLimit] = useState(20);
  const [activePage, setActivePage] = useState(1);
  const [inactivePage, setInactivePage] = useState(1);

  const [newName, setNewName] = useState("");
  const [inlineError, setInlineError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  // per-row busy sets
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

  // ✅ clamp when pages change
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
  }, [activeQuery, inactiveQuery]);

  const isRefreshing = activeQuery.isRefetching || inactiveQuery.isRefetching;

  // Mutations
  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      setNewName("");
      setInlineError("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      setInlineError(err?.response?.data?.message || err.message || "Failed");
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, payload }) => updateProject(id, payload),
    onMutate: ({ id }) => addBusy(setRenameBusyIds, id),
    onSettled: (_d, _e, vars) =>
      vars?.id && removeBusy(setRenameBusyIds, vars.id),
    onSuccess: async () => {
      setEditingId(null);
      setEditingName("");
      setInlineError("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      setInlineError(err?.response?.data?.message || err.message || "Failed");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateProjectStatus(id, status),
    onMutate: ({ id }) => addBusy(setStatusBusyIds, id),
    onSettled: (_d, _e, vars) =>
      vars?.id && removeBusy(setStatusBusyIds, vars.id),
    onSuccess: async () => {
      setInlineError("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      setInlineError(err?.response?.data?.message || err.message || "Failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteProject(id),
    onMutate: (id) => addBusy(setDeleteBusyIds, id),
    onSettled: (_d, _e, id) => id && removeBusy(setDeleteBusyIds, id),
    onSuccess: async () => {
      setInlineError("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err) => {
      setInlineError(err?.response?.data?.message || err.message || "Failed");
    },
  });

  // actions
  const onCreate = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return setInlineError("Project name is required.");
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
    if (!name) return setInlineError("Name cannot be empty.");
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

  // totals for compact pagination
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
    <div className="w-full flex-1 flex h-full flex-col bg-gray-50/50">
      <div className="max-w-[1180px] w-full mx-auto px-3 md:px-6 pt-3 pb-6">
        <Breadcrumbs
          items={[
            { label: "USER MANAGEMENT", to: "/app/user-management" },
            { label: "OFFICE/PROJECT" },
          ]}
        />

        {/* Header */}
        <div className="mt-2 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              Office <span className="font-bold">Projects</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage office/project options used in registration and storage.
            </p>
          </div>

          {/* ✅ Refresh button styled like MyCtoCreditHistory retry/reset buttons */}
          <button
            onClick={refetchBoth}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 bg-white border border-gray-200 text-sm font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition disabled:opacity-40"
            type="button"
          >
            <RotateCcw className="w-4 h-4" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Add Bar */}
        <Card className="mt-5">
          <div className="p-4">
            <form
              onSubmit={onCreate}
              className="flex flex-col md:flex-row gap-3 md:items-center"
            >
              <div className="flex-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Add new office/project"
                  className="w-full h-11 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={!canCreate}
                className={`inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg text-sm font-bold border transition
                  ${
                    canCreate
                      ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-800"
                      : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  }`}
              >
                <Plus className="w-4 h-4" />
                {createMutation.isPending ? "Adding..." : "Add office/project"}
              </button>
            </form>

            <div className="mt-2 text-xs text-gray-500">
              Tip: You can deactivate an office/project instead of deleting it.
            </div>

            <InlineError message={inlineError} />

            {/* ✅ page-size controls: EXACT pattern from MyCtoCreditHistory */}
            <div className="mt-4 flex items-center justify-between gap-3">
              {/* Desktop select */}
              <div className="hidden md:flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Show
                </span>
                <select
                  value={limit}
                  onChange={(e) => {
                    onLimitChange(Number(e.target.value));
                  }}
                  className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 font-medium outline-none cursor-pointer"
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
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
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

              {/* optional chips (kept from your layout) */}
              <div className="hidden md:flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Quick
                </span>
                {pageSizeOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onLimitChange(n)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition
                      ${
                        limit === n
                          ? "bg-blue-50 text-blue-700 border-blue-100"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                      }`}
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
          {/* Active */}
          <div className="flex flex-col gap-3">
            <StatusCard
              title="Active offices/projects"
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
            />

            {/* ✅ Pagination styled like MyCtoCreditHistory */}
            <CompactPagination
              page={activePage}
              totalPages={activeTotalPages}
              total={activeTotal}
              startItem={activeStartItem}
              endItem={activeEndItem}
              onPrev={() => setActivePage((p) => Math.max(p - 1, 1))}
              onNext={() =>
                setActivePage((p) => Math.min(p + 1, activeTotalPages))
              }
            />
          </div>

          {/* Inactive */}
          <div className="flex flex-col gap-3">
            <StatusCard
              title="Inactive offices/projects"
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
            />

            {/* ✅ Pagination styled like MyCtoCreditHistory */}
            <CompactPagination
              page={inactivePage}
              totalPages={inactiveTotalPages}
              total={inactiveTotal}
              startItem={inactiveStartItem}
              endItem={inactiveEndItem}
              onPrev={() => setInactivePage((p) => Math.max(p - 1, 1))}
              onNext={() =>
                setInactivePage((p) => Math.min(p + 1, inactiveTotalPages))
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
