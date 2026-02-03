import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "../../statusUtils";
import { fetchAllCtoApplications } from "../../../api/cto";
import Modal from "../../modal";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import MemoList from "../ctoMemoModal";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Calendar,
  FileText,
  Info,
  Inbox,
  MoreVertical,
  LayoutGrid,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  X,
} from "lucide-react";
import FilterSelect from "../../filterSelect";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";

const pageSizeOptions = [20, 50, 100];

// ---------- Breadcrumbs ----------
const Breadcrumbs = () => (
  <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold tracking-[0.12em] text-gray-400 uppercase mb-2 font-sans">
    <span className="hover:text-blue-600 cursor-pointer transition-colors">
      Dashboard
    </span>
    <span className="text-gray-300">/</span>
    <span className="hover:text-blue-600 cursor-pointer transition-colors">
      HR
    </span>
    <span className="text-gray-300">/</span>
    <span className="text-blue-600">CTO Management</span>
  </div>
);

// ---------- Per-row action menu ----------
const ApplicationActionMenu = ({ app, onViewDetails, onViewMemos }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
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
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((o) => !o);
        }}
        className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800"
        title="Actions"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
          <button
            onClick={() => handle(onViewDetails)}
            className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Eye size={14} /> View Details
          </button>

          <button
            disabled={!app.memo || app.memo.length === 0}
            onClick={() => handle(onViewMemos)}
            className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText size={14} /> View Memos
          </button>
        </div>
      )}
    </div>
  );
};

