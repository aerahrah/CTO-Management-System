// ctoEmployeeApplicationTable.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "../../statusUtils";
import FilterSelect from "../../filterSelect";
import Modal from "../../modal";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import MemoList from "../ctoMemoModal";
import CtoApplicationDetails from "../ctoApplicationComponents/myCtoApplicationFullDetails";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FileText,
  MoreVertical,
  Eye,
  Calendar,
  Clock,
  ArrowRight,
  LayoutGrid,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
} from "lucide-react";

/* =========================
   CONSTANTS
========================= */
const pageSizeOptions = [20, 50, 100];

/* =========================
   HELPERS
========================= */
const Chip = ({ children }) => (
  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-medium">
    {children}
  </span>
);

const formatSubmitted = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "-";

const formatCoveredDates = (dates = []) =>
  (dates || [])
    .map((d) =>
      new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    )
    .join(", ");

const memoLabelFromApp = (app) => {
  if (!Array.isArray(app?.memo) || app.memo.length === 0)
    return "No Memo Attached";
  const labels = app.memo.map((m) => m?.memoId?.memoNo).filter(Boolean);
  return labels.length ? labels.join(", ") : "No Memo Attached";
};

// ✅ Left status strip for mobile cards (copied pattern)
const getStatusColor = (status) => {
  switch (status) {
    case "APPROVED":
      return "border-l-4 border-l-emerald-500";
    case "REJECTED":
      return "border-l-4 border-l-rose-500";
    case "PENDING":
      return "border-l-4 border-l-amber-500";
    default:
      return "border-l-4 border-l-slate-300";
  }
};

/* =========================
   STATUS TABS (MyCtoApplications style + colors)
========================= */
const getStatusTabs = (statusCounts = {}) => [
  {
    id: "",
    label: "All Status",
    icon: LayoutGrid,
    count: statusCounts.total || 0,
    activeColor: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    id: "PENDING",
    label: "Pending",
    icon: AlertCircle,
    count: statusCounts.PENDING || 0,
    activeColor: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    id: "APPROVED",
    label: "Approved",
    icon: CheckCircle2,
    count: statusCounts.APPROVED || 0,
    activeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    id: "REJECTED",
    label: "Rejected",
    icon: XCircle,
    count: statusCounts.REJECTED || 0,
    activeColor: "bg-rose-100 text-rose-700 border-rose-200",
  },
];

/* =========================
   ACTION MENU (copied design)
========================= */
const ApplicationActionMenu = ({ app, onViewDetails, onViewMemos }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setIsOpen(false);
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handle = (cb) => {
    cb?.();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex justify-end" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((o) => !o);
        }}
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Actions"
        type="button"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-100 rounded-lg shadow-xl shadow-gray-200/50 z-30 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => handle(onViewDetails)}
            className="w-full px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2 transition-colors text-left"
            type="button"
          >
            <Eye size={14} /> View Details
          </button>

          <button
            disabled={!app?.memo || app.memo.length === 0}
            onClick={() => handle(onViewMemos)}
            className="w-full px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
            type="button"
          >
            <FileText size={14} /> View Memos
          </button>
        </div>
      )}
    </div>
  );
};

