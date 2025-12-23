import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllCreditRequests, rollbackCreditCto } from "../../../api/cto";
import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import { TableActionButton } from "../../customButton";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Clipboard } from "lucide-react";
import FilterSelect from "../../filterSelect";

const statusOptions = ["All", "CREDITED", "PENDING", "ROLLED_BACK"];
const pageSizeOptions = [20, 50, 100];

const CtoCreditHistory = () => {
  const queryClient = useQueryClient();

  // Filters & pagination
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [isConfirmRollback, setIsConfirmRollback] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState(null);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });

  // Debounce search input manually
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchFilter(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch credits
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
      totalPages: Math.ceil((data?.total || 0) / (data?.limit || limit)),
      total: data?.total || 0,
    }),
    [data, limit]
  );

  const { mutate: rollbackRequest, isLoading: isProcessing } = useMutation({
    mutationFn: rollbackCreditCto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allCredits"] });
    },
  });

  const handleRollback = (id) => {
    setSelectedCreditId(id);
    setIsConfirmRollback(true);
  };

  const confirmRollback = () => {
    if (selectedCreditId) rollbackRequest(selectedCreditId);
    setIsConfirmRollback(false);
  };

  const formatDuration = (duration) => {
    if (!duration) return "-";
    const { hours = 0, minutes = 0 } = duration;
    return `${hours}h ${minutes}m`;
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val === "All" ? "" : val);
    setPage(1);
  };

  const handleLimitChange = (val) => {
    setLimit(val);
    setPage(1);
  };

  const startItem = (pagination.page - 1) * limit + 1;
  const endItem = Math.min(pagination.page * limit, pagination.total);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center w-full justify-between mb-4 border-b pb-2">
        <h2 className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 bg-violet-600 rounded-full">
            <Clipboard className="w-5 h-5 text-white" />
          </span>
          <span className="text-xl font-bold text-gray-800">
            Credit History
          </span>
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4 items-end p-4 bg-neutral-50 rounded-lg shadow-sm transition-all duration-100">
        <FilterSelect
          label="Status"
          value={statusFilter || "All"}
          onChange={handleStatusChange}
          options={statusOptions}
        />
        <div className="w-48">
          <label className="block text-gray-700 text-sm font-semibold mb-1">
            Search Employee
          </label>
          <input
            type="text"
            placeholder="Type to search..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="border border-gray-300 rounded-md p-2 text-sm w-full bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all"
          />
        </div>
        <FilterSelect
          label="Rows per page"
          value={limit}
          onChange={handleLimitChange}
          options={pageSizeOptions}
        />
      </div>

      {/* Total Items */}
      <div className="text-sm text-gray-600 mb-2">
        Showing <span className="font-semibold">{startItem}</span> -{" "}
        <span className="font-semibold">{endItem}</span> of{" "}
        <span className="font-semibold">{pagination.total}</span> items
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="max-h-128 overflow-y-auto rounded-lg shadow-sm">
          <table className="w-full table-fixed text-sm rounded-lg shadow-sm">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-left sticky top-0 z-10">
              <tr>
                <th className="p-3 w-36 border-b border-r border-gray-200">
                  Employees
                </th>
                <th className="p-3 text-center border-b border-r border-gray-200">
                  Duration
                </th>
                <th className="p-3 border-b border-r border-gray-200 text-center">
                  Memo No.
                </th>
                <th className="p-3 text-center border-b border-r border-gray-200">
                  Status
                </th>
                <th className="p-3 text-center border-b border-gray-200">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading || isProcessing ? (
                [...Array(limit)].map((_, i) => (
                  <tr
                    key={i}
                    className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  >
                    {[...Array(5)].map((__, j) => (
                      <td
                        key={j}
                        className="p-3 border-b border-r border-gray-200"
                      >
                        <Skeleton width="100%" height={20} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : credits.length > 0 ? (
                credits.map((credit, index) => (
                  <tr
                    key={credit._id}
                    className={`transition-colors ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-gray-100`}
                  >
                    <td className="p-3 font-medium text-gray-800 border-b border-gray-200 border-r">
                      {credit.employees
                        .map(
                          (e) =>
                            `${e.employee?.firstName} ${e.employee?.lastName}`
                        )
                        .join(", ")}
                    </td>
                    <td className="p-3 text-center border-b border-gray-200 border-r">
                      {formatDuration(credit.duration)}
                    </td>
                    <td className="p-3 border-b border-gray-200 border-r text-center">
                      <TableActionButton
                        label="View Memo"
                        onClick={() =>
                          setMemoModal({ isOpen: true, memo: credit })
                        }
                        variant="neutral"
                      />
                    </td>
                    <td className="p-3 font-semibold text-center border-b border-gray-200 border-r">
                      <StatusBadge status={credit.status} />
                    </td>
                    <td className="p-3 text-center border-b border-gray-200">
                      <TableActionButton
                        label={isProcessing ? "Processing..." : "Rollback"}
                        onClick={() => handleRollback(credit._id)}
                        disabled={credit.status !== "CREDITED" || isProcessing}
                        variant="neutral"
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-500">
                    No credit requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-4">
        <div></div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={pagination.page === 1 || isLoading}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() =>
              setPage((prev) => Math.min(prev + 1, pagination.totalPages))
            }
            disabled={pagination.page === pagination.totalPages || isLoading}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Rollback Modal */}
      <Modal
        isOpen={isConfirmRollback}
        onClose={() => setIsConfirmRollback(false)}
        action={{
          label: "Confirm Rollback",
          onClick: confirmRollback,
          show: true,
          variant: "delete",
        }}
        closeLabel="Cancel"
        title="Confirm Rollback"
      >
        <p className="text-l py-2">
          Are you sure you want to rollback this credited CTO? This will remove
          the credits from the employee balances.
        </p>
      </Modal>

      {/* Memo Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memo: null })}
        title={`Memo: ${memoModal.memo?.memoNo || ""}`}
        action={{
          label: "Open in new Tab",
          variant: "save",
          show: true,
          onClick: () => {
            if (memoModal.memo?.uploadedMemo) {
              const url = `http://localhost:3000/${memoModal.memo.uploadedMemo.replace(
                /\\/g,
                "/"
              )}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }
          },
        }}
        closeLabel="Close"
      >
        {memoModal.memo?.uploadedMemo ? (
          memoModal.memo.uploadedMemo.endsWith(".pdf") ? (
            <iframe
              src={`http://localhost:3000/${memoModal.memo.uploadedMemo.replace(
                /\\/g,
                "/"
              )}`}
              title={memoModal.memo.memoNo}
              className="w-full h-96 border"
            />
          ) : (
            <div className="flex items-center justify-center h-96 bg-gray-100 border">
              <p>No preview available</p>
            </div>
          )
        ) : (
          <p className="text-gray-500">No uploaded memo found.</p>
        )}
      </Modal>
    </div>
  );
};

export default CtoCreditHistory;
