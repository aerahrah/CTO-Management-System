import { useState } from "react";
import Modal from "../../modal";
import { CustomButton, TableActionButton } from "../../customButton";

const CreditCtoTable = ({ credits }) => {
  const creditedRecords = credits.filter((c) => c.status === "CREDITED");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatDuration = (duration) => {
    if (!duration) return "-";
    const { hours = 0, minutes = 0 } = duration;
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="max-h-96 overflow-y-auto rounded-lg shadow-sm">
        <table className="w-full text-sm items-center">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 sticky top-0 z-10">
            <tr>
              <th className="p-3 border-b border-r border-gray-200">
                Memo No.
              </th>
              <th className="p-3 border-b border-r border-gray-200">
                Date Approved
              </th>
              <th className="p-3 border-b border-r border-gray-200">
                Credited By
              </th>
              <th className="p-3 text-center border-b border-r border-gray-200">
                Duration
              </th>
              <th className="p-3 text-center border-b border-r border-gray-200">
                Memo File
              </th>
            </tr>
          </thead>
          <tbody>
            {creditedRecords.length > 0 ? (
              creditedRecords.map((c, index) => (
                <tr
                  key={c._id}
                  className={`transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100`}
                >
                  <td className="p-3 border-b border-r border-gray-200 font-medium text-gray-700">
                    {c.memoNo || "-"}
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-gray-700">
                    {c.dateApproved
                      ? new Date(c.dateApproved).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "-"}
                  </td>
                  <td className="p-3 border-b border-r border-gray-200 text-gray-800">
                    {c.creditedBy
                      ? `${c.creditedBy.firstName} ${c.creditedBy.lastName}`
                      : "-"}
                  </td>
                  <td className="p-3 text-center border-b border-r border-gray-200 font-semibold text-blue-700">
                    {formatDuration(c.duration)}
                  </td>
                  <td className="p-3 border-b text-center border-r border-gray-200 text-gray-700">
                    <TableActionButton
                      label="View Memo"
                      variant="default" // 👈 uses the neutral style
                      size="sm"
                      onClick={() => setIsModalOpen(true)}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="5"
                  className="p-3 text-center text-gray-500 border-b border-gray-200"
                >
                  No credited records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Memo File"
        isDisplay={false}
      >
        <div className="w-full py-3">
          <p className="text-base text-gray-700">
            Memo file preview or info here.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default CreditCtoTable;