/* =========================
   PAGINATION (copied style)
========================= */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  label = "items",
  disabled = false,
}) => (
  <div className="px-4 md:px-6 pt-3 border-t border-gray-100 bg-white">
    <div className="flex md:hidden items-center justify-between gap-3">
      <button
        onClick={onPrev}
        disabled={disabled || page === 1 || total === 0}
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
          {total === 0 ? `0 ${label}` : `${startItem}-${endItem} of ${total}`}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={disabled || page >= totalPages || total === 0}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-30"
        type="button"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>

    <div className="hidden md:flex flex-col md:flex-row items-center justify-between gap-4">
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
          disabled={disabled || page === 1 || total === 0}
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
          disabled={disabled || page >= totalPages || total === 0}
          className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-gray-600"
          type="button"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

/* =========================
   MAIN COMPONENT (copied content/design from MyCtoApplications)
========================= */
const ApplicationCtoTable = ({
  applications = [],
  status = "",
  onStatusChange,
  search = "",
  onSearchChange,
  page = 1,
  limit = 20,
  onLimitChange,
  onNextPage,
  onPrevPage,
  totalPages = 1,
  total, // from API
  statusCounts, // optional from API
  isLoading,
}) => {
  const [selectedApp, setSelectedApp] = useState(null);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  const openMemoModal = (memos) => setMemoModal({ isOpen: true, memos });
  const closeMemoModal = () => setMemoModal({ isOpen: false, memos: [] });

  const handleResetFilters = useCallback(() => {
    onSearchChange?.("");
    onStatusChange?.("");
  }, [onSearchChange, onStatusChange]);

  const isFiltered = status !== "" || search !== "";

  // Safe local filter (API usually already filters)
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchesStatus = !status ? true : app?.overallStatus === status;

      const matchesSearch = !search
        ? true
        : String(memoLabelFromApp(app) || "")
            .toLowerCase()
            .includes(search.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [applications, status, search]);

  // Counts (prefer API)
  const computedCounts = useMemo(() => {
    if (statusCounts) {
      const totalFromStatuses =
        (statusCounts.PENDING || 0) +
        (statusCounts.APPROVED || 0) +
        (statusCounts.REJECTED || 0);
      return {
        total: statusCounts.total ?? totalFromStatuses,
        PENDING: statusCounts.PENDING || 0,
        APPROVED: statusCounts.APPROVED || 0,
        REJECTED: statusCounts.REJECTED || 0,
      };
    }

    const c = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const app of applications) {
      const s = app?.overallStatus;
      if (s === "PENDING") c.PENDING += 1;
      if (s === "APPROVED") c.APPROVED += 1;
      if (s === "REJECTED") c.REJECTED += 1;
    }
    return {
      total: typeof total === "number" ? total : applications.length,
      ...c,
    };
  }, [statusCounts, applications, total]);

  const tabs = useMemo(() => getStatusTabs(computedCounts), [computedCounts]);

  const pagination = useMemo(() => {
    const safeTotalPages = Math.max(totalPages || 1, 1);
    const safeTotal = typeof total === "number" ? total : 0;
    return {
      page: page || 1,
      totalPages: safeTotalPages,
      total: safeTotal,
    };
  }, [page, totalPages, total]);

  const startItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * limit + 1;
  const endItem =
    pagination.total === 0
      ? 0
      : Math.min(pagination.page * limit, pagination.total);

  return (
    <div className="w-full flex-1 flex h-full flex-col bg-white overflow-hidden">
      {/* TOOLBAR (copied style) */}
      <div className="py-2 border-b border-gray-100 bg-white space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {tabs.map((tab) => {
              const isActive = status === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => onStatusChange?.(tab.id)}
                  className={`px-2 py-1.5 text-xs font-bold rounded-full border transition-all whitespace-nowrap flex items-center gap-2
                    ${
                      isActive
                        ? tab.activeColor
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  aria-pressed={isActive}
                  type="button"
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1 py-0.5 rounded-full text-[10px] font-bold
                      ${
                        isActive
                          ? "bg-white/80 text-gray-900"
                          : "bg-gray-100 text-gray-600"
                      }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search + Rows */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search memo..."
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-full h-8 pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              {search && (
                <button
                  onClick={() => onSearchChange?.("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                  title="Clear"
                  type="button"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>

            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-gray-200">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Show
              </span>
              <select
                value={limit}
                onChange={(e) => onLimitChange?.(Number(e.target.value))}
                className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5 font-medium outline-none cursor-pointer"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:hidden flex items-center gap-1.5 px-2 border-l border-gray-200 ml-1">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Rows
              </span>
              <FilterSelect
                label=""
                value={limit}
                onChange={(v) => onLimitChange?.(Number(v))}
                options={pageSizeOptions}
                className="!mb-0 w-20 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {isFiltered && (
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase">
                Active:
              </span>
              {search && <Chip>"{search}"</Chip>}
              {status && <Chip>{status}</Chip>}
            </div>
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase"
              type="button"
            >
              <RotateCcw size={10} /> Reset
            </button>
          </div>
        )}
      </div>

      {/* DATA */}
      <div className="flex-1 overflow-y-auto bg-white min-h-[300px]">
        {!isLoading && filteredApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
            <div className="bg-gray-50 p-6 rounded-full mb-4 ring-1 ring-gray-100">
              <Filter className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              No Results Found
            </h3>
            <p className="text-sm text-gray-500 max-w-xs mt-1">
              Try adjusting your search or filters to find what you're looking
              for.
            </p>
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="mt-6 flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                type="button"
              >
                <RotateCcw size={12} /> Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE (copied columns + action menu) */}
            <div className="hidden md:block w-full align-middle">
              <table className="w-full text-left">
                <thead className="bg-white sticky top-0 z-10 border-b border-gray-100">
                  <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-400 font-bold">
                    <th className="px-6 py-4 font-bold">Reference / Memo</th>
                    <th className="px-6 py-4 text-center">Hours</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Submitted</th>
                    <th className="px-6 py-4">Dates Covered</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {isLoading
                    ? [...Array(8)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(6)].map((__, j) => (
                            <td key={j} className="px-6 py-4">
                              <Skeleton />
                            </td>
                          ))}
                        </tr>
                      ))
                    : filteredApps.map((app, i) => {
                        const memoLabel = memoLabelFromApp(app);

                        return (
                          <tr
                            key={app._id || i}
                            className={`group hover:bg-gray-50/80 transition-colors ${
                              i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900 text-sm">
                                  {memoLabel}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                                  ID:{" "}
                                  {app?._id
                                    ? app._id.slice(-6).toUpperCase()
                                    : "-"}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200">
                                {app?.requestedHours ?? 0}h
                              </span>
                            </td>

                            <td className="px-6 py-4 text-center">
                              <StatusBadge status={app?.overallStatus} />
                            </td>

                            <td className="px-6 py-4 text-center text-sm text-gray-500">
                              {formatSubmitted(app?.createdAt)}
                            </td>

                            <td className="px-6 py-4 text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-gray-400" />
                                <span>
                                  {formatCoveredDates(
                                    app?.inclusiveDates || [],
                                  )}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <ApplicationActionMenu
                                app={app}
                                onViewDetails={() => setSelectedApp(app)}
                                onViewMemos={() =>
                                  openMemoModal(app?.memo || [])
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS (copied layout + actions row) */}
            <div className="md:hidden flex flex-col p-3 gap-3 bg-gray-50">
              {isLoading
                ? [...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3"
                    >
                      <Skeleton count={3} />
                    </div>
                  ))
                : filteredApps.map((app) => (
                    <div
                      key={app._id}
                      onClick={() => setSelectedApp(app)}
                      className={[
                        "bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
                        "border-y border-r border-gray-100 overflow-hidden",
                        "active:scale-[0.99] transition-transform",
                        getStatusColor(app?.overallStatus),
                      ].join(" ")}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="px-4 py-3 flex justify-between items-center border-b border-gray-50">
                        <span className="text-xs font-mono text-gray-400">
                          #{app?._id ? app._id.slice(-6).toUpperCase() : "-"}
                        </span>
                        <StatusBadge status={app?.overallStatus} />
                      </div>

                      <div className="p-4 space-y-4">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 mb-1">
                            {memoLabelFromApp(app)}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Clock size={12} /> Filed on{" "}
                            {app?.createdAt
                              ? new Date(app.createdAt).toLocaleDateString()
                              : "-"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-gray-100">
                          <div className="flex-1">
                            <span className="block text-[10px] uppercase font-bold text-gray-400">
                              Total Hours
                            </span>
                            <span className="text-sm font-bold text-gray-900">
                              {app?.requestedHours ?? 0} hrs
                            </span>
                          </div>
                          <div className="w-px h-6 bg-gray-200" />
                          <div className="flex-1 pl-2">
                            <span className="block text-[10px] uppercase font-bold text-gray-400">
                              Dates
                            </span>
                            <span className="text-xs font-medium text-gray-700 truncate block">
                              {app?.inclusiveDates?.length || 0} day(s) selected
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openMemoModal(app?.memo || []);
                          }}
                          className="py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
                          type="button"
                        >
                          <FileText size={14} /> Memos
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedApp(app);
                          }}
                          className="py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2"
                          type="button"
                        >
                          View Details <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
            </div>
          </>
        )}
      </div>

      {/* PAGINATION */}
      <CompactPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        startItem={startItem}
        endItem={endItem}
        label="applications"
        disabled={isLoading}
        onPrev={onPrevPage}
        onNext={onNextPage}
      />

      {/* DETAILS MODAL (copied behavior; safe fallback UI) */}
      {selectedApp && (
        <Modal
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          title="CTO Application Details"
          maxWidth="max-w-5xl"
        >
          <CtoApplicationDetails app={selectedApp} />
        </Modal>
      )}

      {/* MEMO MODAL */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={closeMemoModal}
        title="Attached Memos"
        closeLabel="Close"
        maxWidth="max-w-5xl"
      >
        <div className="w-full">
          <MemoList
            memos={memoModal.memos}
            description={"References used for this compensation request."}
          />
        </div>
      </Modal>
    </div>
  );
};

export default ApplicationCtoTable;
