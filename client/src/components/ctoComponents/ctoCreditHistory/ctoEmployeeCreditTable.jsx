const CreditCtoTable = ({ credits }) => {
  const formatDuration = (duration) => {
    if (!duration) return "-";
    const { hours = 0, minutes = 0 } = duration;
    return `${hours}h ${minutes}m`;
  };

  console.log(credits);
  return (
    <div className="overflow-x-auto">
      <div className="max-h-96 overflow-y-auto rounded-lg shadow-sm r">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 sticky top-0 z-10">
            <tr>
              <th className="p-2 border-b border-r border-gray-200">
                Credited By
              </th>
              <th className="p-2 border-b border-r border-gray-200">
                Memo File
              </th>
              <th className="p-2 border-b border-r border-gray-200">
                Memo No.
              </th>
              <th className="p-2 text-center border-b border-r border-gray-200">
                Duration
              </th>

              {/* <th className="p-2 text-center border-b border-r border-gray-200">
                Status
              </th> */}
              <th className="p-2 border-b border-r border-gray-200">
                Date Approved
              </th>
            </tr>
          </thead>
          <tbody>
            {credits.length > 0 ? (
              credits.map((c, index) => (
                <tr
                  key={c._id}
                  className={`transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100`}
                >
                  <td className="p-2 border-b border-r border-gray-200 text-gray-800">
                    {c.creditedBy
                      ? `${c.creditedBy.firstName} ${c.creditedBy.lastName}`
                      : "-"}
                  </td>
                  <td className="p-2 border-b border-r border-gray-200 text-gray-700">
                    {c.rolledBackBy
                      ? `${c.rolledBackBy.firstName} ${c.rolledBackBy.lastName}`
                      : "-"}
                  </td>
                  <td className="p-2 text-center border-b border-r border-gray-200 font-semibold text-blue-700">
                    {formatDuration(c.duration)}
                  </td>
                  <td className="p-2 border-b border-r border-gray-200 text-gray-700 font-medium">
                    {c.memoNo || "-"}
                  </td>
                  {/* <td
                    className={`p-2 font-semibold text-center border-b border-r border-gray-200 ${
                      c.status === "CREDITED"
                        ? "text-green-600"
                        : c.status === "ROLLEDBACK"
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    {c.status}
                  </td> */}
                  <td className="p-2 border-b border-r border-gray-200">
                    {c.dateApproved
                      ? new Date(c.dateApproved).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "-"}
                  </td>
                  {/* <td className="p-2 border-b border-gray-200">
                    {c.dateRolledBack
                      ? new Date(c.dateRolledBack).toLocaleDateString()
                      : "-"}
                  </td> */}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="7"
                  className="p-2 text-center text-gray-500 border-b border-gray-200"
                >
                  No credits found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CreditCtoTable;
