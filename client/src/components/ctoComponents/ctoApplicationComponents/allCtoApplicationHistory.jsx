import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "../../statusUtils";
import { fetchAllCtoApplications } from "../../../api/cto";
import Modal from "../../modal";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import MemoList from "../ctoMemoModal";
import {
  Clipboard,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  Filter,
  X,
  RotateCcw,
  Clock,
  Calendar,
  FileText,
  Info,
  Inbox,
  MoreVertical,
} from "lucide-react";
import FilterSelect from "../../filterSelect";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";

const statusOptions = ["PENDING", "APPROVED", "REJECTED"];
const pageSizeOptions = [20, 50, 100];

const ApplicationActionMenu = ({ app, onViewDetails, onViewMemos }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handle = (cb) => {
    cb();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex justify-end" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((o) => !o);
        }}
        className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800"
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
            className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-40"
          >
            <FileText size={14} /> View Memos
          </button>
        </div>
      )}
    </div>
  );
};

const AllCtoApplicationsHistory = () => {
  const [selectedApp, setSelectedApp] = useState(null);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

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

  const startItem = (pagination.page - 1) * limit + 1;
  const endItem = Math.min(pagination.page * limit, pagination.total);

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

  return (
    <div className="w-full flex-1 flex h-full flex-col space-y-3 md:p-0">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Clipboard className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              All CTO Applications
            </h1>
            <p className="text-xs md:text-sm text-gray-500">
              View and manage all compensatory time-off applications
            </p>
          </div>
        </div>
      </div>

      {/* ================= MAIN CARD ================= */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-300 flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ================= FILTER BAR ================= */}
        <div className="p-2 md:p-3 border-b border-gray-300 bg-white">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {/* Search Box */}
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500" />
                <input
                  type="text"
                  placeholder="Search memo..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm outline-none transition-all"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Desktop Filters Group */}
              <div className="hidden md:flex items-center gap-4 border-l pl-4 border-gray-300">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <FilterSelect
                    label=""
                    value={statusFilter || "All Status"}
                    onChange={(v) => {
                      setStatusFilter(v === "All Status" ? "" : v);
                      setPage(1);
                    }}
                    options={["All Status", ...statusOptions]}
                    className="!mb-0 min-w-[140px]"
                  />
                </div>
                <div className="flex items-center gap-2">
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
                    className="!mb-0 w-20"
                  />
                </div>
              </div>

              {/* Mobile Rows Toggle - Swapped native select for FilterSelect */}
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
                  className="!mb-0 20-16 text-xs"
                />
              </div>
            </div>

            {/* Mobile Horizontal Status Filter */}
            <div className="md:hidden flex overflow-x-auto pb-1 gap-2 scrollbar-hide">
              {["All Status", ...statusOptions].map((opt) => {
                const isSelected =
                  (opt === "All Status" && !statusFilter) ||
                  statusFilter === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      setStatusFilter(opt === "All Status" ? "" : opt);
                      setPage(1);
                    }}
                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                        : "bg-white border-gray-200 text-gray-600 active:bg-gray-100"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* Active Filters Summary */}
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
        </div>

        {/* ================= CONTENT AREA ================= */}
        <div className="h-full flex flex-col overflow-y-auto min-h-0 bg-gray-50 md:bg-white">
          {/* No Results found logic */}
          {!isLoading && applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <Inbox className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                No Applications Found
              </h3>
              <p className="text-sm text-gray-500 max-w-xs mt-1">
                We couldn't find any CTO applications matching your current
                filters or search criteria.
              </p>
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
              {/* DESKTOP TABLE VIEW */}
              <div className="hidden md:block">
                <table className="w-full table-auto border-collapse">
                  <thead className="sticky top-0 bg-gray-100 z-10 text-[11px] uppercase tracking-[0.1em] text-gray-600 font-bold">
                    <tr>
                      <th className="px-6 py-4 border border-gray-300 text-left">
                        Requestor
                      </th>
                      <th className="px-6 py-4 border border-gray-300 text-left">
                        Memo No.
                      </th>
                      <th className="px-6 py-4 border border-gray-300 text-center">
                        Requested Hours
                      </th>
                      <th className="px-6 py-4 border border-gray-300 text-center">
                        Status
                      </th>
                      <th className="px-6 py-4 border border-gray-300 text-center">
                        Submitted
                      </th>
                      <th className="px-6 py-4 border border-gray-300 text-center">
                        Inclusive Dates
                      </th>

                      <th className="px-6 py-4 border border-gray-300 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading
                      ? [...Array(8)].map((_, i) => (
                          <tr key={i}>
                            {[...Array(7)].map((__, j) => (
                              <td
                                key={j}
                                className="px-6 py-4 border border-gray-300"
                              >
                                <Skeleton />
                              </td>
                            ))}
                          </tr>
                        ))
                      : applications.map((app, index) => (
                          <tr
                            key={app._id}
                            className={`transition group hover:bg-blue-50/40 ${
                              index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                            }`}
                          >
                            <td className="px-6 py-3 border border-gray-300 text-center text-gray-600">
                              {app?.employee?.firstName}{" "}
                              {app?.employee?.lastName}
                            </td>
                            <td className="px-6 py-3 border border-gray-300 font-medium text-gray-900">
                              {Array.isArray(app.memo) && app.memo.length
                                ? app.memo
                                    .map((m) => m?.memoId?.memoNo)
                                    .join(", ")
                                : "-"}
                            </td>
                            <td className="px-6 py-3 border border-gray-300 text-center text-gray-600">
                              {app.requestedHours}
                            </td>
                            <td className="px-6 py-3 border border-gray-300 text-center">
                              <StatusBadge status={app.overallStatus} />
                            </td>
                            <td className="px-6 py-3 border border-gray-300 text-center text-gray-600">
                              {new Date(app.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                },
                              )}
                            </td>
                            <td className="px-6 py-3 border border-gray-300 text-center text-gray-600 text-xs">
                              {app.inclusiveDates
                                ?.map((d) =>
                                  new Date(d).toLocaleDateString("en-US"),
                                )
                                .join(", ")}
                            </td>
                            <td className="px-6 py-3 border border-gray-300 text-right">
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
              <div className="md:hidden flex flex-col p-4 gap-4">
                {isLoading
                  ? [...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 space-y-3"
                      >
                        <Skeleton count={3} />
                      </div>
                    ))
                  : applications.map((app) => (
                      <div
                        key={app._id}
                        className={`bg-white rounded-xl shadow-sm border-l-4 ${getStatusColor(
                          app.overallStatus,
                        )} border-y border-r border-gray-200 transition-all active:scale-[0.98]`}
                      >
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">
                                Memo Reference
                              </span>
                              <span className="text-sm font-bold text-gray-900">
                                {Array.isArray(app.memo) && app.memo.length
                                  ? app.memo
                                      .map((m) => m?.memoId?.memoNo)
                                      .join(", ")
                                  : "No Memo"}
                              </span>
                            </div>
                            <StatusBadge status={app.overallStatus} />
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-4 bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white rounded-md">
                                <Clock size={14} className="text-blue-500" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] text-gray-400 font-bold uppercase">
                                  Hours
                                </span>
                                <span className="text-sm font-bold text-gray-700">
                                  {app.requestedHours} hrs
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white rounded-md">
                                <Calendar size={14} className="text-blue-500" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] text-gray-400 font-bold uppercase">
                                  Filed On
                                </span>
                                <span className="text-sm font-bold text-gray-700">
                                  {new Date(app.createdAt).toLocaleDateString(
                                    "en-US",
                                    { month: "short", day: "numeric" },
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                            <button
                              onClick={() => openMemoModal(app.memo)}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold"
                            >
                              <FileText size={14} /> Memos
                            </button>
                            <button
                              onClick={() => setSelectedApp(app)}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
                            >
                              <Info size={14} /> Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
              </div>
            </>
          )}
        </div>

        {/* ================= COMPACT PAGINATION ================= */}
        <div className="px-4 md:px-8 py-3 border-t border-gray-300 bg-white flex items-center justify-between">
          <div className="text-xs md:text-sm text-gray-500">
            Showing{" "}
            <span className="font-bold text-gray-900">
              {startItem}-{endItem}
            </span>{" "}
            of{" "}
            <span className="font-bold text-gray-900">{pagination.total}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-xs font-medium text-gray-500 uppercase tracking-tighter">
              Page {pagination.page} / {pagination.totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={pagination.page === 1 || pagination.total === 0}
                className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setPage((p) => Math.min(p + 1, pagination.totalPages))
                }
                disabled={
                  pagination.page >= pagination.totalPages ||
                  pagination.total === 0
                }
                className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}
      {selectedApp && (
        <Modal
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          title="CTO Application Details"
        >
          <CtoApplicationDetails app={selectedApp} loading={!selectedApp} />
        </Modal>
      )}

      <Modal
        isOpen={memoModal.isOpen}
        onClose={closeMemoModal}
        title="Memos Used"
        closeLabel="Close"
      >
        <div className="h-[calc(100vh-12rem)] overflow-y-auto p-1">
          {/* Info Banner */}

          {/* Memo List */}
          <MemoList
            memos={memoModal.memos}
            description={
              "Read-only view of CTO memos attached to this request."
            }
          />
        </div>
      </Modal>
    </div>
  );
};

export default AllCtoApplicationsHistory;
