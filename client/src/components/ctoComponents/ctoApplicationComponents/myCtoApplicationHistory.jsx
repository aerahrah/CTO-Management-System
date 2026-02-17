import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "../../statusUtils";
import {
  fetchMyCtoApplications,
  fetchMyCreditRequests,
  cancelCtoApplicationRequest,
} from "../../../api/cto";
import Modal from "../../modal";
import Skeleton from "react-loading-skeleton";
import Breadcrumbs from "../../breadCrumbs";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  Filter,
  RotateCcw,
  Clock,
  Calendar,
  FileText,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LayoutGrid,
  Layers,
  Ban,
  Info,
} from "lucide-react";
import FilterSelect from "../../filterSelect";
import AddCtoApplicationForm from "./forms/addCtoApplicationForm";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";
import MemoList from "../ctoMemoModal";
import { toast } from "react-toastify";

const pageSizeOptions = [20, 50, 100];

const fmtHours = (h) => {
  const n = Number(h ?? 0);
  return Number.isFinite(n)
    ? Number.isInteger(n)
      ? String(n)
      : n.toFixed(2)
    : "0";
};

/* =========================
   Balance Card (1 card)
========================= */
const BalanceHoursCard = ({ hours, loading }) => {
  const showValue =
    hours === null || hours === undefined ? "0h" : `${fmtHours(hours)}h`;

  return (
    <div className="w-full bg-white/90 border border-gray-200 rounded-lg px-4 py-1.5 flex items-center gap-3 shadow-xs">
      <div className="p-2 rounded-lg bg-blue-50 text-blue-600 flex-none">
        <Layers className="w-5 h-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-widest font-bold text-gray-400 truncate">
          Balance Hours
        </div>

        <div className="flex items-center gap-3">
          <div className="leading-tight text-[15px] sm:text-base font-extrabold text-blue-700 truncate">
            {loading ? <Skeleton width={70} /> : showValue}
          </div>
        </div>
      </div>
    </div>
  );
};

const ApplicationActionMenu = ({
  app,
  onViewDetails,
  onViewMemos,
  onCancel,
  cancelling,
}) => {
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

  const canCancel =
    String(app?.overallStatus || "").toUpperCase() === "PENDING";

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
            disabled={!app.memo || app.memo.length === 0}
            onClick={() => handle(onViewMemos)}
            className="w-full px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
            type="button"
          >
            <FileText size={14} /> View Memos
          </button>

          <button
            disabled={!canCancel || cancelling}
            onClick={() => handle(onCancel)}
            className="w-full px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
            type="button"
            title={
              !canCancel ? "Only PENDING applications can be cancelled" : ""
            }
          >
            <Ban size={14} /> {cancelling ? "Cancelling..." : "Cancel Request"}
          </button>
        </div>
      )}
    </div>
  );
};

