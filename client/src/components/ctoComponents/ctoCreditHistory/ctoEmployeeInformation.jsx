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
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../store/authStore";

/* ------------------ Resolve theme (no tailwind dark class dependency) ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ✅ Reactive resolved theme for system mode (prevents skeleton flashes) */
function useResolvedTheme(prefTheme) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined")
      return prefTheme === "dark" ? "dark" : "light";
    return resolveTheme(prefTheme);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (prefTheme !== "system") {
      setTheme(prefTheme === "dark" ? "dark" : "light");
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(mq.matches ? "dark" : "light");

    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, [prefTheme]);

  return theme;
}

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
   SKELETON (theme-aware)
========================= */
const EmployeeInfoSkeleton = ({ borderColor }) => (
  <div className="space-y-4">
    <div
      className="rounded-xl border shadow-sm"
      style={{ borderColor, backgroundColor: "var(--app-surface)" }}
    >
      <div className="p-4">
        <Skeleton height={22} width={"42%"} />
        <div className="mt-2">
          <Skeleton height={14} width={"55%"} />
        </div>
        <div className="mt-2">
          <Skeleton height={14} width={"45%"} />
        </div>
      </div>
    </div>

    <div
      className="rounded-xl border shadow-sm overflow-hidden"
      style={{ borderColor, backgroundColor: "var(--app-surface)" }}
    >
      <div className="p-4 border-b" style={{ borderColor }}>
        <Skeleton height={14} width={220} />
      </div>
      <div className="p-4">
        <Skeleton height={420} />
      </div>
    </div>
  </div>
);

