import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllCreditRequests, rollbackCreditCto } from "../../../api/cto";
import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";
import {
  Clipboard,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Inbox,
  Layers,
  CheckCircle2,
  MoreVertical,
  Eye,
  Users,
  Calendar,
  Clock,
  FileText,
} from "lucide-react";
import FilterSelect from "../../filterSelect";
import AddCtoCreditForm from "./forms/addCtoCreditForm";
import CtoCreditDetails from "./ctoCreditfullDetails";

const pageSizeOptions = [20, 50, 100];

/* ------------------ Small Breadcrumbs-like header (keeps style parity) ------------------ */
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
    <span className="text-blue-600">CTO Credits</span>
  </div>
);

const getStatusTabs = (statusCounts = {}) => [
  {
    id: "",
    label: "All Credits",
    icon: Layers,
    count: statusCounts.total || 0,
    activeColor: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    id: "CREDITED",
    label: "Credited",
    icon: CheckCircle2,
    count: statusCounts.credited || 0,
    activeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    id: "ROLLEDBACK",
    label: "Rolled Back",
    icon: RotateCcw,
    count: statusCounts.rolledBack || 0,
    activeColor: "bg-rose-100 text-rose-700 border-rose-200",
  },
];

/* ------------------ Action Menu (unchanged logic; safe for cards/table) ------------------ */
const ActionMenu = ({
  credit,
  onViewMemo,
  onViewDetails,
  onRollback,
  isPending,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handle = (cb) => {
    cb?.();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex justify-center" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((o) => !o);
        }}
        className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Actions"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
          <button
            onClick={() => handle(onViewMemo)}
            className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Eye size={14} /> View Memo
          </button>

          <button
            onClick={() => handle(onViewDetails)}
            className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Clipboard size={14} /> View Details
          </button>

          <div className="h-px bg-gray-100 my-1" />

          <button
            disabled={credit.status !== "CREDITED" || isPending}
            onClick={() => handle(onRollback)}
            className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-30"
          >
            <RotateCcw size={14} /> Rollback
          </button>
        </div>
      )}
    </div>
  );
};

