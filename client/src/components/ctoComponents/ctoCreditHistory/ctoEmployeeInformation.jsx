import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  fetchEmployeeCredits,
  fetchEmployeeDetails,
  fetchEmployeeApplications,
} from "../../../api/cto";
import CreditCtoTable from "./ctoEmployeeCreditTable";
import ApplicationCtoTable from "./ctoEmployeeApplicationTable";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

/* =========================
   MATCHING SKELETON
========================= */
const EmployeeInfoSkeleton = () => (
  <div className="p-2 space-y-4">
    <div className="bg-white border border-neutral-300 rounded-lg p-6 flex flex-col lg:flex-row justify-between gap-6">
      <div className="space-y-2">
        <Skeleton width={220} height={26} />
        <Skeleton width={260} height={14} />
        <Skeleton width={240} height={14} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-300 p-4 text-center bg-gray-50"
          >
            <Skeleton width={80} height={12} />
            <Skeleton width={100} height={22} className="mt-2" />
          </div>
        ))}
      </div>
    </div>

    <div className="bg-white border border-neutral-300 rounded-lg">
      <div className="flex border-b border-neutral-300">
        <div className="px-6 py-3">
          <Skeleton width={90} height={16} />
        </div>
        <div className="px-6 py-3">
          <Skeleton width={120} height={16} />
        </div>
      </div>

      <div className="p-4 space-y-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} height={40} />
        ))}
      </div>
    </div>
  </div>
);

/* =========================
   MAIN COMPONENT
========================= */
const CtoEmployeeInformation = ({
  selectedId,
  isEmployeeLoadingFromEmployeeList,
}) => {
  const [activeTab, setActiveTab] = useState("credit");

  /* ===== APPLICATION TAB STATE ===== */
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState(""); // ✅ added only

  /* ================= EMPLOYEE DETAILS ================= */
  const {
    data: employeeData,
    isLoading: isEmployeeLoading,
    isError: isEmployeeError,
  } = useQuery({
    queryKey: ["employeeDetails", selectedId],
    queryFn: () => fetchEmployeeDetails(selectedId),
    enabled: !!selectedId,
  });

  /* ================= CREDITS ================= */
  const {
    data: creditData,
    isLoading: isCreditLoading,
    isError: isCreditError,
  } = useQuery({
    queryKey: ["employeeCredits", selectedId],
    queryFn: () => fetchEmployeeCredits(selectedId),
    enabled: !!selectedId,
  });

  /* ================= APPLICATIONS ================= */
  const {
    data: applicationData,
    isLoading: isApplicationLoading,
    isError: isApplicationError,
  } = useQuery({
    queryKey: ["employeeApplications", selectedId, page, limit, status, search],
    queryFn: () =>
      fetchEmployeeApplications(selectedId, {
        page,
        limit,
        status,
        search,
      }),
    keepPreviousData: true,
    enabled: !!selectedId && activeTab === "application",
  });

  /* ================= DATA ================= */
  const employee = employeeData?.employee;
  const credits = creditData?.credits || [];

  const applications = useMemo(
    () => applicationData?.data || [],
    [applicationData]
  );

  const pagination = useMemo(
    () => applicationData?.pagination || { page: 1, totalPages: 1 },
    [applicationData]
  );

  /* ================= COMPUTATIONS ================= */
  const totalEarned = credits
    .filter((c) => c.status === "CREDITED")
    .reduce((sum, c) => {
      const h = c?.duration?.hours || 0;
      const m = c?.duration?.minutes || 0;
      return sum + h + m / 60;
    }, 0);

  const totalUsed = 0;
  const balance = totalEarned - totalUsed;

  /* ================= PAGINATION ================= */
  const handleNextPage = () => {
    if (page < pagination.totalPages) setPage((p) => p + 1);
  };

  const handlePrevPage = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  /* ================= LOADING & ERROR ================= */
  if (
    !selectedId ||
    isEmployeeLoadingFromEmployeeList ||
    isEmployeeLoading ||
    isCreditLoading
  ) {
    return <EmployeeInfoSkeleton />;
  }

  if (isEmployeeError || isCreditError || isApplicationError) {
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load employee data.
      </div>
    );
  }

  /* ================= RENDER ================= */
  return (
    <div className="p-2 space-y-4 h-full flex flex-col">
      <div className="bg-white border-b border-neutral-300 pb-4 flex flex-col lg:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">
            {employee.firstName} {employee.lastName}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {employee.position} • {employee.department}
          </p>
          <p className="text-sm text-gray-500">{employee.email}</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <SummaryCard label="Earned CTO" value={totalEarned} type="success" />
          <SummaryCard label="Used CTO" value={totalUsed} type="danger" />
          <SummaryCard label="Balance" value={balance} type="primary" />
        </div>
      </div>

      <div className="bg-white border border-neutral-300 rounded-lg flex-1 min-h-0 flex flex-col">
        <div className="flex border-b border-neutral-300">
          <TabButton
            active={activeTab === "credit"}
            onClick={() => setActiveTab("credit")}
            label="Credit CTO"
          />
          <TabButton
            active={activeTab === "application"}
            onClick={() => setActiveTab("application")}
            label="Application CTO"
          />
        </div>

        <div className="p-3 flex-1 min-h-0">
          {activeTab === "credit" ? (
            <CreditCtoTable credits={credits} />
          ) : (
            <ApplicationCtoTable
              applications={applications}
              status={status}
              search={search} // ✅ passed
              onSearchChange={(val) => {
                setPage(1);
                setSearch(val);
              }}
              onStatusChange={(val) => {
                setPage(1);
                setStatus(val);
              }}
              onLimitChange={(val) => {
                setPage(1);
                setLimit(val);
              }}
              page={page}
              limit={limit}
              totalPages={pagination.totalPages}
              onNextPage={handleNextPage}
              onPrevPage={handlePrevPage}
              isLoading={isApplicationLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/* =========================
   SMALL COMPONENTS
========================= */
const SummaryCard = ({ label, value, type }) => {
  const colorMap = {
    success: "text-green-700 bg-green-50 border-green-200",
    danger: "text-red-700 bg-red-50 border-red-200",
    primary: "text-blue-700 bg-blue-50 border-blue-200",
  };

  return (
    <div className={`rounded-xl border p-4 text-center ${colorMap[type]}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-lg font-bold mt-1">{value.toFixed(2)} hrs</p>
    </div>
  );
};

const TabButton = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 text-sm font-medium transition border-b-2 ${
      active
        ? "border-neutral-900 text-neutral-900"
        : "border-transparent text-neutral-500 hover:text-neutral-700"
    }`}
  >
    {label}
  </button>
);

export default CtoEmployeeInformation;