/* =========================
   Card view (same “viewpoint” as MyCtoCreditHistory)
   - Mobile: list (1 per row)
   - Tablet: grid-cols-2
   - Desktop: table at lg+
========================= */
const ApplicationCard = ({
  app,
  leftStripClassName,
  onViewDetails,
  onViewMemos,
  onCancel,
  cancelling,
}) => {
  const canCancel =
    String(app?.overallStatus || "").toUpperCase() === "PENDING";

  const memoLabel =
    Array.isArray(app?.memo) && app.memo.length
      ? app.memo
          .map((m) => m?.memoId?.memoNo)
          .filter(Boolean)
          .join(", ")
      : "No Memo Reference";

  const submittedLabel = app?.createdAt
    ? new Date(app.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

  const coveredCount = Array.isArray(app?.inclusiveDates)
    ? app.inclusiveDates.length
    : 0;

  return (
    <div
      className={`bg-white rounded-xl shadow-sm overflow-hidden border-y border-r border-gray-200 ${leftStripClassName}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900 truncate">
                {memoLabel || "No Memo Reference"}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="truncate">{submittedLabel}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 flex-none">
            <StatusBadge status={app?.overallStatus} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              <Clock className="w-3.5 h-3.5" /> Hours
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {typeof app?.requestedHours === "number"
                ? `${app.requestedHours}h`
                : `${Number(app?.requestedHours || 0)}h`}
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              <Layers className="w-3.5 h-3.5" /> Covered
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {coveredCount} day(s)
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 bg-white p-3">
        <div
          className={`grid gap-2 ${canCancel ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <button
            onClick={onViewMemos}
            disabled={!app?.memo || app.memo.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            type="button"
          >
            <FileText className="w-4 h-4" />
            Memos
          </button>

          <button
            onClick={onViewDetails}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border border-gray-200 bg-white hover:bg-gray-50 text-blue-600"
            type="button"
          >
            <Eye className="w-4 h-4" />
            Details
          </button>

          {canCancel && (
            <button
              onClick={onCancel}
              disabled={cancelling}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
              type="button"
            >
              <Ban className="w-4 h-4" />
              {cancelling ? "Cancelling..." : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
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
  label = "items",
}) => (
  <div className="px-4 md:px-6 py-3 border-t border-gray-100 bg-white">
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

const MyCtoApplications = () => {
  const queryClient = useQueryClient();

  const [selectedApp, setSelectedApp] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // ✅ cancel confirm modal state
  const [cancelModal, setCancelModal] = useState({ isOpen: false, app: null });
  const openCancelModal = (app) => setCancelModal({ isOpen: true, app });
  const closeCancelModal = () => setCancelModal({ isOpen: false, app: null });

  // ✅ status-colored left strip for cards
  const getStatusColor = useCallback((status) => {
    switch (String(status || "").toUpperCase()) {
      case "APPROVED":
        return "border-l-4 border-l-emerald-500";
      case "REJECTED":
        return "border-l-4 border-l-rose-500";
      case "PENDING":
        return "border-l-4 border-l-amber-500";
      case "CANCELLED":
        return "border-l-4 border-l-slate-400";
      default:
        return "border-l-4 border-l-slate-300";
    }
  }, []);

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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ctoApplications", page, limit, statusFilter, searchFilter],
    queryFn: () =>
      fetchMyCtoApplications({
        page,
        limit,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const {
    data: creditSummaryData,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ["myCtoBalanceHours"],
    queryFn: () => fetchMyCreditRequests({ page: 1, limit: 1 }),
    staleTime: 1000 * 60,
  });

  const cancelMutation = useMutation({
    mutationFn: (applicationId) => cancelCtoApplicationRequest(applicationId),
    onSuccess: (payload) => {
      toast.success("Application cancelled.");

      const updatedApp = payload?.application ?? payload?.data ?? payload;
      if (updatedApp?._id && selectedApp?._id === updatedApp._id) {
        setSelectedApp(updatedApp);
      }

      closeCancelModal();

      queryClient.invalidateQueries({ queryKey: ["ctoApplications"] });
      queryClient.invalidateQueries({ queryKey: ["myCtoBalanceHours"] });

      queryClient.refetchQueries({ queryKey: ["ctoApplications"] });
      queryClient.refetchQueries({ queryKey: ["myCtoBalanceHours"] });

      refetch();
      refetchBalance();
    },
    onError: (err) => toast.error(err?.message || "Failed to cancel request."),
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

  // same tab factory as before
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
    {
      id: "CANCELLED",
      label: "Cancelled",
      icon: Ban,
      count: statusCounts.CANCELLED || 0,
      activeColor: "bg-slate-100 text-slate-700 border-slate-200",
    },
  ];

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

  const balanceHours =
    data?.balanceHours ??
    data?.totals?.totalRemainingHours ??
    data?.totals?.remainingHours ??
    creditSummaryData?.totals?.totalRemainingHours ??
    null;

  return (
    <div className="w-full flex-1 flex h-full flex-col md:p-0 bg-gray-50/50">
      {/* HEADER */}
      <div className="pt-2 pb-3 md:pb-6 px-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Breadcrumbs rootLabel="home" rootTo="/app" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight font-sans">
              My Applications
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Browse your Compensatory Time-off history, track status updates,
              and file new requests.
            </p>
          </div>

          <div className="w-full md:w-auto flex flex-row items-stretch md:items-center gap-3 sm:bg-neutral-200/50 sm:p-3 rounded-xl">
            <BalanceHoursCard hours={balanceHours} loading={isBalanceLoading} />

            <button
              onClick={() => setIsFormModalOpen(true)}
              className="group relative inline-flex items-center gap-2 justify-center rounded-lg bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900 w-full"
              type="button"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              New Application
            </button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex flex-col flex-1 min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* TOOLBAR (✅ copied layout from CtoCreditHistory) */}
        <div className="p-4 border-b border-gray-100 bg-white space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {statusTabs(data?.statusCounts || {}).map((tab) => {
                const isActive = statusFilter === tab.id;
                const Icon = tab.icon;

                return (
                  <button
                    type="button"
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

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
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
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                    title="Clear"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>

              <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-gray-200">
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

              <div className="lg:hidden flex items-center gap-1.5 px-2 border-l border-gray-200 ml-1">
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
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase hover:text-blue-700"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          )}
        </div>

        {/* DATA */}
        <div className="flex-1 overflow-y-auto bg-white min-h-[300px]">
          {!isLoading && applications.length === 0 ? (
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
              {/* ✅ Mobile: cards */}
              <div className="block md:hidden p-4">
                <div className="space-y-3">
                  {isLoading
                    ? [...Array(Math.min(limit, 6))].map((_, i) => (
                        <div
                          key={i}
                          className="bg-white border border-gray-200 rounded-xl shadow-sm p-4"
                        >
                          <Skeleton height={18} />
                          <div className="mt-3">
                            <Skeleton height={12} count={2} />
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <Skeleton height={52} />
                            <Skeleton height={52} />
                          </div>
                          <div className="mt-4">
                            <Skeleton height={40} />
                          </div>
                        </div>
                      ))
                    : applications.map((app) => {
                        const cancelling =
                          cancelMutation.isPending &&
                          cancelMutation.variables === app._id;

                        return (
                          <ApplicationCard
                            key={app._id}
                            app={app}
                            leftStripClassName={getStatusColor(
                              app.overallStatus,
                            )}
                            cancelling={cancelling}
                            onViewDetails={() => setSelectedApp(app)}
                            onViewMemos={() => openMemoModal(app.memo)}
                            onCancel={() => openCancelModal(app)}
                          />
                        );
                      })}
                </div>
              </div>

              {/* ✅ Tablet: 2 cards per row */}
              <div className="hidden md:block lg:hidden p-4">
                <div className="grid grid-cols-2 gap-3">
                  {isLoading
                    ? [...Array(Math.min(limit, 6))].map((_, i) => (
                        <div
                          key={i}
                          className="bg-white border border-gray-200 rounded-xl shadow-sm p-4"
                        >
                          <Skeleton height={18} />
                          <div className="mt-3">
                            <Skeleton height={12} count={2} />
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <Skeleton height={52} />
                            <Skeleton height={52} />
                          </div>
                          <div className="mt-4">
                            <Skeleton height={40} />
                          </div>
                        </div>
                      ))
                    : applications.map((app) => {
                        const cancelling =
                          cancelMutation.isPending &&
                          cancelMutation.variables === app._id;

                        return (
                          <ApplicationCard
                            key={app._id}
                            app={app}
                            leftStripClassName={getStatusColor(
                              app.overallStatus,
                            )}
                            cancelling={cancelling}
                            onViewDetails={() => setSelectedApp(app)}
                            onViewMemos={() => openMemoModal(app.memo)}
                            onCancel={() => openCancelModal(app)}
                          />
                        );
                      })}
                </div>
              </div>

              {/* ✅ Desktop: table ONLY at lg+ */}
              <div className="hidden lg:block w-full align-middle">
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
                      : applications.map((app, i) => {
                          const memoLabel =
                            Array.isArray(app.memo) && app.memo.length
                              ? app.memo
                                  .map((m) => m?.memoId?.memoNo)
                                  .filter(Boolean)
                                  .join(", ")
                              : "No Memo Attached";

                          return (
                            <tr
                              key={app._id}
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
                                {formatSubmitted(app.createdAt)}
                              </td>

                              <td className="px-6 py-4 text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                  <Calendar
                                    size={14}
                                    className="text-gray-400"
                                  />
                                  <span>
                                    {formatCoveredDates(app.inclusiveDates)}
                                  </span>
                                </div>
                              </td>

                              <td className="px-6 py-4 text-right">
                                <ApplicationActionMenu
                                  app={app}
                                  onViewDetails={() => setSelectedApp(app)}
                                  onViewMemos={() => openMemoModal(app.memo)}
                                  onCancel={() => openCancelModal(app)}
                                  cancelling={
                                    cancelMutation.isPending &&
                                    cancelMutation.variables === app._id
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

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

      {/* Details Modal */}
      {selectedApp && (
        <Modal
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          title="CTO Application Details"
          maxWidth="max-w-5xl"
        >
          <CtoApplicationDetails app={selectedApp} loading={!selectedApp} />
        </Modal>
      )}

      {/* Cancel Confirm Modal */}
      <Modal
        isOpen={cancelModal.isOpen}
        onClose={closeCancelModal}
        title="Cancel CTO Application"
        maxWidth="max-w-lg"
        preventCloseWhenBusy={true}
        isBusy={cancelMutation.isPending}
        action={{
          show: true,
          variant: "cancel",
          label: cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel",
          onClick: async () => {
            const app = cancelModal.app;
            if (!app?._id) return;

            const status = String(app?.overallStatus || "").toUpperCase();
            if (status !== "PENDING") {
              toast.error("Only PENDING applications can be cancelled.");
              closeCancelModal();
              return;
            }

            await cancelMutation.mutateAsync(app._id);
          },
          disabled: cancelMutation.isPending,
        }}
      >
        <div className="p-2">
          <div className="mb-5 flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="mt-0.5 p-1.5 bg-white rounded-lg border border-slate-200 shadow-sm text-slate-400">
              <Info size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                You are about to cancel this request
              </p>
              <p className="text-sm font-bold text-slate-900 break-words">
                Ref:{" "}
                {cancelModal.app?._id
                  ? `#${cancelModal.app._id.slice(-6).toUpperCase()}`
                  : "-"}
              </p>
            </div>
          </div>

          <div className="text-center py-2">
            <div className="mx-auto h-20 w-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4 border-4 border-rose-100/50 shadow-inner">
              <Ban size={40} strokeWidth={3} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Are you sure you want to cancel this CTO application?
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              This will stop the approval workflow and update your balances
              accordingly.
            </p>
          </div>
        </div>
      </Modal>

      {/* Form Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title="New CTO Application"
        closeLabel={null}
        maxWidth=" max-w-lg"
      >
        <div className="w-full">
          <AddCtoApplicationForm
            onClose={() => setIsFormModalOpen(false)}
            onSuccess={() => {
              setIsFormModalOpen(false);
              refetch();
              refetchBalance();
            }}
          />
        </div>
      </Modal>

      {/* Memo Modal */}
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

export default MyCtoApplications;
