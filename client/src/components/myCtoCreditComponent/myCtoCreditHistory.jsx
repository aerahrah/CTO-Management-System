import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyCreditRequests } from "../../api/cto";
import { StatusBadge } from "../statusUtils";
import Modal from "../modal";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Clipboard,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  Inbox,
} from "lucide-react";
import FilterSelect from "../filterSelect";

const statusOptions = ["ACTIVE", "EXHAUSTED", "ROLLEDBACK"];
const pageSizeOptions = [20, 50, 100];

const MyCtoCreditHistory = () => {
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });

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
    queryKey: ["myCredits", page, limit, statusFilter, searchFilter],
    queryFn: () =>
      fetchMyCreditRequests({
        page,
        limit,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      }),
    keepPreviousData: true,
  });

  const credits = useMemo(() => data?.credits || [], [data]);

  const total = data?.total || 0;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(page * limit, total);

  const formatDuration = (d) =>
    d ? `${d.hours || 0}h ${d.minutes || 0}m` : "-";

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const isFiltered = statusFilter !== "" || searchFilter !== "";

  return (
    <div className="w-full flex-1 flex h-full flex-col space-y-3">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Clipboard className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              My CTO Credit History
            </h1>
            <p className="text-xs md:text-sm text-gray-500">
              View your credited and rolled back CTO hours
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
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>

              {/* Desktop Filters */}
              <div className="hidden md:flex items-center gap-4 border-l pl-4 border-gray-300 ml-auto">
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

        {/* ================= TABLE ================= */}
        <div className="h-full flex flex-col overflow-y-auto min-h-0 bg-white">
          {!isLoading && credits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <Inbox className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-bold text-gray-900">
                No Credit History Found
              </h3>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="mt-4 text-sm font-bold text-blue-600 underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full table-auto border-collapse">
                <thead className="sticky top-0 bg-gray-100 z-10 text-[11px] uppercase tracking-[0.1em] text-gray-600 font-bold">
                  <tr>
                    <th className="px-6 py-4 border border-gray-300 text-left">
                      Memo No.
                    </th>
                    <th className="px-6 py-4 border border-gray-300 text-center">
                      Duration
                    </th>
                    <th className="px-6 py-4 border border-gray-300 text-center">
                      Status
                    </th>
                    <th className="px-4 py-4 border border-gray-300 text-center w-32">
                      Memo
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading
                    ? [...Array(limit)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(4)].map((__, j) => (
                            <td
                              key={j}
                              className="px-6 py-3 border border-gray-300"
                            >
                              <Skeleton />
                            </td>
                          ))}
                        </tr>
                      ))
                    : credits.map((credit, i) => (
                        <tr
                          key={credit._id}
                          className={`transition group hover:bg-blue-50/40 ${
                            i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="px-6 py-3 border border-gray-300 font-medium text-gray-900">
                            {credit.memoNo}
                          </td>
                          <td className="px-6 py-3 border border-gray-300 text-center text-gray-600">
                            {formatDuration(credit.duration)}
                          </td>
                          <td className="px-6 py-3 border border-gray-300 text-center">
                            <StatusBadge status={credit.employeeStatus} />
                          </td>
                          <td className="px-4 py-4 border border-gray-300 text-center">
                            <button
                              onClick={() =>
                                setMemoModal({ isOpen: true, memo: credit })
                              }
                              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider"
                            >
                              View Memo
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ================= PAGINATION ================= */}
        <div className="px-4 md:px-8 py-3 border-t border-gray-300 bg-white flex items-center justify-between">
          <div className="text-xs md:text-sm text-gray-500">
            Showing{" "}
            <span className="font-bold text-gray-900">
              {startItem}-{endItem}
            </span>{" "}
            of <span className="font-bold text-gray-900">{total}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-xs font-medium text-gray-500 uppercase tracking-tighter">
              Page {page} / {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1 || total === 0}
                className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages || total === 0}
                className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MEMO MODAL ================= */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memo: null })}
        title={`Memo: ${memoModal.memo?.memoNo || ""}`}
        closeLabel="Close"
      >
        {memoModal.memo?.uploadedMemo?.endsWith(".pdf") ? (
          <iframe
            src={`http://localhost:3000/${memoModal.memo.uploadedMemo.replace(
              /\\/g,
              "/",
            )}`}
            className="w-full h-96 border rounded"
            title="Memo Preview"
          />
        ) : (
          <div className="w-full h-96 flex items-center justify-center bg-gray-50 border rounded text-gray-400">
            No preview available for this file type.
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyCtoCreditHistory;
