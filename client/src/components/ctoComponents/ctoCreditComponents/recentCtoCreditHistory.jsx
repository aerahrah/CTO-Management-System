import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllCreditRequests, rollbackCreditCto } from "../../../api/cto";
import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Clipboard,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  RotateCcw,
  Plus,
  Filter,
} from "lucide-react";
import FilterSelect from "../../filterSelect";
import AddCtoCreditForm from "./forms/addCtoCreditForm";

const pageSizeOptions = [20, 50, 100];

const CtoCreditHistory = () => {
  const queryClient = useQueryClient();
  const formRef = useRef(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });
  const [isAddCtoOpen, setIsAddCtoOpen] = useState(false);
  const [isConfirmRollback, setIsConfirmRollback] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState(null);

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
    [data, limit]
  );

  /* ---------------- MUTATION ---------------- */
  const { mutate: rollbackRequest, isLoading: isRollingBack } = useMutation({
    mutationFn: rollbackCreditCto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allCredits"] });
      setIsConfirmRollback(false);
    },
  });

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
              CTO Credit History
            </h1>
            <p className="text-sm text-gray-500">
              Manage and monitor CTO credits issued to employees
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddCtoOpen(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Credit CTO
        </button>
      </div>

      {/* ================= MAIN CARD ================= */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-300 flex flex-col flex-1 min-h-0">
        {/* ================= FILTER BAR ================= */}
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-wrap gap-4">
          <div className="relative flex-1 bg-white min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search employee or memo..."
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
              options={["All Status", "CREDITED", "ROLLEDBACK"]}
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
                <th className="px-8 py-4">Employees</th>
                <th className="px-8 py-4">Memo No.</th>
                <th className="px-8 py-4 text-center">Duration</th>
                <th className="px-8 py-4 text-center">Status</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {isLoading || isRollingBack ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-8 py-4">
                      <Skeleton />
                    </td>
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
                      <Skeleton width={80} />
                    </td>
                  </tr>
                ))
              ) : credits.length ? (
                credits.map((credit, i) => (
                  <tr
                    key={credit._id}
                    className={`transition ${
                      i % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-blue-50`}
                  >
                    <td className="px-8 py-4 font-medium text-gray-900">
                      {credit.employees
                        .map(
                          (e) =>
                            `${e.employee?.firstName} ${e.employee?.lastName}`
                        )
                        .join(", ")}
                    </td>

                    <td className="px-8 py-4">{credit.memoNo}</td>

                    <td className="px-8 py-4 text-center text-gray-600">
                      {formatDuration(credit.duration)}
                    </td>

                    <td className="px-8 py-4 text-center">
                      <StatusBadge status={credit.status} />
                    </td>

                    <td className="px-8 py-4 text-right space-x-2">
                      <button
                        onClick={() =>
                          setMemoModal({ isOpen: true, memo: credit })
                        }
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg font-semibold transition"
                      >
                        <FileText className="w-4 h-4" />
                        View
                      </button>

                      <button
                        disabled={credit.status !== "CREDITED"}
                        onClick={() => {
                          setSelectedCreditId(credit._id);
                          setIsConfirmRollback(true);
                        }}
                        className="inline-flex items-center gap-1 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg font-semibold transition disabled:opacity-40"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Rollback
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-4">
                      <p className="rounded-full bg-gray-50 p-4">
                        <Search className="w-12 h-12" />
                      </p>
                      <p className="text-neutral-500">
                        No credit history found
                      </p>
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
              disabled={pagination.page === 1}
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
              disabled={pagination.page === pagination.totalPages}
              className="p-2 border border-gray-400 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}
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
          Are you sure you want to rollback this CTO credit?
        </p>
      </Modal>

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

      <Modal
        isOpen={isAddCtoOpen}
        onClose={() => setIsAddCtoOpen(false)}
        action={{
          label: "Submit",
          variant: "save",
          show: true,
          onClick: () => formRef.current?.submit(),
        }}
      >
        <AddCtoCreditForm
          ref={formRef}
          onClose={() => setIsAddCtoOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default CtoCreditHistory;
