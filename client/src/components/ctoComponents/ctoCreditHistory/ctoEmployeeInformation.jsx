// ctoEmployeeInformation.jsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchEmployeeCredits,
  fetchEmployeeDetails,
  fetchEmployeeApplications,
} from "../../../api/cto";
import CreditCtoTable from "./ctoEmployeeCreditTable";
import ApplicationCtoTable from "./ctoEmployeeApplicationTable";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useNavigate, useParams } from "react-router-dom";

/* =========================
   HOOK: DEBOUNCE
========================= */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/* ================================
   HOOK: MEDIA QUERY (xl and up)
================================ */
function useIsXlUp() {
  const [isXlUp, setIsXlUp] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1280px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = (e) => setIsXlUp(e.matches);

    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return isXlUp;
}

/* =========================
   SKELETON
========================= */
const EmployeeInfoSkeleton = () => (
  <div className="space-y-4">
    <Skeleton height={120} />
    <Skeleton height={420} />
  </div>
);

/* =========================
   UI: StatCard + Tabs
========================= */
const StatCard = ({ title, value, hint, tone = "neutral" }) => {
  const tones = {
    blue: { wrap: "bg-white border-neutral-100", value: "text-blue-700" },
    green: { wrap: "bg-white border-neutral-100", value: "text-green-700" },
    red: { wrap: "bg-white border-neutral-100", value: "text-red-700" },
    amber: { wrap: "bg-white border-neutral-100", value: "text-amber-700" },
    neutral: { wrap: "bg-white border-neutral-100", value: "text-gray-900" },
  };

  const t = tones[tone] || tones.neutral;

  return (
    <div
      className={`w-full flex-shrink-0 border rounded-lg shadow-sm p-3 flex items-start gap-3 h-full ${t.wrap}`}
      role="status"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wide truncate">
          {title}
        </div>
        <div className={`mt-0.5 text-lg font-bold truncate ${t.value}`}>
          {value}
        </div>
        {hint && (
          <div className="text-[11px] text-gray-500 truncate">{hint}</div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`px-4 sm:px-6 py-3 text-sm font-semibold transition border-b-2 whitespace-nowrap
      ${
        active
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-neutral-500 hover:text-neutral-800"
      }`}
    type="button"
  >
    {label}
  </button>
);

/* =========================
   MAIN COMPONENT
========================= */
const CtoEmployeeInformation = ({ isEmployeeLoadingFromEmployeeList }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("credit");
  const { id: selectedId } = useParams();
  const isXlUp = useIsXlUp();

  /* ===== CREDIT TAB STATE ===== */
  const [creditPage, setCreditPage] = useState(1);
  const [creditLimit, setCreditLimit] = useState(20);
  const [creditStatus, setCreditStatus] = useState("");
  const [creditSearchInput, setCreditSearchInput] = useState("");
  const creditSearch = useDebounce(creditSearchInput, 350);

  /* ===== APPLICATION TAB STATE ===== */
  const [appPage, setAppPage] = useState(1);
  const [appLimit, setAppLimit] = useState(20);
  const [appStatus, setAppStatus] = useState("");
  const [appSearchInput, setAppSearchInput] = useState("");
  const appSearch = useDebounce(appSearchInput, 350);

  /* ===== EMPLOYEE DETAILS ===== */
  const {
    data: employeeData,
    isLoading: isEmployeeLoading,
    isError: isEmployeeError,
  } = useQuery({
    queryKey: ["employeeDetails", selectedId],
    queryFn: () => fetchEmployeeDetails(selectedId),
    enabled: !!selectedId,
    staleTime: 1000 * 60 * 5,
  });

  /* ===== CREDIT QUERY ===== */
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
    placeholderData: keepPreviousData,
    enabled: !!selectedId,
    staleTime: 1000 * 30,
  });

  /* ===== APPLICATION QUERY ===== */
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
    placeholderData: keepPreviousData,
    enabled: !!selectedId && activeTab === "application",
    staleTime: 1000 * 30,
  });

  /* ===== DATA SHAPING ===== */
  const employee = employeeData?.employee || {};

  const credits = creditData?.credits || [];
  const creditPagination = creditData?.pagination || { page: 1, totalPages: 1 };

  const creditTotal =
    creditPagination?.total ??
    creditPagination?.totalItems ??
    creditPagination?.totalDocs ??
    creditData?.total;

  // ✅ pull statusCounts + totals from API (same pattern as MyCtoCreditHistory)
  const creditStatusCounts = creditData?.statusCounts || {
    ACTIVE: 0,
    EXHAUSTED: 0,
    ROLLEDBACK: 0,
  };

  const creditTotals = creditData?.totals || {
    totalUsedHours: 0,
    totalReservedHours: 0,
    totalRemainingHours: 0,
    totalCreditedHours: 0,
  };

  const applications = applicationData?.data || [];
  const appPagination = applicationData?.pagination || {
    page: 1,
    totalPages: 1,
  };

  const appTotal =
    appPagination?.total ??
    appPagination?.totalItems ??
    appPagination?.totalDocs ??
    applicationData?.total;

  const totalMemosOverall = useMemo(() => {
    return (
      (creditStatusCounts.ACTIVE || 0) +
      (creditStatusCounts.EXHAUSTED || 0) +
      (creditStatusCounts.ROLLEDBACK || 0)
    );
  }, [creditStatusCounts]);

  const fmtHours = useCallback((h) => {
    const n = Number(h || 0);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }, []);

  // ✅ Summary now comes from API totals (no manual reduce)
  const summary = useMemo(() => {
    return {
      totalCredited: Number(creditTotals.totalCreditedHours || 0),
      usedHours: Number(creditTotals.totalUsedHours || 0),
      reservedHours: Number(creditTotals.totalReservedHours || 0),
      remainingHours: Number(creditTotals.totalRemainingHours || 0),
    };
  }, [creditTotals]);

  // ✅ SAFE hide (AFTER all hooks)
  const shouldHideInfoOnSmall = !isXlUp && !selectedId;
  if (shouldHideInfoOnSmall) return null;

  /* ===== LOADING / ERROR ===== */
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

  const fullName =
    `${employee.firstName || ""} ${employee.lastName || ""}`.trim();

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 min-w-0">
      {/* HEADER */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 min-w-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 truncate">
              {fullName || "Employee"}
            </h2>
            <p className="text-sm text-neutral-500 mt-1 truncate">
              {(employee.position || "—") +
                " • " +
                (employee.department || "—")}
            </p>
            <p className="text-sm text-neutral-500 truncate">
              {employee.email || "—"}
            </p>
          </div>

          {/* Stats */}
          <div className="flex-1 lg:flex-none w-full md:w-auto min-w-0">
            {/* Tablet/Desktop */}
            <div className="hidden lg:grid md:grid-cols-2 xl:grid-cols-4 gap-3">
              <StatCard
                title="Total Credited"
                value={`${fmtHours(summary.totalCredited)}h`}
                hint={`${totalMemosOverall} memos`}
                tone="green"
              />
              <StatCard
                title="Used Hours"
                value={`${fmtHours(summary.usedHours)}h`}
                hint="Total used"
                tone="red"
              />
              <StatCard
                title="Reserved"
                value={`${fmtHours(summary.reservedHours)}h`}
                hint="Reserved in apps"
                tone="amber"
              />
              <StatCard
                title="Balance"
                value={`${fmtHours(summary.remainingHours)}h`}
                hint="Remaining hours"
                tone="blue"
              />
            </div>

            {/* Mobile compact */}
            <div className="lg:hidden grid grid-cols-2 gap-2">
              <div className="bg-white border flex justify-between items-center border-gray-100 rounded-lg p-2">
                <div className="text-[10px] text-neutral-400 uppercase font-bold truncate">
                  Balance
                </div>
                <div className="text-sm font-bold text-neutral-900 truncate">
                  {fmtHours(summary.remainingHours)}h
                </div>
              </div>
              <div className="bg-white border flex justify-between items-center border-gray-100 rounded-lg p-2">
                <div className="text-[10px] text-neutral-400 uppercase font-bold truncate">
                  Used
                </div>
                <div className="text-sm font-bold text-amber-600 truncate">
                  {fmtHours(summary.usedHours)}h
                </div>
              </div>
              <div className="bg-white border flex justify-between items-center border-gray-100 rounded-lg p-2">
                <div className="text-[10px] text-neutral-400 uppercase font-bold truncate">
                  Reserved
                </div>
                <div className="text-sm font-bold text-neutral-700 truncate">
                  {fmtHours(summary.reservedHours)}h
                </div>
              </div>
              <div className="bg-white border flex justify-between items-center border-gray-100 rounded-lg p-2">
                <div className="text-[10px] text-neutral-400 uppercase font-bold truncate">
                  Credited
                </div>
                <div className="text-sm font-bold text-neutral-900 truncate">
                  {fmtHours(summary.totalCredited)}h
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS + CONTENT */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden min-w-0">
        <div className="flex border-b border-neutral-100 overflow-x-auto no-scrollbar">
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

        <div className="px-3 pb-3 flex-1 min-h-0 overflow-hidden">
          {activeTab === "credit" ? (
            <CreditCtoTable
              credits={credits}
              page={creditPage}
              limit={creditLimit}
              status={creditStatus}
              statusCounts={creditStatusCounts} // ✅ for colored tabs counts
              search={creditSearchInput}
              totalPages={creditPagination.totalPages || 1}
              total={creditTotal}
              isLoading={isCreditLoading}
              onSearchChange={(val) => {
                setCreditPage(1);
                setCreditSearchInput(val);
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
                  p < (creditPagination.totalPages || 1) ? p + 1 : p,
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
              search={appSearchInput}
              totalPages={appPagination.totalPages || 1}
              total={appTotal}
              isLoading={isApplicationLoading}
              onSearchChange={(val) => {
                setAppPage(1);
                setAppSearchInput(val);
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
                setAppPage((p) =>
                  p < (appPagination.totalPages || 1) ? p + 1 : p,
                )
              }
              onPrevPage={() => setAppPage((p) => (p > 1 ? p - 1 : p))}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CtoEmployeeInformation;