/* =========================
   UI: StatCard + Tabs (theme-aware)
========================= */
const StatCard = ({ title, value, hint, tone = "neutral", borderColor }) => {
  const valueColor = useMemo(() => {
    switch (tone) {
      case "blue":
        return "var(--accent)";
      case "green":
        return "#16a34a";
      case "red":
        return "#ef4444";
      case "amber":
        return "#d97706";
      default:
        return "var(--app-text)";
    }
  }, [tone]);

  return (
    <div
      className="w-full flex-shrink-0 border rounded-xl shadow-sm p-3 flex items-start gap-3 h-full"
      role="status"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor,
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] uppercase font-bold tracking-wide truncate"
          style={{ color: "var(--app-muted)" }}
        >
          {title}
        </div>
        <div
          className="mt-0.5 text-lg font-bold truncate"
          style={{ color: valueColor }}
        >
          {value}
        </div>
        {hint && (
          <div
            className="text-[11px] truncate"
            style={{ color: "var(--app-muted)" }}
          >
            {hint}
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label, borderColor }) => {
  return (
    <button
      onClick={onClick}
      className="px-4 sm:px-6 py-3 text-sm font-semibold transition border-b-2 whitespace-nowrap"
      style={{
        borderBottomColor: active ? "var(--accent)" : "transparent",
        color: active ? "var(--accent)" : "var(--app-muted)",
      }}
      onMouseEnter={(e) => {
        if (active) return;
        e.currentTarget.style.color = "var(--app-text)";
      }}
      onMouseLeave={(e) => {
        if (active) return;
        e.currentTarget.style.color = "var(--app-muted)";
      }}
      type="button"
    >
      {label}
    </button>
  );
};

/* =========================
   MAIN COMPONENT
========================= */
const CtoEmployeeInformation = ({ isEmployeeLoadingFromEmployeeList }) => {
  const [activeTab, setActiveTab] = useState("credit");
  const { id: selectedId } = useParams();
  const isXlUp = useIsXlUp();

  // ✅ Theme vars come from global ThemeSync in App.jsx, but we still compute:
  // - borderColor (theme-aware)
  // - skeleton colors (theme-aware + safe fallbacks)
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColors = useMemo(() => {
    const base =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(15,23,42,0.06)";
    const highlight =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(15,23,42,0.10)";
    return {
      baseColor: `var(--skeleton-base, ${base})`,
      highlightColor: `var(--skeleton-highlight, ${highlight})`,
    };
  }, [resolvedTheme]);

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

  // ✅ statusCounts + totals from API
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
    return (
      <SkeletonTheme
        baseColor={skeletonColors.baseColor}
        highlightColor={skeletonColors.highlightColor}
      >
        <EmployeeInfoSkeleton borderColor={borderColor} />
      </SkeletonTheme>
    );
  }

  if (isEmployeeError || isCreditError || isApplicationError) {
    return (
      <div
        className="p-6 text-center rounded-xl border"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor,
          color: "#ef4444",
        }}
      >
        Failed to load employee data.
      </div>
    );
  }

  const fullName =
    `${employee.firstName || ""} ${employee.lastName || ""}`.trim();

  return (
    <SkeletonTheme
      baseColor={skeletonColors.baseColor}
      highlightColor={skeletonColors.highlightColor}
    >
      <div className="h-full min-h-0 flex flex-col gap-3 min-w-0">
        {/* HEADER */}
        <div
          className="border rounded-xl shadow-sm p-4"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor,
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 min-w-0">
            <div className="min-w-0 flex-1">
              <h2
                className="text-xl sm:text-2xl font-bold truncate"
                style={{ color: "var(--app-text)" }}
              >
                {fullName || "Employee"}
              </h2>
              <p
                className="text-sm mt-1 truncate"
                style={{ color: "var(--app-muted)" }}
              >
                {(employee.position || "—") +
                  " • " +
                  (employee.department || "—")}
              </p>
              <p
                className="text-sm truncate"
                style={{ color: "var(--app-muted)" }}
              >
                {employee.email || "—"}
              </p>
            </div>

            {/* Stats */}
            <div className="flex-1 lg:flex-none w-full md:w-auto min-w-0">
              {/* Desktop */}
              <div className="hidden lg:grid md:grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard
                  title="Total Credited"
                  value={`${fmtHours(summary.totalCredited)}h`}
                  hint={`${totalMemosOverall} memos`}
                  tone="green"
                  borderColor={borderColor}
                />
                <StatCard
                  title="Used Hours"
                  value={`${fmtHours(summary.usedHours)}h`}
                  hint="Total used"
                  tone="red"
                  borderColor={borderColor}
                />
                <StatCard
                  title="Reserved"
                  value={`${fmtHours(summary.reservedHours)}h`}
                  hint="Reserved in apps"
                  tone="amber"
                  borderColor={borderColor}
                />
                <StatCard
                  title="Balance"
                  value={`${fmtHours(summary.remainingHours)}h`}
                  hint="Remaining hours"
                  tone="blue"
                  borderColor={borderColor}
                />
              </div>

              {/* Mobile compact */}
              <div className="lg:hidden grid grid-cols-2 gap-2">
                {[
                  {
                    k: "Balance",
                    v: `${fmtHours(summary.remainingHours)}h`,
                    c: "var(--accent)",
                  },
                  {
                    k: "Used",
                    v: `${fmtHours(summary.usedHours)}h`,
                    c: "#d97706",
                  },
                  {
                    k: "Reserved",
                    v: `${fmtHours(summary.reservedHours)}h`,
                    c: "var(--app-text)",
                  },
                  {
                    k: "Credited",
                    v: `${fmtHours(summary.totalCredited)}h`,
                    c: "var(--app-text)",
                  },
                ].map((x) => (
                  <div
                    key={x.k}
                    className="border rounded-xl p-2 flex justify-between items-center min-w-0"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      borderColor,
                    }}
                  >
                    <div
                      className="text-[10px] uppercase font-bold truncate"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {x.k}
                    </div>
                    <div
                      className="text-sm font-bold truncate"
                      style={{ color: x.c }}
                    >
                      {x.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TABS + CONTENT */}
        <div
          className="border rounded-xl shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden min-w-0"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor,
          }}
        >
          <div
            className="flex border-b overflow-x-auto no-scrollbar"
            style={{ borderColor }}
          >
            <TabButton
              active={activeTab === "credit"}
              onClick={() => setActiveTab("credit")}
              label="Credit CTO"
              borderColor={borderColor}
            />
            <TabButton
              active={activeTab === "application"}
              onClick={() => setActiveTab("application")}
              label="Application CTO"
              borderColor={borderColor}
            />
          </div>

          <div className="px-3 pb-3 flex-1 min-h-0 overflow-hidden">
            {activeTab === "credit" ? (
              <CreditCtoTable
                credits={credits}
                page={creditPage}
                limit={creditLimit}
                status={creditStatus}
                statusCounts={creditStatusCounts}
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
    </SkeletonTheme>
  );
};

export default CtoEmployeeInformation;
