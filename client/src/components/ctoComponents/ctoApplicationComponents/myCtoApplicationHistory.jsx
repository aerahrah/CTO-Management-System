import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "../../statusUtils";
import { fetchMyCtoApplications } from "../../../api/cto";
import Modal from "../../modal";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";
import { TableActionButton, CustomButton } from "../../customButton";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Clipboard, Eye } from "lucide-react";
import AddCtoApplicationForm from "./forms/addCtoApplicationForm";

const MyCtoApplications = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ctoApplications"],
    queryFn: fetchMyCtoApplications,
  });
  const formRef = useRef(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });

  const applications = data?.applications || [];

  const openModal = (app) => {
    setSelectedApp(app);
    setIsModalOpen(true);
  };

  const openMemoModal = (memos) => {
    setMemoModal({ isOpen: true, memos });
  };

  if (isLoading)
    return (
      <div className="h-full">
        <h2 className="flex items-center gap-3 mb-4 border-b pb-2">
          <span className="flex items-center justify-center w-8 h-8 bg-violet-600 rounded-full">
            <Clipboard className="w-5 h-5 text-white" />
          </span>
          <span className="text-xl font-bold text-gray-800">
            My CTO Applications
          </span>
        </h2>
        <div className="overflow-x-auto">
          <div className="max-h-128 overflow-y-auto rounded-lg shadow-sm">
            <table className="w-full table-fixed text-sm rounded-lg shadow-sm">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-left sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-36 border-b border-r border-gray-200">
                    Requested Hours
                  </th>
                  <th className="p-3 border-b border-r border-gray-200">
                    Status
                  </th>
                  <th className="p-3 border-b border-r border-gray-200">
                    Submitted
                  </th>
                  <th className="p-3 border-b border-r border-gray-200">
                    Inclusive Dates
                  </th>
                  <th className="p-3 border-b border-r border-gray-200">
                    Memos
                  </th>
                  <th className="p-3 border-b border-r border-gray-200">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...Array(10)].map((_, i) => (
                  <tr
                    key={i}
                    className={`transition-colors ${
                      i % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <td className="p-3 border-b border-r border-gray-200">
                      <Skeleton width={20} height={20} />
                    </td>
                    <td className="p-3 border-b border-r border-gray-200 text-center">
                      <Skeleton width={80} height={20} />
                    </td>
                    <td className="p-3 border-b border-r border-gray-200">
                      <Skeleton width={100} height={20} />
                    </td>
                    <td className="p-3 border-b border-r border-gray-200">
                      <Skeleton width={150} height={20} />
                    </td>
                    <td className="p-3 border-b border-r border-gray-200 text-center">
                      <Skeleton width={80} height={24} />
                    </td>
                    <td className="p-3 border-b border-gray-200 text-center">
                      <Skeleton width={95} height={24} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

  if (isError)
    return (
      <div className="bg-white p-6 rounded-md shadow-lg">
        <p className="text-red-500">
          Error: {error.message || "Failed to load applications."}
        </p>
      </div>
    );

  if (applications.length === 0)
    return (
      <div className="bg-white p-6 rounded-md shadow-lg">
        <p className="text-gray-500">
          You don’t have any CTO applications yet.
        </p>
      </div>
    );

  return (
    <div>
      <div className="flex items-center w-full justify-between mb-4 border-b pb-2">
        <h2 className="flex items-center gap-3 ">
          <span className="flex items-center justify-center w-8 h-8  bg-violet-600 rounded-full">
            <Clipboard className="w-5 h-5 text-white" />
          </span>
          <span className="text-xl font-bold text-gray-800">
            My CTO Applications
          </span>
        </h2>
        <button
          className="flex justify-end bg-violet-600 cursor-pointer hover:bg-violet-700 active:scale-97 rounded-md p-2 px-6 text-neutral-50 "
          onClick={() => setIsFormModalOpen(true)}
        >
          Apply CTO
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="max-h-128 overflow-y-auto rounded-lg shadow-sm">
          <table className="w-full table-fixed text-sm rounded-lg shadow-sm">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-left sticky top-0 z-10">
              <tr>
                <th className="p-3 w-36 border-b border-r border-gray-200">
                  Requested Hours
                </th>
                <th className="p-3 border-b border-r border-gray-200">
                  Status
                </th>
                <th className="p-3 border-b border-r border-gray-200">
                  Submitted
                </th>
                <th className="p-3 border-b border-r border-gray-200">
                  Inclusive Dates
                </th>
                <th className="p-3 border-b border-r border-gray-200">Memos</th>
                <th className="p-3 border-b border-r border-gray-200">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app, index) => (
                <tr
                  key={app._id}
                  className={`transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100`}
                >
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
                        variant="secondary" // use a different variant if you want
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
              ))}
            </tbody>
          </table>
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
        <div className="max-h-[500px] overflow-y-auto relative">
          {memoModal.memos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">
              No memos available
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-neutral-100 rounded-md">
              {memoModal.memos.map((memo, i) => (
                <div
                  key={i}
                  className="bg-white border border-gray-300 rounded-md shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* PDF Preview */}
                  {memo.uploadedMemo?.endsWith(".pdf") ? (
                    <iframe
                      src={`http://localhost:3000${memo?.uploadedMemo}`}
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

                  {/* Memo Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="mb-3">
                      <div className="flex gap-1 font-semibold">
                        <p>Memo: </p>
                        <p className="text-gray-900 text-sm md:text-base">
                          {memo.memoId?.memoNo || "—"}
                        </p>
                      </div>
                      <p className="text-gray-500 text-xs md:text-sm">
                        Hours: {memo.memoId?.totalHours || "—"}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between gap-2 mt-auto">
                      <a
                        href={`http://localhost:3000${memo?.uploadedMemo}`}
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
      </Modal>
      {/* Add CTO Form Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        action={{
          label: "Save",
          variant: "save",
          show: true,
          onClick: () => formRef.current?.submit(), // <-- call form submit here
        }}
      >
        <div className="w-120">
          <AddCtoApplicationForm
            ref={formRef}
            onClose={() => setIsFormModalOpen(false)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default MyCtoApplications;
