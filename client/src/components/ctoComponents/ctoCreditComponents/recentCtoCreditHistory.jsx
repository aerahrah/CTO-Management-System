import { useState, useMemo, useRef, useEffect } from "react";
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
  Filter,
  X,
  Eye,
  RotateCcw,
  Inbox,
  MoreVertical,
} from "lucide-react";
import FilterSelect from "../../filterSelect";
import AddCtoCreditForm from "./forms/addCtoCreditForm";
import CtoCreditDetails from "./ctoCreditfullDetails";

const pageSizeOptions = [20, 50, 100];
const statusOptions = ["CREDITED", "ROLLEDBACK"];

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
    <div className="relative flex justify-center" ref={menuRef}>
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

const CtoCreditHistory = () => {
  const queryClient = useQueryClient();
  const formRef = useRef(null);

  // States
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

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

  const formatDuration = (d) =>
    d ? `${d.hours || 0}h ${d.minutes || 0}m` : "-";

  const formatDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "-";
  const handleResetFilters = () => {
    setSearchInput("");
    setSearchFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const isFiltered = statusFilter !== "" || searchFilter !== "";
  const startItem = (pagination.page - 1) * limit + 1;
  const endItem = Math.min(pagination.page * limit, pagination.total);

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
              CTO Credit History
            </h1>
            <p className="text-xs md:text-sm text-gray-500">
              Manage and monitor CTO credits issued to employees
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddCtoOpen(true)}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition shadow-sm font-medium w-full md:w-auto flex items-center   transition-all active:scale-95  gap-2"
        >
          <Plus className="w-4 h-4" />
          Credit CTO
        </button>
      </div>

      {/* ================= MAIN CARD ================= */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-300 flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ================= FILTER BAR ================= */}
        <div className="p-2 md:p-3  border-b border-gray-300 bg-white">
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
                      Employees
                    </th>
                    <th className="px-4 py-4 border border-gray-300 text-left">
                      Memo No.
                    </th>
                    <th className="px-6 py-4 border border-gray-300 text-center">
                      Duration
                    </th>
                    <th className="px-6 py-4 border border-gray-300 text-center">
                      Date Approve
                    </th>
                    <th className="px-6 py-4 border border-gray-300 text-center">
                      Status
                    </th>
                    {/* INDIVIDUAL ACTION COLUMNS */}

                    <th className="px-4 py-4 border border-gray-300 text-center w-32">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading || isPending
                    ? [...Array(limit)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(7)].map((__, j) => (
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
                            {credit.employees
                              .map(
                                (e) =>
                                  `${e.employee?.firstName} ${e.employee?.lastName}`,
                              )
                              .join(", ")}
                          </td>
                          <td className="px-6 py-3 border border-gray-300 text-gray-700">
                            {credit.memoNo}
                          </td>
                          <td className="px-6 py-3 border border-gray-300 text-center text-gray-600">
                            {formatDuration(credit.duration)}
                          </td>
                          <td className="px-6 py-3 border border-gray-300 text-center text-gray-600">
                            {formatDate(credit.dateApproved)}
                          </td>
                          <td className="px-6 py-3 border border-gray-300 text-center">
                            <StatusBadge status={credit.status} />
                          </td>

                          {/* VIEW MEMO COLUMN */}
                          <td className="px-4 py-3 border border-gray-300 text-center">
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
          )}
        </div>

        {/* ================= PAGINATION ================= */}
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

      {/* Rollback Confirmation */}
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
          deduct the credited hours from the respective employees' balances.
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

      <Modal
        isOpen={detailsModal.isOpen}
        onClose={() => setDetailsModal((prev) => ({ ...prev, isOpen: false }))}
        title="CTO Credit Details"
        maxWidth="max-w-4xl"
      >
        <CtoCreditDetails credit={detailsModal.credit} />
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
        <div className="w-[30rem]">
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
