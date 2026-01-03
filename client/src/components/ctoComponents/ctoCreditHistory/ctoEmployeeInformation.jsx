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
   SKELETON
========================= */
const EmployeeInfoSkeleton = () => (
  <div className="p-2 space-y-4">
    <Skeleton height={120} />
    <Skeleton height={400} />
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

  /* ================= CREDIT TAB STATE ================= */
  const [creditPage, setCreditPage] = useState(1);
  const [creditLimit, setCreditLimit] = useState(20);
  const [creditStatus, setCreditStatus] = useState("");
  const [creditSearch, setCreditSearch] = useState("");

  /* ================= APPLICATION TAB STATE ================= */
  const [appPage, setAppPage] = useState(1);
  const [appLimit, setAppLimit] = useState(20);
  const [appStatus, setAppStatus] = useState("");
  const [appSearch, setAppSearch] = useState("");

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

  /* ================= CREDIT QUERY (SERVER-SIDE) ================= */
  const {
    data: creditData,
    isLoading: isCreditLoading,
    isError: isCreditError,
  } = useQuery({
    queryKey: [
      "employeeCredits",
      selectedId,
      creditPage,
      creditLimit,
      creditStatus,
      creditSearch,
    ],
    queryFn: () =>
      fetchEmployeeCredits(selectedId, {
        page: creditPage,
        limit: creditLimit,
        status: creditStatus,
        search: creditSearch,
      }),
    keepPreviousData: true,
    enabled: !!selectedId && activeTab === "credit",
  });

  /* ================= APPLICATION QUERY (SERVER-SIDE) ================= */
  const {
    data: applicationData,
    isLoading: isApplicationLoading,
    isError: isApplicationError,
  } = useQuery({
    queryKey: [
      "employeeApplications",
      selectedId,
      appPage,
      appLimit,
      appStatus,
      appSearch,
    ],
    queryFn: () =>
      fetchEmployeeApplications(selectedId, {
        page: appPage,
        limit: appLimit,
        status: appStatus,
        search: appSearch,
      }),
    keepPreviousData: true,
    enabled: !!selectedId && activeTab === "application",
  });

  /* ================= DATA ================= */
  const employee = employeeData?.employee;

  const credits = creditData?.credits || [];
  const creditPagination = creditData?.pagination || {
    page: 1,
    totalPages: 1,
  };

  const applications = applicationData?.data || [];
  const appPagination = applicationData?.pagination || {
    page: 1,
    totalPages: 1,
  };

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

  /* ================= LOADING / ERROR ================= */
  if (!selectedId || isEmployeeLoadingFromEmployeeList || isEmployeeLoading) {
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
      {/* ================= HEADER ================= */}
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

      {/* ================= TABS ================= */}
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
            <CreditCtoTable
              credits={credits}
              page={creditPage}
              limit={creditLimit}
              status={creditStatus}
              search={creditSearch}
              totalPages={creditPagination.totalPages}
              isLoading={isCreditLoading}
              onSearchChange={(val) => {
                setCreditPage(1);
                setCreditSearch(val);
              }}
              onStatusChange={(val) => {
                setCreditPage(1);
                setCreditStatus(val);
              }}
              onLimitChange={(val) => {
                setCreditPage(1);
                setCreditLimit(val);
              }}
              onNextPage={() =>
                setCreditPage((p) =>
                  p < creditPagination.totalPages ? p + 1 : p
                )
              }
              onPrevPage={() => setCreditPage((p) => (p > 1 ? p - 1 : p))}
            />
          ) : (
            <ApplicationCtoTable
              applications={applications}
              page={appPage}
              limit={appLimit}
              status={appStatus}
              search={appSearch}
              totalPages={appPagination.totalPages}
              isLoading={isApplicationLoading}
              onSearchChange={(val) => {
                setAppPage(1);
                setAppSearch(val);
              }}
              onStatusChange={(val) => {
                setAppPage(1);
                setAppStatus(val);
              }}
              onLimitChange={(val) => {
                setAppPage(1);
                setAppLimit(val);
              }}
              onNextPage={() =>
                setAppPage((p) => (p < appPagination.totalPages ? p + 1 : p))
              }
              onPrevPage={() => setAppPage((p) => (p > 1 ? p - 1 : p))}
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