/* ------------------ Mobile/Tablet Card Row ------------------ */
const CreditCard = ({
  credit,
  isPending,
  onViewMemo,
  onViewDetails,
  onRollback,
  formatDuration,
  formatDate,
}) => {
  const employeesLabel = useMemo(() => {
    const names =
      credit?.employees?.map((e) =>
        `${e.employee?.firstName || ""} ${e.employee?.lastName || ""}`.trim(),
      ) || [];
    const joined = names.filter(Boolean).join(", ");
    return joined || "-";
  }, [credit]);

  const shortId = credit?._id ? credit._id.slice(-6).toUpperCase() : "-";

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Top */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900 truncate">
                {credit.memoNo || "-"}
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                #{shortId}
              </span>
            </div>

            <div className="mt-2 flex items-start gap-2">
              <Users className="w-4 h-4 text-gray-400 mt-[2px] flex-none" />
              <div className="text-xs text-gray-700 leading-snug line-clamp-2">
                {employeesLabel}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 flex-none">
            <StatusBadge status={credit.status} />
            <ActionMenu
              credit={credit}
              isPending={isPending}
              onViewMemo={onViewMemo}
              onViewDetails={onViewDetails}
              onRollback={onRollback}
            />
          </div>
        </div>

        {/* Meta grid */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              <Clock className="w-3.5 h-3.5" /> Duration
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {formatDuration(credit.duration)}
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              <Calendar className="w-3.5 h-3.5" /> Approved
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {formatDate(credit.dateApproved)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar (bigger tap targets) */}
      <div className="border-t border-gray-100 bg-white p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onViewMemo}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
          >
            <FileText className="w-4 h-4" />
            Memo
          </button>

          <button
            onClick={onViewDetails}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border border-gray-200 bg-white hover:bg-gray-50 text-blue-600"
          >
            <Clipboard className="w-4 h-4" />
            Details
          </button>

          <button
            disabled={credit.status !== "CREDITED" || isPending}
            onClick={onRollback}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-30"
            title={
              credit.status !== "CREDITED"
                ? "Only credited items can be rolled back"
                : "Rollback"
            }
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Rollback</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------ Compact Pagination (better on mobile/tablet) ------------------ */
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
    <div className="px-4 md:px-6 py-3 border-t border-gray-100 bg-white">
      {/* Mobile/tablet: compact */}
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
            {total === 0 ? "0 results" : `${startItem}-${endItem} of ${total}`}
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

      {/* Desktop: keep original layout style */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div className="text-xs text-gray-500 font-medium">
          Showing{" "}
          <span className="font-bold text-gray-900">
            {total === 0 ? 0 : `${startItem}-${endItem}`}
          </span>{" "}
          of <span className="font-bold text-gray-900">{total}</span> credits
        </div>

        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
          <button
            onClick={onPrev}
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all text-gray-600"
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
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------ Main Component ------------------ */
const CtoCreditHistory = () => {
  const queryClient = useQueryClient();
  const formRef = useRef(null);

  // States
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal States
  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });
  const [isAddCtoOpen, setIsAddCtoOpen] = useState(false);
  const [isConfirmRollback, setIsConfirmRollback] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState(null);
  const [detailsModal, setDetailsModal] = useState({
    isOpen: false,
    credit: null,
  });

  /* ---------------- SEARCH DEBOUNCE ---------------- */
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchFilter(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  /* ---------------- FETCH DATA ---------------- */
  const { data, isLoading } = useQuery({
    queryKey: ["allCredits", page, limit, statusFilter, searchFilter],
    queryFn: () =>
      fetchAllCreditRequests({
        page,
        limit,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      }),
    keepPreviousData: true,
  });

  const credits = useMemo(() => data?.credits || [], [data]);

  const pagination = useMemo(
    () => ({
      page: data?.page || 1,
      totalPages: Math.max(Math.ceil((data?.total || 0) / limit), 1),
      total: data?.total || 0,
    }),
    [data, limit],
  );

  // keep page within range if filters reduce results
  useEffect(() => {
    setPage((p) => {
      if (p > pagination.totalPages) return pagination.totalPages;
      if (p < 1) return 1;
      return p;
    });
  }, [pagination.totalPages]);

  /* ---------------- MUTATION ---------------- */
  const { mutate: rollbackRequest, isPending } = useMutation({
    mutationFn: rollbackCreditCto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allCredits"] });
      setIsConfirmRollback(false);
      toast.success("CTO credit successfully rolled back!");
    },
    onError: (error) => {
      setIsConfirmRollback(false);
      toast.error(
        error?.response?.data?.message || error?.message || "Rollback failed.",
      );
    },
  });

  const formatDuration = useCallback(
    (d) => (d ? `${d.hours || 0}h ${d.minutes || 0}m` : "-"),
    [],
  );

  const formatDate = useCallback(
    (iso) =>
      iso
        ? new Date(iso).toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "-",
    [],
  );

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const isFiltered = statusFilter !== "" || searchFilter !== "";

  const startItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * limit + 1;
  const endItem =
    pagination.total === 0
      ? 0
      : Math.min(pagination.page * limit, pagination.total);

  const grandTotals = useMemo(() => {
    const credited = data?.grandTotals?.credited || 0;
    const rolledBack = data?.grandTotals?.rolledBack || 0;
    return {
      credited,
      rolledBack,
      total: credited + rolledBack,
    };
  }, [data]);

  /* ---------------- RENDER ---------------- */
  return (
    <div className="w-full flex-1 flex h-full flex-col md:p-0">
      {/* HEADER */}
      <div className="pt-2 pb-6 px-1">
        {/* <Breadcrumbs /> */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight font-sans">
                CTO Credit History
              </h1>
              <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                Manage and monitor CTO credits issued to employees
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddCtoOpen(true)}
            className="group relative inline-flex items-center gap-2 justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900 w-full md:w-auto"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            Credit CTO
          </button>
        </div>
      </div>

      {/* MAIN CARD */}
      <div className="flex flex-col flex-1 min-h-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* TOOLBAR */}
        <div className="p-4 border-b border-gray-100 bg-white space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
              {getStatusTabs(grandTotals).map((tab) => {
                const isActive = statusFilter === tab.id;
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
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

            {/* Right: search + rows */}
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
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                    title="Clear"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>

              {/* Rows desktop */}
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

              {/* Rows tablet/mobile */}
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
                className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase hover:text-blue-700"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          )}
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto bg-white min-h-[300px]">
          {/* Empty state */}
          {!isLoading && credits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
              <div className="bg-gray-50 p-6 rounded-full mb-4 ring-1 ring-gray-100">
                <Inbox className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                No Credit History Found
              </h3>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-700 underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile + Tablet: card list */}
              <div className="block lg:hidden p-4">
                <div className="space-y-3">
                  {(isLoading || isPending
                    ? [...Array(Math.min(limit, 6))]
                    : credits
                  ).map((credit, idx) => {
                    if (isLoading || isPending) {
                      return (
                        <div
                          key={`sk-${idx}`}
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
                          <div className="mt-4 flex gap-2">
                            <Skeleton height={40} width={"100%"} />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <CreditCard
                        key={credit._id}
                        credit={credit}
                        isPending={isPending}
                        formatDuration={formatDuration}
                        formatDate={formatDate}
                        onViewMemo={() =>
                          setMemoModal({ isOpen: true, memo: credit })
                        }
                        onViewDetails={() =>
                          setDetailsModal({ isOpen: true, credit })
                        }
                        onRollback={() => {
                          setSelectedCreditId(credit._id);
                          setIsConfirmRollback(true);
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Desktop: keep table */}
              <div className="hidden lg:block overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-white sticky top-0 z-10 border-b border-gray-100">
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-400 font-bold">
                      <th className="px-6 py-4 font-bold">Employees</th>
                      <th className="px-6 py-4 font-bold">Memo No.</th>
                      <th className="px-6 py-4 text-center">Duration</th>
                      <th className="px-6 py-4 text-center">Date Approved</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-50">
                    {isLoading || isPending
                      ? [...Array(limit)].map((_, i) => (
                          <tr key={i}>
                            {[...Array(6)].map((__, j) => (
                              <td key={j} className="px-6 py-4">
                                <Skeleton />
                              </td>
                            ))}
                          </tr>
                        ))
                      : credits.map((credit, i) => (
                          <tr
                            key={credit._id}
                            className={`group hover:bg-gray-50/80 transition-colors ${
                              i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900 text-sm">
                                  {credit.employees
                                    .map(
                                      (e) =>
                                        `${e.employee?.firstName || ""} ${e.employee?.lastName || ""}`,
                                    )
                                    .join(", ")}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                                  {credit._id
                                    ? credit._id.slice(-6).toUpperCase()
                                    : "-"}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4 font-medium text-gray-900">
                              {credit.memoNo}
                            </td>

                            <td className="px-6 py-4 text-center text-gray-600">
                              {formatDuration(credit.duration)}
                            </td>

                            <td className="px-6 py-4 text-center text-gray-600">
                              {formatDate(credit.dateApproved)}
                            </td>

                            <td className="px-6 py-4 text-center">
                              <StatusBadge status={credit.status} />
                            </td>

                            <td className="px-6 py-4 text-right">
                              <ActionMenu
                                credit={credit}
                                isPending={isPending}
                                onViewMemo={() =>
                                  setMemoModal({ isOpen: true, memo: credit })
                                }
                                onViewDetails={() =>
                                  setDetailsModal({ isOpen: true, credit })
                                }
                                onRollback={() => {
                                  setSelectedCreditId(credit._id);
                                  setIsConfirmRollback(true);
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* PAGINATION (improved mobile/tablet height) */}
        <CompactPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          startItem={startItem}
          endItem={endItem}
          onPrev={() => setPage((p) => Math.max(p - 1, 1))}
          onNext={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
        />
      </div>

      {/* Rollback Confirmation Modal */}
      <Modal
        isOpen={isConfirmRollback}
        onClose={() => setIsConfirmRollback(false)}
        title="Confirm Rollback"
        action={{
          label: "Confirm Rollback",
          variant: "delete",
          show: true,
          onClick: () => rollbackRequest(selectedCreditId),
        }}
        closeLabel="Cancel"
      >
        <p className="py-2 text-gray-700">
          Are you sure you want to rollback this CTO credit? This action will
          deduct the credited hours from the respective employees&apos;
          balances.
        </p>
      </Modal>

      {/* Memo modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memo: null })}
        title={`Memo: ${memoModal.memo?.memoNo || ""}`}
        closeLabel="Close"
      >
        {memoModal.memo?.uploadedMemo?.endsWith?.(".pdf") ? (
          <iframe
            src={`http://localhost:3000/${String(
              memoModal.memo.uploadedMemo,
            ).replace(/\\/g, "/")}`}
            className="w-full h-96 border rounded"
            title="Memo Preview"
          />
        ) : (
          <div className="w-full h-96 flex items-center justify-center bg-gray-50 border rounded text-gray-400">
            No preview available for this file type.
          </div>
        )}
      </Modal>

      {/* Details modal */}
      <Modal
        isOpen={detailsModal.isOpen}
        onClose={() => setDetailsModal((prev) => ({ ...prev, isOpen: false }))}
        title="CTO Credit Details"
        maxWidth="max-w-4xl"
      >
        <CtoCreditDetails credit={detailsModal.credit} />
      </Modal>

      {/* Add CTO Credit modal */}
      <Modal
        isOpen={isAddCtoOpen}
        onClose={() => {
          setIsAddCtoOpen(false);
          setIsSubmitting(false);
        }}
        action={{
          label: isSubmitting ? "Saving..." : "Save",
          variant: "save",
          show: true,
          disabled: isSubmitting,
          onClick: () => {
            if (!formRef.current || formRef.current.isPending) return;
            setIsSubmitting(true);
            formRef.current.submit();
          },
        }}
      >
        <div className="w-full max-w-lg">
          <AddCtoCreditForm
            ref={formRef}
            onClose={() => setIsAddCtoOpen(false)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default CtoCreditHistory;
