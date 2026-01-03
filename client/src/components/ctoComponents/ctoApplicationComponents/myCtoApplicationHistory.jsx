import { useState, useRef, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "../../statusUtils";
import { fetchMyCtoApplications } from "../../../api/cto";
import Modal from "../../modal";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";
import { TableActionButton } from "../../customButton";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Clipboard, Eye, Check, ChevronDown } from "lucide-react";
import AddCtoApplicationForm from "./forms/addCtoApplicationForm";
import FilterSelect from "../../filterSelect";

const statusOptions = ["All", "PENDING", "APPROVED", "REJECTED"];
const pageSizeOptions = [20, 50, 100];

const MyCtoApplications = () => {
  const formRef = useRef(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  // Filters & pagination state
  const [statusFilter, setStatusFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Fetch CTO applications
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      "ctoApplications",
      { page, limit, statusFilter, searchFilter, fromDate, toDate },
    ],
    queryFn: () =>
      fetchMyCtoApplications({
        page,
        limit,
        status: statusFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        search: searchFilter || undefined,
      }),
    keepPreviousData: true,
  });

  const applications = useMemo(() => data?.data || [], [data]);
  const pagination = useMemo(
    () => data?.pagination || { page: 1, totalPages: 1, total: 0 },
    [data]
  );

  // Calculate displayed range
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, pagination.total);

  const openModal = (app) => {
    setSelectedApp(app);
    setIsModalOpen(true);
  };

  const openMemoModal = (memos) => {
    setMemoModal({ isOpen: true, memos });
  };

  // Filter handlers
  const handleStatusChange = (val) => {
    setStatusFilter(val === "All" ? "" : val);
    setPage(1);
    refetch();
  };
  const handleSearchChange = (val) => {
    setSearchFilter(val);
    setPage(1);
    refetch();
  };
  const handleFromChange = (val) => {
    setFromDate(val);
    setPage(1);
    refetch();
  };
  const handleToChange = (val) => {
    setToDate(val);
    setPage(1);
    refetch();
  };
  const handleLimitChange = (val) => {
    setLimit(val);
    setPage(1);
    refetch();
  };

  return (
    <>
      <div className="flex items-center w-full justify-between mb-4 border-b pb-2">
        <h2 className="flex items-center gap-3 ">
          <span className="flex items-center justify-center w-8 h-8 bg-violet-600 rounded-full">
            <Clipboard className="w-5 h-5 text-white" />
          </span>
          <span className="text-xl font-bold text-gray-800">
            My CTO Applications
          </span>
        </h2>
        <button
          className="flex justify-end bg-blue-600 cursor-pointer hover:bg-blue-700 active:scale-95 transition-transform rounded-md p-2 px-6 text-neutral-50 shadow"
          onClick={() => setIsFormModalOpen(true)}
        >
          Apply CTO
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4 items-end p-4 bg-neutral-50 rounded-lg shadow-sm transition-all duration-10">
        <FilterSelect
          label="Status"
          value={statusFilter || "All"}
          onChange={handleStatusChange}
          options={statusOptions}
        />
        <FilterDate label="From" value={fromDate} onChange={handleFromChange} />
        <FilterDate label="To" value={toDate} onChange={handleToChange} />
        <FilterInput
          label="Search Memo"
          value={searchFilter}
          onChange={handleSearchChange}
          placeholder="Memo number..."
        />
      </div>

      {/* Total Items */}
      <div className="text-sm text-gray-600 mb-2">
        Showing: <span className="font-semibold">{startItem}</span> -{" "}
        <span className="font-semibold">{endItem}</span> of{" "}
        <span className="font-semibold">{pagination.total}</span> items
      </div>

      <div className="max-h-124 overflow-y-auto overflow-x-auto rounded-lg shadow-sm flex-1">
        <table className="w-full table-fixed text-sm rounded-lg shadow-sm h-full">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-left sticky top-0 z-10">
            <tr>
              <th className="p-3 w-36 border-b border-r border-gray-200">
                Memo No.
              </th>
              <th className="p-3 w-36 border-b border-r border-gray-200">
                Requested Hours
              </th>
              <th className="p-3 border-b border-r border-gray-200">Status</th>
              <th className="p-3 border-b border-r border-gray-200">
                Submitted
              </th>
              <th className="p-3 border-b border-r border-gray-200">
                Inclusive Dates
              </th>
              <th className="p-3 border-b border-r border-gray-200">
                Memo File
              </th>
              <th className="p-3 border-b border-r border-gray-200">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7}>
                  <SkeletonTable rows={10} />
                </td>
              </tr>
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-500">
                  No CTO applications found
                </td>
              </tr>
            ) : (
              applications.map((app, index) => (
                <tr
                  key={app._id}
                  className={`transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100`}
                >
                  <td className="p-3 border-r border-b border-neutral-300 font-medium text-gray-700">
                    {Array.isArray(app.memo) && app.memo.length > 0
                      ? app.memo.map((m) => m?.memoId?.memoNo).join(", ")
                      : "-"}
                  </td>

                  <td className="p-3 border-b border-r border-gray-200 text-gray-800 font-medium">
                    {app.requestedHours}
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-center font-semibold">
                    <StatusBadge status={app.overallStatus} />
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-sm text-gray-500">
                    {new Date(app.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-sm text-gray-600">
                    {app.inclusiveDates
                      ?.map((d) => new Date(d).toLocaleDateString("en-US"))
                      .join(", ")}
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-center">
                    {app.memo?.length > 0 ? (
                      <TableActionButton
                        label={`View Memos (${app.memo.length})`}
                        onClick={() => openMemoModal(app.memo)}
                        variant="secondary"
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">No memos</span>
                    )}
                  </td>
                  <td className="p-3 text-center border-b border-gray-200">
                    <TableActionButton
                      label="View Details"
                      onClick={() => openModal(app)}
                      variant="neutral"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-4">
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-700 ">Rows per page:</span>
          <FilterSelect
            label=""
            width={20}
            value={limit}
            onChange={handleLimitChange}
            options={pageSizeOptions}
            openUp="true"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm">
            Page {page} of {pagination.totalPages || 1}
          </span>
          <button
            onClick={() =>
              setPage((prev) => Math.min(prev + 1, pagination.totalPages))
            }
            disabled={page === pagination.totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* CTO Details Modal */}
      {selectedApp && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="CTO Application Details"
        >
          <CtoApplicationDetails app={selectedApp} loading={!selectedApp} />
        </Modal>
      )}

      {/* Memo Modal */}
      <Modal
        isOpen={memoModal.isOpen}
        onClose={() => setMemoModal({ isOpen: false, memos: [] })}
        title="Memos Used in CTO Application"
        closeLabel="Close"
      >
        <MemoGrid memos={memoModal.memos} />
      </Modal>

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
    </>
  );
};

// --- Subcomponents ---

const FilterInput = ({ label, value, onChange, placeholder }) => (
  <div className="w-36">
    <label className="block text-gray-700 text-sm font-semibold mb-1">
      {label}
    </label>
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 rounded-md p-2 text-sm w-full bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all"
    />
  </div>
);

const FilterDate = ({ label, value, onChange }) => (
  <div className="w-36">
    <label className="block text-gray-700 text-sm font-semibold mb-1">
      {label}
    </label>
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 rounded-md p-2 text-sm w-full bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all"
    />
  </div>
);

const MemoGrid = ({ memos }) => (
  <div className="max-h-[500px] overflow-y-auto relative">
    {memos.length === 0 ? (
      <p className="text-sm text-gray-500 text-center py-10">
        No memos available
      </p>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-neutral-100 rounded-md">
        {memos.map((memo, i) => (
          <div
            key={i}
            className="bg-white border border-gray-300 rounded-md shadow-sm hover:shadow-md transition-shadow flex flex-col"
          >
            {memo.uploadedMemo?.endsWith(".pdf") ? (
              <iframe
                src={`http://localhost:3000/${memo?.uploadedMemo}`}
                title={memo.memoId?.memoNo || `Memo ${i}`}
                className="w-full h-40 border-b border-gray-200 rounded-t-md"
              />
            ) : (
              <div className="w-full h-40 flex items-center justify-center bg-gray-50 border-b border-gray-200 rounded-t-md">
                <p className="text-gray-400 text-sm">No Preview Available</p>
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
                {/* <p className="text-gray-500 text-xs md:text-sm">
                  Hours: {memo.memoId?.totalHours || "—"}
                </p> */}
              </div>
              <div className="flex justify-between gap-2 mt-auto">
                <a
                  href={`http://localhost:3000/${memo?.uploadedMemo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-1 px-3 py-1 text-xs md:text-sm font-medium border border-gray-400 rounded hover:bg-gray-100 transition-colors"
                >
                  <Eye size={18} />
                  View
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const SkeletonTable = ({ rows }) => (
  <div className="overflow-x-auto">
    <div className="max-h-128 overflow-y-auto rounded-lg shadow-sm">
      <table className="w-full table-fixed text-sm rounded-lg shadow-sm">
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <tr
              key={i}
              className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
            >
              {[...Array(6)].map((__, j) => (
                <td key={j} className="p-3 border-b border-r border-gray-200">
                  <Skeleton width="100%" height={20} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default MyCtoApplications;