// ---------- Status tabs factory ----------
const statusTabs = (statusCounts = {}) => [
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

/* ------------------ Compact Pagination (same design as CTO Credit) ------------------ */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  label = "items",
}) => {
  return (
    <div className="px-4 md:px-6 py-3 border-t border-gray-100 bg-white">
      {/* Mobile / Tablet (compact, low height) */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-30"
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
          disabled={page >= totalPages || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:opacity-30"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop (matches your existing CTA style) */}
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
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all text-gray-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-medium px-3 text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={onNext}
            disabled={page >= totalPages || total === 0}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all text-gray-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const AllCtoApplicationsHistory = () => {
  // ---- Selected app / memos ----
  const [selectedApp, setSelectedApp] = useState(null);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  // ---- Filters / pagination ----
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // debounce search
  const searchTimeout = useRef(null);
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchFilter(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(searchTimeout.current);
  }, [searchInput]);

  // ---- Data fetching ----
  const { data, isLoading } = useQuery({
    queryKey: ["ctoAllApplications", page, limit, statusFilter, searchFilter],
    queryFn: () =>
      fetchAllCtoApplications({
        page,
        limit,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      }),
    keepPreviousData: true,
  });

  const applications = useMemo(() => data?.data || [], [data]);

  const pagination = useMemo(
    () => ({
      page: data?.pagination?.page || 1,
      totalPages: Math.max(data?.pagination?.totalPages || 1, 1),
      total: data?.pagination?.total || 0,
    }),
    [data],
  );

  // keep page within range if totalPages changes
  useEffect(() => {
    setPage((p) => {
      if (p > pagination.totalPages) return pagination.totalPages;
      if (p < 1) return 1;
      return p;
    });
  }, [pagination.totalPages]);

  const startItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * limit + 1;
  const endItem =
    pagination.total === 0
      ? 0
      : Math.min(pagination.page * limit, pagination.total);

  const openMemoModal = (memos) => setMemoModal({ isOpen: true, memos });
  const closeMemoModal = () => setMemoModal({ isOpen: false, memos: [] });

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const isFiltered = statusFilter !== "" || searchFilter !== "";

  const getStatusColor = (status) => {
    switch (status) {
      case "APPROVED":
        return "border-l-green-500";
      case "REJECTED":
        return "border-l-red-500";
      case "PENDING":
        return "border-l-amber-500";
      default:
        return "border-l-gray-300";
    }
  };

  const statusCounts = data?.statusCounts || {};

  return (
    <div className="w-full flex-1 flex h-full flex-col md:p-0 bg-gray-50/50">
      {/* Header */}
      <div className="pt-2 pb-6 px-1">
        {/* <Breadcrumbs /> */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight font-sans">
                All CTO Applications
              </h1>
              <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                View and manage all compensatory time-off applications
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main surface */}
      <div className="flex flex-col flex-1 min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 bg-white space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              {statusTabs(statusCounts).map((tab) => {
                const isActive = statusFilter === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id || "all-status"}
                    onClick={() => {
                      setStatusFilter(tab.id);
                      setPage(1);
                    }}
                    className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all whitespace-nowrap flex items-center gap-2
                      ${
                        isActive
                          ? tab.activeColor
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    aria-pressed={isActive}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span
                      className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold
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

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search memo..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                    title="Clear"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="hidden md:flex items-center gap-2 pl-3 border-l border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Show
                </span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
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

              <div className="md:hidden flex items-center gap-1.5 px-2 border-l border-gray-200 ml-1">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Rows
                </span>
                <FilterSelect
                  label=""
                  value={limit}
                  onChange={(v) => {
                    setLimit(v);
                    setPage(1);
                  }}
                  options={pageSizeOptions}
                  className="!mb-0 w-20 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Active filters summary */}
          {isFiltered && (
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  Active:
                </span>
                {searchFilter && (
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-medium">
                    "{searchFilter}"
                  </span>
                )}
                {statusFilter && (
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-medium">
                    {statusFilter}
                  </span>
                )}
              </div>
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          )}
        </div>

        {/* Data view */}
        <div className="flex-1 overflow-y-auto bg-white min-h-[300px]">
          {!isLoading && applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
              <div className="bg-gray-50 p-6 rounded-full mb-4 ring-1 ring-gray-100">
                <Inbox className="w-10 h-10 text-gray-300" />
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
                >
                  <RotateCcw size={12} /> Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW */}
              <div className="hidden md:block w-full align-middle">
                <table className="w-full text-left">
                  <thead className="bg-white sticky top-0 z-10 border-b border-gray-100">
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-400 font-bold">
                      <th className="px-6 py-4 font-bold">Requestor</th>
                      <th className="px-6 py-4 font-bold">Reference / Memo</th>
                      <th className="px-6 py-4 text-center">Hours</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Submitted</th>
                      <th className="px-6 py-4">Dates Covered</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-50">
                    {isLoading
                      ? [...Array(8)].map((_, i) => (
                          <tr key={i}>
                            {[...Array(7)].map((__, j) => (
                              <td key={j} className="px-6 py-4">
                                <Skeleton />
                              </td>
                            ))}
                          </tr>
                        ))
                      : applications.map((app, i) => (
                          <tr
                            key={app._id}
                            className={`group hover:bg-gray-50/80 transition-colors ${
                              i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900 text-sm">
                                  {app?.employee?.firstName || ""}{" "}
                                  {app?.employee?.lastName || ""}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                                  {app?.employee?.position || ""}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900 text-sm">
                                  {Array.isArray(app.memo) && app.memo.length
                                    ? app.memo
                                        .map((m) => m?.memoId?.memoNo)
                                        .join(", ")
                                    : "No Memo Attached"}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                                  ID:{" "}
                                  {app._id
                                    ? app._id.slice(-6).toUpperCase()
                                    : "-"}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200">
                                {app.requestedHours}h
                              </span>
                            </td>

                            <td className="px-6 py-4 text-center">
                              <StatusBadge status={app.overallStatus} />
                            </td>

                            <td className="px-6 py-4 text-center text-sm text-gray-500">
                              {new Date(app.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </td>

                            <td className="px-6 py-4 text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-gray-400" />
                                <span>
                                  {app.inclusiveDates
                                    ?.map((d) =>
                                      new Date(d).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      }),
                                    )
                                    .join(", ")}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <ApplicationActionMenu
                                app={app}
                                onViewDetails={() => setSelectedApp(app)}
                                onViewMemos={() => openMemoModal(app.memo)}
                              />
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARD VIEW */}
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
                  : applications.map((app) => (
                      <div
                        key={app._id}
                        onClick={() => setSelectedApp(app)}
                        className={`bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-l-4 ${getStatusColor(
                          app.overallStatus,
                        )} border-y border-r border-gray-100 overflow-hidden active:scale-[0.99] transition-transform`}
                      >
                        <div className="px-4 py-3 flex justify-between items-center border-b border-gray-50">
                          <span className="text-xs font-mono text-gray-400">
                            #{app._id ? app._id.slice(-6).toUpperCase() : "-"}
                          </span>
                          <StatusBadge status={app.overallStatus} />
                        </div>

                        <div className="p-4 space-y-4">
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 mb-1">
                              {Array.isArray(app.memo) && app.memo.length
                                ? app.memo
                                    .map((m) => m?.memoId?.memoNo)
                                    .join(", ")
                                : "No Memo Reference"}
                            </h4>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock size={12} /> Filed on{" "}
                              {new Date(app.createdAt).toLocaleDateString()}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                            <div className="flex-1">
                              <span className="block text-[10px] uppercase font-bold text-gray-400">
                                Total Hours
                              </span>
                              <span className="text-sm font-bold text-gray-900">
                                {app.requestedHours} hrs
                              </span>
                            </div>
                            <div className="w-px h-6 bg-gray-200"></div>
                            <div className="flex-1 pl-2">
                              <span className="block text-[10px] uppercase font-bold text-gray-400">
                                Dates
                              </span>
                              <span className="text-xs font-medium text-gray-700 truncate block">
                                {app.inclusiveDates?.length || 0} day(s)
                                selected
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openMemoModal(app.memo);
                            }}
                            className="py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
                          >
                            <FileText size={14} /> Memos
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedApp(app);
                            }}
                            className="py-3 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2"
                          >
                            <Info size={14} /> Details
                          </button>
                        </div>
                      </div>
                    ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination (NEW: same compact design as CTO Credit) */}
        <CompactPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          startItem={startItem}
          endItem={endItem}
          label="applications"
          onPrev={() => setPage((p) => Math.max(p - 1, 1))}
          onNext={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
        />
      </div>

      {/* Selected application details modal */}
      {selectedApp && (
        <Modal
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          title="CTO Application Details"
        >
          <CtoApplicationDetails app={selectedApp} loading={!selectedApp} />
        </Modal>
      )}

      {/* Memos modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={closeMemoModal}
        title="Memos Used"
        closeLabel="Close"
      >
        <MemoList
          memos={memoModal.memos}
          description={"Read-only view of CTO memos attached to this request."}
        />
      </Modal>
    </div>
  );
};

export default AllCtoApplicationsHistory;
