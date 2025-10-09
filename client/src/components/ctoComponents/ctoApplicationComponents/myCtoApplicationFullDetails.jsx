// src/components/cto/CtoApplicationDetails.jsx
const CtoApplicationDetails = ({ app }) => {
  if (!app) return null;

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6 max-h-120 overflow-y-auto">
      {/* Application Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          📄 Application Summary
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 text-sm text-gray-700">
          <div>
            <p className="text-gray-500 font-medium">Reason</p>
            <p className="font-semibold text-gray-800 mt-0.5 max-w-72 max-h-24 overflow-y-auto bg-white p-1 rounded-xs">
              {app.reason || "N/A"}
            </p>
          </div>

          <div>
            <p className="text-gray-500 font-medium">Requested Hours</p>
            <p className="font-semibold text-gray-800 mt-0.5">
              {app.requestedHours} hour(s)
            </p>
          </div>

          <div>
            <p className="text-gray-500 font-medium">Overall Status</p>
            <span
              className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${
                app.overallStatus === "APPROVED"
                  ? "bg-green-100 text-green-700"
                  : app.overallStatus === "DENIED"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {app.overallStatus}
            </span>
          </div>

          <div>
            <p className="text-gray-500 font-medium">Date Submitted</p>
            <p className="font-semibold text-gray-800 mt-0.5">
              {formatDate(app.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Approvals Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          👥 Approval Progress
        </h3>

        {app.approvals?.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {app.approvals.map((a) => (
              <li
                key={a._id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {a.approver?.firstName} {a.approver?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {a.approver?.position || "N/A"}
                  </p>
                </div>
                <span
                  className={`mt-2 sm:mt-0 inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${
                    a.status === "APPROVED"
                      ? "bg-green-100 text-green-700"
                      : a.status === "DENIED"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm italic">No approvers yet</p>
        )}
      </div>
    </div>
  );
};

export default CtoApplicationDetails;
