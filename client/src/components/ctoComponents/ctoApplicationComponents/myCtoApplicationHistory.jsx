import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "../../statusUtils";
import { fetchMyCtoApplications } from "../../../api/cto";
import Modal from "../../modal";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Clipboard,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
} from "lucide-react";
import FilterSelect from "../../filterSelect";
import AddCtoApplicationForm from "./forms/addCtoApplicationForm";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";

const statusOptions = ["PENDING", "APPROVED", "REJECTED"];
const pageSizeOptions = [20, 50, 100];

const MyCtoApplications = () => {
  const formRef = useRef(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
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
    queryKey: ["ctoApplications", page, limit, statusFilter, searchFilter],
    queryFn: () =>
      fetchMyCtoApplications({
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
    [data]
  );

  const startItem = (pagination.page - 1) * limit + 1;
  const endItem = Math.min(pagination.page * limit, pagination.total);

  const openMemoModal = (memos) => setMemoModal({ isOpen: true, memos });
  const closeMemoModal = () => setMemoModal({ isOpen: false, memos: [] });

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
              My CTO Applications
            </h1>
            <p className="text-sm text-gray-500">
              View and manage your compensatory time-off applications
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsFormModalOpen(true)}
          className="bg-blue-600 text-white rounded-lg px-6 py-2 hover:bg-blue-700 transition"
        >
          Apply CTO
        </button>
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
                <th className="px-8 py-4 text-center">Requested Hours</th>
                <th className="px-8 py-4 text-center">Status</th>
                <th className="px-8 py-4 text-center">Submitted</th>
                <th className="px-8 py-4 text-center">Inclusive Dates</th>
                <th className="px-8 py-4 text-center">Memos</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr
                    key={i}
                    className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  >
                    {[...Array(7)].map((__, j) => (
                      <td key={j} className="px-8 py-4 border border-gray-200">
                        <Skeleton />
                      </td>
                    ))}
                  </tr>
                ))
              ) : applications.length ? (
                applications.map((app, index) => (
                  <tr
                    key={app._id}
                    className={`transition hover:bg-blue-50 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <td className="px-8 py-4 border border-gray-200 font-medium text-gray-900">
                      {Array.isArray(app.memo) && app.memo.length
                        ? app.memo.map((m) => m?.memoId?.memoNo).join(", ")
                        : "-"}
                    </td>
                    <td className="px-8 py-4 border border-gray-200 text-center text-gray-600">
                      {app.requestedHours}
                    </td>
                    <td className="px-8 py-4 border border-gray-200 text-center">
                      <StatusBadge status={app.overallStatus} />
                    </td>
                    <td className="px-8 py-4 border border-gray-200 text-center text-gray-600">
                      {new Date(app.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-8 py-4 border border-gray-200 text-center text-gray-600">
                      {app.inclusiveDates
                        ?.map((d) => new Date(d).toLocaleDateString("en-US"))
                        .join(", ")}
                    </td>
                    <td className="px-8 py-4 border border-gray-200 text-center">
                      {app.memo?.length > 0 ? (
                        <button
                          onClick={() => openMemoModal(app.memo)}
                          className="text-blue-600 font-medium hover:underline transition"
                        >
                          View ({app.memo.length})
                        </button>
                      ) : (
                        <span className="text-gray-400">No memos</span>
                      )}
                    </td>
                    <td className="px-8 py-4 border border-gray-200 text-right">
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="text-blue-600 font-medium hover:underline transition"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-4">
                      <p className="rounded-full bg-gray-50 p-4">
                        <Search className="w-12 h-12" />
                      </p>
                      <p>No CTO applications found</p>
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

      {/* ================= MODALS ================= */}
      {/* CTO Details Modal */}
      {selectedApp && (
        <Modal
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          title="CTO Application Details"
        >
          <CtoApplicationDetails app={selectedApp} loading={!selectedApp} />
        </Modal>
      )}

      {/* Add CTO Form Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        action={{
          label: "Save",
          variant: "save",
          show: true,
          onClick: () => formRef.current?.submit(),
        }}
      >
        <div className="w-120">
          <AddCtoApplicationForm
            ref={formRef}
            onClose={() => setIsFormModalOpen(false)}
          />
        </div>
      </Modal>

      {/* Memo Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={closeMemoModal}
        title="Memos Used in CTO Application"
        closeLabel="Close"
      >
        {memoModal.memos.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No memos available</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-neutral-100 rounded-md">
            {memoModal.memos.map((memo, i) => (
              <div
                key={i}
                className="bg-white border border-gray-300 rounded-md shadow-sm hover:shadow-md transition flex flex-col"
              >
                {memo.uploadedMemo?.endsWith(".pdf") ? (
                  <iframe
                    src={`http://localhost:3000/${memo?.uploadedMemo}`}
                    title={memo.memoId?.memoNo || `Memo ${i}`}
                    className="w-full h-40 border-b border-gray-200 rounded-t-md"
                  />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center bg-gray-50 border-b border-gray-200 rounded-t-md">
                    <p className="text-gray-400 text-sm">
                      No Preview Available
                    </p>
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="mb-3">
                    <div className="flex gap-1 font-semibold">
                      <p>Memo: </p>
                      <p className="text-gray-900 text-sm md:text-base">
                        {memo.memoId?.memoNo || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between gap-2 mt-auto">
                    <a
                      href={`http://localhost:3000/${memo?.uploadedMemo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm font-medium"
                    >
                      <Eye size={16} />
                      View
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyCtoApplications;
