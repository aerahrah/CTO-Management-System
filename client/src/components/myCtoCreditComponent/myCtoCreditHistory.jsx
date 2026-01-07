import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyCreditRequests } from "../../api/cto";
import { StatusBadge } from "../statusUtils";
import Modal from "../modal";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Clipboard } from "lucide-react";
import FilterSelect from "../filterSelect";
import { useAuth } from "../../store/authStore";

const statusOptions = ["All", "CREDITED", "ROLLEDBACK"];
const pageSizeOptions = [20, 50, 100];

const MyCtoCreditHistory = () => {
  const { admin } = useAuth();
  const role = admin?.role;

  console.log(role);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchFilter(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // ✅ Fetch MY credits only
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
    enabled: !!role,
  });

  const credits = useMemo(() => data?.credits || [], [data]);
  console.log(credits);
  const pagination = useMemo(
    () => ({
      page: data?.page || 1,
      totalPages: Math.ceil((data?.total || 0) / limit),
      total: data?.total || 0,
    }),
    [data, limit]
  );

  const formatDuration = (duration) => {
    if (!duration) return "-";
    const { hours = 0, minutes = 0 } = duration;
    return `${hours}h ${minutes}m`;
  };

  const startItem = (pagination.page - 1) * limit + 1;
  const endItem = Math.min(pagination.page * limit, pagination.total);

  return (
    <>
      {/* Header */}
      <div className="flex items-center w-full justify-between mb-4 border-b pb-2">
        <h2 className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 bg-violet-600 rounded-full">
            <Clipboard className="w-5 h-5 text-white" />
          </span>
          <span className="text-xl font-bold text-gray-800">
            My CTO Credit History
          </span>
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4 items-end p-4 bg-neutral-50 rounded-lg shadow-sm">
        <FilterSelect
          label="Status"
          value={statusFilter || "All"}
          onChange={(val) => {
            setStatusFilter(val === "All" ? "" : val);
            setPage(1);
          }}
          options={statusOptions}
        />

        <div className="w-48">
          <label className="block text-gray-700 text-sm font-semibold mb-1">
            Search Memo
          </label>
          <input
            type="text"
            placeholder="Type memo no..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="border rounded-md p-2 text-sm w-full"
          />
        </div>

        <FilterSelect
          label="Rows per page"
          value={limit}
          onChange={(val) => {
            setLimit(val);
            setPage(1);
          }}
          options={pageSizeOptions}
        />
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-600 mb-2">
        Showing <b>{startItem}</b> - <b>{endItem}</b> of{" "}
        <b>{pagination.total}</b> items
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="p-3 border">Memo No.</th>
              <th className="p-3 border text-center">Duration</th>
              <th className="p-3 border text-center">Status</th>
              <th className="p-3 border text-center">Memo</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(limit)].map((_, i) => (
                <tr key={i}>
                  {[...Array(4)].map((__, j) => (
                    <td key={j} className="p-3 border">
                      <Skeleton height={20} />
                    </td>
                  ))}
                </tr>
              ))
            ) : credits.length > 0 ? (
              credits.map((credit) => (
                <tr key={credit._id} className="hover:bg-gray-50">
                  <td className="p-3 border font-semibold text-center">
                    {credit.memoNo}
                  </td>
                  <td className="p-3 border text-center">
                    {formatDuration(credit.duration)}
                  </td>
                  <td className="p-3 border text-center">
                    <StatusBadge status={credit.status} />
                  </td>
                  <td className="p-3 border text-center">
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() =>
                        setMemoModal({ isOpen: true, memo: credit })
                      }
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-10 text-gray-500">
                  No CTO credits found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Memo Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memo: null })}
        title={`Memo: ${memoModal.memo?.memoNo || ""}`}
        closeLabel="Close"
      >
        {memoModal.memo?.uploadedMemo ? (
          <iframe
            src={`http://localhost:3000/${memoModal.memo.uploadedMemo.replace(
              /\\/g,
              "/"
            )}`}
            className="w-full h-96 border"
          />
        ) : (
          <p className="text-gray-500">No memo available.</p>
        )}
      </Modal>
    </>
  );
};

export default MyCtoCreditHistory;
