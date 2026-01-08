import { useState, useMemo, useEffect, useRef } from "react";
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
  FileText,
  Filter,
} from "lucide-react";
import FilterSelect from "../filterSelect";

const statusOptions = ["CREDITED", "ROLLEDBACK"];
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

  const pagination = useMemo(
    () => ({
      page: data?.page || 1,
      totalPages: Math.max(Math.ceil((data?.total || 0) / limit), 1),
      total: data?.total || 0,
    }),
    [data, limit]
  );

  const formatDuration = (d) =>
    d ? `${d.hours || 0}h ${d.minutes || 0}m` : "-";
  const startItem = (pagination.page - 1) * limit + 1;
  const endItem = Math.min(pagination.page * limit, pagination.total);

  return (
    <div className="w-full flex flex-col h-full space-y-4">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Clipboard className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              My CTO Credit History
            </h1>
            <p className="text-sm text-gray-500">
              View and manage your compensatory time-off credits
            </p>
          </div>
        </div>
      </div>

      {/* ================= MAIN CARD ================= */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-300 flex flex-col flex-1 min-h-0">
        {/* ================= FILTER BAR ================= */}
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[300px] bg-white">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search memo number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-3 ml-auto">
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
            <FilterSelect
              label=""
              value={limit}
              onChange={(v) => {
                setLimit(v);
                setPage(1);
              }}
              options={pageSizeOptions}
              className="!mb-0"
            />
          </div>
        </div>

        {/* ================= TABLE ================= */}
        <div className="overflow-auto flex-1">
          <table className="w-full table-auto">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-xs uppercase tracking-wider text-gray-600">
                <th className="px-8 py-4">Memo No.</th>
                <th className="px-8 py-4 text-center">Duration</th>
                <th className="px-8 py-4 text-center">Status</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-8 py-4">
                      <Skeleton />
                    </td>
                    <td className="px-8 py-4 text-center">
                      <Skeleton width={60} />
                    </td>
                    <td className="px-8 py-4 text-center">
                      <Skeleton width={80} />
                    </td>
                    <td className="px-8 py-4 text-right">
                      <Skeleton width={40} />
                    </td>
                  </tr>
                ))
              ) : credits.length ? (
                credits.map((credit) => (
                  <tr
                    key={credit._id}
                    className="transition bg-white hover:bg-blue-50"
                  >
                    <td className="px-8 py-4 font-medium text-gray-900">
                      {credit.memoNo}
                    </td>

                    <td className="px-8 py-4 text-center text-gray-600">
                      {formatDuration(credit.duration)}
                    </td>

                    <td className="px-8 py-4 text-center">
                      <StatusBadge status={credit.status} />
                    </td>

                    <td className="px-8 py-4 text-right">
                      <button
                        onClick={() =>
                          setMemoModal({ isOpen: true, memo: credit })
                        }
                        className="text-blue-600 font-medium hover:underline transition"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-4">
                      <p className="rounded-full bg-gray-50 p-4">
                        <Search className="w-12 h-12" />
                      </p>
                      <p>No credit history found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ================= PAGINATION ================= */}
        <div className="px-8 py-2.5 border-t border-gray-300 bg-gray-50/50 flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Showing{" "}
            <strong>
              {startItem}-{endItem}
            </strong>{" "}
            of <strong>{pagination.total}</strong>
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={pagination.page === 1 || pagination.total === 0}
              className="p-2 border border-gray-400 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="px-1 text-sm font-semibold">
              {pagination.page} of {pagination.totalPages}
            </span>

            <button
              onClick={() =>
                setPage((p) => Math.min(p + 1, pagination.totalPages))
              }
              disabled={
                pagination.page >= pagination.totalPages ||
                pagination.total === 0
              }
              className="p-2 border border-gray-400 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODAL ================= */}
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
              "/"
            )}`}
            className="w-full h-96 border rounded"
            title="Memo Preview"
          />
        ) : (
          <p className="text-gray-500">No preview available.</p>
        )}
      </Modal>
    </div>
  );
};

export default MyCtoCreditHistory;
