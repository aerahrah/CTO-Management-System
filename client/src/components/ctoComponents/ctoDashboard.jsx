import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../../api/cto";
import { useAuth } from "../../store/authStore";
import Breadcrumbs from "../breadCrumbs";
import ThemeSync from "../themeSync";
import ScrollbarsSync from "../../components/scrollbarSync";
import { usePermissions } from "../../hooks/usePermissions";

import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  TrendingUp,
  User,
  XCircle,
  UserCheck,
} from "lucide-react";

/* ------------------ Resolve theme (no tailwind dark class dependency) ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ------------------ Status styles (themed-friendly) ------------------ */
const getStatusStyle = (status) => {
  switch (status) {
    case "APPROVED":
      return {
        backgroundColor: "rgba(34,197,94,0.14)",
        borderColor: "rgba(34,197,94,0.25)",
        color: "#16a34a",
      };
    case "REJECTED":
      return {
        backgroundColor: "rgba(239,68,68,0.14)",
        borderColor: "rgba(239,68,68,0.25)",
        color: "#ef4444",
      };
    case "PENDING":
      return {
        backgroundColor: "rgba(245,158,11,0.14)",
        borderColor: "rgba(245,158,11,0.25)",
        color: "#d97706",
      };
    case "CANCELLED":
      return {
        backgroundColor: "rgba(100,116,139,0.14)",
        borderColor: "rgba(100,116,139,0.25)",
        color: "#64748b",
      };
    default:
      return {
        backgroundColor: "var(--app-surface-2)",
        borderColor: "var(--app-border)",
        color: "var(--app-muted)",
      };
  }
};

/* =========================
   UI Primitives (layout unchanged, themed via CSS vars)
========================= */
const Card = ({ children, className = "", borderColor }) => (
  <div
    className={[
      "rounded-xl shadow-sm overflow-hidden border transition-colors duration-300 ease-out",
      className,
    ].join(" ")}
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: borderColor,
    }}
  >
    {children}
  </div>
);

const CardHeader = ({ title, icon: Icon, subtitle, action, borderColor }) => (
  <div
    className="px-4 py-3 border-b transition-colors duration-300 ease-out"
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: borderColor,
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon ? (
            <Icon className="w-4 h-4" style={{ color: "var(--app-muted)" }} />
          ) : null}
          {title ? (
            <div
              className="text-sm font-semibold transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {title}
            </div>
          ) : null}
        </div>
        {subtitle ? (
          <div
            className="text-xs mt-1 leading-relaxed transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  </div>
);

const Pill = ({ children, tone = "neutral", className = "" }) => {
  const tones = {
    neutral: {
      backgroundColor: "var(--app-surface)",
      borderColor: "var(--app-border)",
      color: "var(--app-muted)",
    },
    blue: {
      backgroundColor: "var(--accent-soft)",
      borderColor: "var(--accent-soft2)",
      color: "var(--accent)",
    },
    amber: {
      backgroundColor: "rgba(245,158,11,0.14)",
      borderColor: "rgba(245,158,11,0.25)",
      color: "#d97706",
    },
    green: {
      backgroundColor: "rgba(34,197,94,0.14)",
      borderColor: "rgba(34,197,94,0.25)",
      color: "#16a34a",
    },
    rose: {
      backgroundColor: "rgba(239,68,68,0.14)",
      borderColor: "rgba(239,68,68,0.25)",
      color: "#ef4444",
    },
    dark: {
      backgroundColor: "var(--app-text)",
      borderColor: "var(--app-text)",
      color: "var(--app-surface)",
    },
    gray: {
      backgroundColor: "rgba(100,116,139,0.14)",
      borderColor: "rgba(100,116,139,0.25)",
      color: "#64748b",
    },
  };

  const s = tones[tone] || tones.neutral;

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-colors duration-300 ease-out",
        className,
      ].join(" ")}
      style={s}
    >
      {children}
    </span>
  );
};

const SectionTitle = ({ icon: Icon, title, subtitle, borderColor }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {Icon ? (
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor: borderColor,
              color: "var(--app-muted)",
            }}
          >
            <Icon className="w-4 h-4" />
          </span>
        ) : null}
        <h2
          className="text-sm font-bold tracking-tight transition-colors duration-300 ease-out"
          style={{ color: "var(--app-text)" }}
        >
          {title}
        </h2>
      </div>
      {subtitle ? (
        <p
          className="text-xs mt-1 leading-relaxed transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  </div>
);

const PrimaryButton = ({
  children,
  onClick,
  disabled,
  className = "",
  type = "button",
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={[
      "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2",
      "text-sm font-bold border transition-colors duration-300 ease-out",
      className,
    ].join(" ")}
    style={
      disabled
        ? {
            backgroundColor: "var(--app-surface-2)",
            color: "var(--app-muted)",
            borderColor: "var(--app-border)",
            cursor: "not-allowed",
            opacity: 0.7,
          }
        : {
            backgroundColor: "var(--accent)",
            color: "#fff",
            borderColor: "var(--accent)",
          }
    }
    onMouseEnter={(e) => {
      if (disabled) return;
      e.currentTarget.style.filter = "brightness(0.95)";
    }}
    onMouseLeave={(e) => {
      if (disabled) return;
      e.currentTarget.style.filter = "none";
    }}
  >
    {children}
  </button>
);

const MetricTile = ({
  label,
  value,
  icon: Icon,
  tone = "blue",
  borderColor,
}) => {
  const toneStyles = {
    blue: {
      backgroundColor: "var(--accent-soft)",
      borderColor: "var(--accent-soft2)",
      color: "var(--accent)",
    },
    green: {
      backgroundColor: "rgba(34,197,94,0.14)",
      borderColor: "rgba(34,197,94,0.25)",
      color: "#16a34a",
    },
    amber: {
      backgroundColor: "rgba(245,158,11,0.14)",
      borderColor: "rgba(245,158,11,0.25)",
      color: "#d97706",
    },
    rose: {
      backgroundColor: "rgba(239,68,68,0.14)",
      borderColor: "rgba(239,68,68,0.25)",
      color: "#ef4444",
    },
    gray: {
      backgroundColor: "var(--app-surface-2)",
      borderColor: borderColor,
      color: "var(--app-muted)",
    },
  };

  const badge = toneStyles[tone] || toneStyles.gray;

  return (
    <div
      className="rounded-xl border p-4 shadow-sm transition-colors duration-300 ease-out flex flex-col justify-between"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {label}
          </div>
          <div
            className="mt-1 text-2xl font-extrabold transition-colors duration-300 ease-out"
            style={{ color: "var(--app-text)" }}
          >
            {value}
          </div>
        </div>

        <div
          className="w-10 h-10 rounded-xl border flex items-center justify-center transition-colors duration-300 ease-out shrink-0"
          style={badge}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const Progress = ({ reservedPct = 0, usedPct = 0, borderColor }) => {
  const clamp = (n) => Math.min(Math.max(Number(n) || 0, 0), 100);

  let r = clamp(reservedPct);
  let u = clamp(usedPct);

  const sum = r + u;
  if (sum > 100 && sum > 0) {
    r = (r / sum) * 100;
    u = (u / sum) * 100;
  }

  return (
    <div
      className="w-full rounded-full border h-3 overflow-hidden transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface-2)",
        borderColor: borderColor,
      }}
    >
      <div className="h-full flex">
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${r}%`, backgroundColor: "#f59e0b" }}
          aria-label="Reserved"
        />
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${u}%`, backgroundColor: "#f43f5e" }}
          aria-label="Used"
        />
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label, icon, borderColor }) => (
  <button
    type="button"
    onClick={onClick}
    className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm border transition"
    style={
      active
        ? {
            backgroundColor: "var(--accent)",
            color: "#fff",
            borderColor: "var(--accent)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
          }
        : {
            backgroundColor: "var(--app-surface)",
            color: "var(--app-text)",
            borderColor,
          }
    }
  >
    <span
      style={{ color: active ? "rgba(255,255,255,0.9)" : "var(--app-muted)" }}
    >
      {icon}
    </span>
    <span className="font-medium">{label}</span>
  </button>
);

/* =========================
   Loading Skeleton (layout-matched) — themed via vars
========================= */
const SkeletonStyles = () => (
  <style>
    {`
      @keyframes ctoShimmer {
        0% { background-position: 100% 0; }
        100% { background-position: 0 0; }
      }
      @keyframes ctoPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .85; }
      }
      .cto-skeleton {
        position: relative;
        overflow: hidden;
        background: linear-gradient(
          90deg,
          var(--sk-base) 25%,
          var(--sk-highlight) 37%,
          var(--sk-base) 63%
        );
        background-size: 400% 100%;
        animation: ctoShimmer 1.25s ease-in-out infinite, ctoPulse 1.8s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .cto-skeleton { animation: none; }
      }
    `}
  </style>
);

const Skeleton = ({ className = "" }) => (
  <div className={["cto-skeleton", className].join(" ")} />
);

const LoadingSkeleton = ({ resolvedTheme, borderColor, isApprover }) => {
  const SkIconBox = ({ sizeClass = "w-10 h-10", inner = "w-5 h-5" }) => (
    <div
      className={[
        sizeClass,
        "rounded-xl border flex items-center justify-center transition-colors duration-300 ease-out",
      ].join(" ")}
      style={{
        backgroundColor: "var(--app-surface-2)",
        borderColor: borderColor,
      }}
    >
      <Skeleton className={[inner, "rounded-md"].join(" ")} />
    </div>
  );

  const SkPill = ({ w = "w-24" }) => (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 border transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      <Skeleton className={["h-3", w, "rounded-md"].join(" ")} />
    </span>
  );

  const SkCardHeader = ({ withAction = true }) => (
    <div
      className="px-4 py-3 border-b transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-md border flex items-center justify-center transition-colors duration-300 ease-out"
              style={{
                borderColor: borderColor,
                backgroundColor: "var(--app-surface-2)",
              }}
            >
              <Skeleton className="h-3 w-3 rounded-sm" />
            </div>
            <Skeleton className="h-5 w-36 rounded-md" />
          </div>
          <Skeleton className="mt-2 h-4 w-64 max-w-full rounded-md" />
        </div>
        {withAction ? (
          <div className="flex-shrink-0">
            <SkPill w="w-20" />
          </div>
        ) : null}
      </div>
    </div>
  );

  const SkSectionTitle = () => (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor: borderColor,
            }}
          >
            <Skeleton className="w-4 h-4 rounded-md" />
          </span>
          <Skeleton className="h-5 w-44 rounded-md" />
        </div>
        <Skeleton className="mt-2 h-4 w-80 max-w-full rounded-md" />
      </div>
    </div>
  );

  const skBase =
    resolvedTheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
  const skHi =
    resolvedTheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)";

  return (
    <div
      className="w-full flex-1 min-h-screen flex flex-col transition-colors duration-300 ease-out cto-scrollbar"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--app-text)",
        ["--sk-base"]: skBase,
        ["--sk-highlight"]: skHi,
      }}
    >
      <ThemeSync />
      <ScrollbarsSync />
      <SkeletonStyles />

      <div className="max-w-5xl mx-auto py-3 sm:py-4 w-full px-2 lg:px-0">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-8 sm:h-9 w-64 sm:w-72 rounded-lg" />
            <Skeleton className="h-5 w-[32rem] max-w-full rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <SkPill w="w-28" />
          </div>
        </div>

        {/* Skeleton Tabs (Only if they are an approver) */}
        {isApprover && (
          <div
            className="mt-6 flex gap-2 overflow-x-auto no-scrollbar p-1 rounded-2xl border transition-colors duration-300 ease-out w-fit"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor,
            }}
          >
            <div className="h-9 w-32 rounded-xl bg-[var(--sk-base)]" />
            <div className="h-9 w-40 rounded-xl bg-[var(--sk-base)] opacity-80" />
          </div>
        )}

        <div className="mt-5 space-y-4">
          <SkSectionTitle />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border p-4 shadow-sm transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: borderColor,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-3 w-24 rounded-md" />
                    <Skeleton className="mt-2 h-8 w-20 rounded-md" />
                  </div>
                  <SkIconBox sizeClass="w-10 h-10" inner="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <Card borderColor={borderColor}>
              <SkCardHeader withAction />
              <div className="p-4 h-72 flex items-center justify-center">
                <Skeleton className="h-20 w-3/4 rounded-xl" />
              </div>
            </Card>
            <Card borderColor={borderColor}>
              <SkCardHeader withAction />
              <div className="p-4 h-72 flex items-center justify-center">
                <Skeleton className="h-20 w-3/4 rounded-xl" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

const PendingRequestItem = ({ request, borderColor, isLast }) => {
  const initial = request.employeeName?.charAt(0).toUpperCase() || "?";

  const formattedDate = request.createdAt
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(new Date(request.createdAt))
    : "Date N/A";

  return (
    <div
      className="py-3 px-4 transition-colors duration-300 ease-out"
      style={{
        borderBottom: isLast ? "none" : `1px solid ${borderColor}`,
        backgroundColor: "transparent",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--app-surface-2)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "transparent")
      }
    >
      <div className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold border flex-none transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--accent-soft)",
              color: "var(--accent)",
              borderColor: "var(--accent-soft2)",
            }}
          >
            {initial}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <div
                className="text-sm font-semibold truncate transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                {request.employeeName}
              </div>
              <Pill tone="blue" className="normal-case">
                {request.requestedHours}h (CTO)
              </Pill>
            </div>
            <div
              className="mt-1 text-xs transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Submitted: {formattedDate}
            </div>
          </div>
        </div>

        <Link
          to={`/app/cto-approvals/${request.id}`}
          state={{ type: request.type }}
          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-bold border transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--accent)",
            borderColor: "var(--accent)",
            color: "#fff",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.filter = "brightness(0.95)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
        >
          Review
        </Link>
      </div>
    </div>
  );
};

/* =========================
   Main Page (Tabbed layout + theme-aware)
========================= */
const CtoDashboard = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ctoDashboard"],
    queryFn: fetchDashboard,
  });

  const { can } = usePermissions();

  const isApprover = can("cto.view_application");

  // Track the active tab ("my", "approver")
  const [activeTab, setActiveTab] = useState("my");

  // Theme-aware styling (design only)
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  useEffect(() => {}, []);

  if (isLoading)
    return (
      <LoadingSkeleton
        resolvedTheme={resolvedTheme}
        borderColor={borderColor}
        isApprover={isApprover}
      />
    );

  if (isError || !data)
    return (
      <div
        className="p-10 text-center font-medium transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-bg)",
          color: "#ef4444",
        }}
      >
        System currently unavailable. Please try again later.
      </div>
    );

  const {
    myCtoSummary,
    teamPendingApprovals,
    pendingRequests = [],
    approverStats = {
      all: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    },
  } = data;

  const totalCreditRaw = Number(myCtoSummary?.totalCredit || 0);
  const balance = Number(myCtoSummary?.balance || 0);
  const used = Number(myCtoSummary?.used || 0);
  const reserved = Number(myCtoSummary?.reserved || 0);

  const totalBase =
    totalCreditRaw > 0 ? totalCreditRaw : balance + used + reserved;
  const totalCredit = totalCreditRaw > 0 ? totalCreditRaw : totalBase;

  const reservedPct = totalBase > 0 ? (reserved / totalBase) * 100 : 0;
  const usedPct = totalBase > 0 ? (used / totalBase) * 100 : 0;
  const utilized = used + reserved;
  const utilizationPct = totalBase > 0 ? (utilized / totalBase) * 100 : 0;

  const formatDate = (dateString) => {
    if (!dateString) return "Date N/A";
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    })
      .format(new Date(dateString))
      .replace(",", " •");
  };

  const pendingCount = Number(teamPendingApprovals || 0);

  return (
    <div
      className="w-full flex-1 min-h-screen flex flex-col transition-colors duration-300 ease-out cto-scrollbar"
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--app-text)",
      }}
    >
      <ThemeSync />
      <ScrollbarsSync />

      <div className="max-w-5xl w-full mx-auto py-3 sm:py-4 px-2 lg:px-0">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <Breadcrumbs rootLabel="home" rootTo="/app" />
            <h1
              className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              CTO <span className="font-bold">Overview</span>
            </h1>
            <p
              className="text-sm mt-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Track requests, approvals, balances, and recent activity in one
              place.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Pill tone="green" className="normal-case">
              <span className="inline-flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: "#22c55e" }}
                />
                System Live
              </span>
            </Pill>
          </div>
        </div>

        {/* Dynamic Tabs (Only shown if user has Approver rights) */}
        {isApprover && (
          <div
            className="mt-6 mb-5 flex gap-2 overflow-x-auto no-scrollbar p-1 rounded-2xl border transition-colors duration-300 ease-out w-fit"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor,
            }}
          >
            <TabButton
              active={activeTab === "my"}
              onClick={() => setActiveTab("my")}
              label="My Dashboard"
              icon={<User size={16} />}
              borderColor={borderColor}
            />
            <TabButton
              active={activeTab === "approver"}
              onClick={() => setActiveTab("approver")}
              label="Approver"
              icon={<UserCheck size={16} />}
              borderColor={borderColor}
            />
          </div>
        )}

        {/* Added Margin if Tabs are Hidden */}
        {!isApprover && <div className="mt-8"></div>}

        {/* Tab Content Container */}
        <div className={isApprover ? "mt-4 space-y-6" : "space-y-6"}>
          {/* =========================================
              TAB: MY DASHBOARD 
          ========================================= */}
          {activeTab === "my" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <SectionTitle
                  icon={History}
                  title="My CTO dashboard"
                  subtitle="Your balance, usage, and request outcomes."
                  borderColor={borderColor}
                />

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <MetricTile
                    label="My Requests"
                    value={myCtoSummary?.totalRequests || 0}
                    icon={Activity}
                    tone="blue"
                    borderColor={borderColor}
                  />
                  <MetricTile
                    label="Approved"
                    value={myCtoSummary?.approved || 0}
                    icon={CheckCircle2}
                    tone="green"
                    borderColor={borderColor}
                  />
                  <MetricTile
                    label="Pending"
                    value={myCtoSummary?.pending || 0}
                    icon={Clock}
                    tone="amber"
                    borderColor={borderColor}
                  />
                  <MetricTile
                    label="Rejected"
                    value={myCtoSummary?.rejected || 0}
                    icon={AlertCircle}
                    tone="rose"
                    borderColor={borderColor}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Time Credits */}
                <Card borderColor={borderColor}>
                  <CardHeader
                    title="Time credits"
                    icon={Clock}
                    subtitle="Total credit, utilization, and available balance."
                    borderColor={borderColor}
                    action={
                      <Pill tone="blue">
                        {utilizationPct.toFixed(0)}% utilized
                      </Pill>
                    }
                  />
                  <div className="p-4">
                    <div
                      className="rounded-xl border p-4 transition-colors duration-300 ease-out"
                      style={{
                        borderColor: borderColor,
                        backgroundColor: "var(--app-surface)",
                      }}
                    >
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div
                            className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Hours left
                          </div>
                          <div
                            className="mt-1 text-5xl font-extrabold tracking-tight transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-text)" }}
                          >
                            {balance.toFixed(1)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className="text-xs font-semibold transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Total Credited Hours:{" "}
                            <span
                              className="font-bold transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-text)" }}
                            >
                              {totalCredit.toFixed(1)}h
                            </span>
                          </div>
                          <div
                            className="text-xs font-semibold mt-0.5 transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Reserved:{" "}
                            <span
                              className="font-bold transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-text)" }}
                            >
                              {reserved.toFixed(1)}h
                            </span>
                          </div>
                          <div
                            className="text-xs font-semibold mt-0.5 transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Used:{" "}
                            <span
                              className="font-bold transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-text)" }}
                            >
                              {used.toFixed(1)}h
                            </span>
                          </div>
                          <div
                            className="text-xs mt-0.5 transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Balance:{" "}
                            <span
                              className="font-semibold transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-text)" }}
                            >
                              {balance.toFixed(1)}h
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2">
                        <Progress
                          reservedPct={reservedPct}
                          usedPct={usedPct}
                          borderColor={borderColor}
                        />

                        <div
                          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          <div className="inline-flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full border"
                              style={{
                                backgroundColor: "rgba(148,163,184,0.45)",
                                borderColor: borderColor,
                              }}
                            />
                            <span>Balance</span>
                          </div>

                          {reserved > 0 ? (
                            <div className="inline-flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: "#f59e0b" }}
                              />
                              <span>Reserved</span>
                            </div>
                          ) : null}

                          {used > 0 ? (
                            <div className="inline-flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: "#f43f5e" }}
                              />
                              <span>Used</span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-4 gap-2">
                        {[
                          { k: "Total", v: `${totalCredit.toFixed(1)}h` },
                          { k: "Balance", v: `${balance.toFixed(1)}h` },
                          { k: "Reserved", v: `${reserved.toFixed(1)}h` },
                          { k: "Used", v: `${used.toFixed(1)}h` },
                        ].map((t) => (
                          <div
                            key={t.k}
                            className="rounded-lg border p-3 transition-colors duration-300 ease-out"
                            style={{
                              borderColor: borderColor,
                              backgroundColor: "var(--app-surface-2)",
                            }}
                          >
                            <div
                              className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-muted)" }}
                            >
                              {t.k}
                            </div>
                            <div
                              className="mt-1 text-sm font-bold transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-text)" }}
                            >
                              {t.v}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* My Recent Activity */}
                <Card borderColor={borderColor}>
                  <CardHeader
                    title="My recent requests"
                    icon={Calendar}
                    subtitle={`Last ${myCtoSummary?.recentRequests?.length || 0} submissions`}
                    borderColor={borderColor}
                    action={
                      <div className="flex items-center gap-2">
                        <Pill
                          tone={
                            myCtoSummary?.recentRequests?.length
                              ? "blue"
                              : "neutral"
                          }
                        >
                          {myCtoSummary?.recentRequests?.length || 0} recent
                        </Pill>
                        <Link
                          to={`/app/cto-apply/`}
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold border transition-colors duration-300 ease-out"
                          style={{
                            backgroundColor: "var(--accent)",
                            borderColor: "var(--accent)",
                            color: "#fff",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.filter = "brightness(0.95)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.filter = "none")
                          }
                        >
                          ({myCtoSummary?.totalRequests || 0}) View all
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    }
                  />
                  <div className="p-4">
                    {myCtoSummary?.recentRequests &&
                    myCtoSummary.recentRequests.length > 0 ? (
                      <div
                        className="border rounded-xl overflow-y-auto max-h-72 cto-scrollbar transition-colors duration-300 ease-out"
                        style={{
                          borderColor: borderColor,
                          backgroundColor: "var(--app-surface)",
                        }}
                      >
                        {myCtoSummary.recentRequests.map((request, idx) => {
                          const isLast =
                            idx === myCtoSummary.recentRequests.length - 1;
                          const st = getStatusStyle(request.overallStatus);

                          return (
                            <div
                              key={request._id}
                              className="py-3 px-4 transition-colors duration-300 ease-out"
                              style={{
                                borderBottom: isLast
                                  ? "none"
                                  : `1px solid ${borderColor}`,
                                backgroundColor: "transparent",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "var(--app-surface-2)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }}
                            >
                              <div className="flex flex-row items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div
                                    className="w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors duration-300 ease-out"
                                    style={{
                                      borderColor: borderColor,
                                      backgroundColor: "var(--app-surface-2)",
                                      color: "var(--app-muted)",
                                    }}
                                  >
                                    <User className="w-4 h-4" />
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                      <div
                                        className="text-sm font-semibold truncate transition-colors duration-300 ease-out"
                                        style={{ color: "var(--app-text)" }}
                                      >
                                        Request #
                                        {request._id.slice(-6).toUpperCase()}
                                      </div>
                                      <Pill tone="blue" className="normal-case">
                                        {request.requestedHours}h
                                      </Pill>
                                    </div>
                                    <div
                                      className="mt-1 text-xs transition-colors duration-300 ease-out"
                                      style={{ color: "var(--app-muted)" }}
                                    >
                                      Submitted: {formatDate(request.createdAt)}
                                    </div>
                                  </div>
                                </div>

                                <span
                                  className={[
                                    "inline-flex items-center rounded-full px-2.5 py-1 text-[10px]",
                                    "font-bold uppercase tracking-wider border w-fit transition-colors duration-300 ease-out",
                                  ].join(" ")}
                                  style={st}
                                >
                                  {request.overallStatus}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        className="rounded-xl border border-dashed p-6 text-center transition-colors duration-300 ease-out"
                        style={{
                          borderColor: borderColor,
                          backgroundColor: "var(--app-surface-2)",
                        }}
                      >
                        <div
                          className="text-sm font-semibold transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-text)" }}
                        >
                          No recent requests found.
                        </div>
                        <div
                          className="text-xs mt-1 transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Submit a request to start tracking activity here.
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* =========================================
              TAB: APPROVER SECTION
          ========================================= */}
          {activeTab === "approver" && isApprover && (
            <div className="space-y-6">
              <div className="space-y-3">
                <SectionTitle
                  icon={UserCheck}
                  title="Approver Activity"
                  subtitle="Status of applications routed to you for review."
                  borderColor={borderColor}
                />
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                  <MetricTile
                    label="Routed to Me"
                    value={approverStats.all || 0}
                    icon={Activity}
                    tone="blue"
                    borderColor={borderColor}
                  />
                  <MetricTile
                    label="Approved"
                    value={approverStats.approved || 0}
                    icon={CheckCircle2}
                    tone="green"
                    borderColor={borderColor}
                  />
                  <MetricTile
                    label="Pending Review"
                    value={approverStats.pending || 0}
                    icon={Clock}
                    tone="amber"
                    borderColor={borderColor}
                  />
                  <MetricTile
                    label="Rejected"
                    value={approverStats.rejected || 0}
                    icon={AlertCircle}
                    tone="rose"
                    borderColor={borderColor}
                  />
                  <MetricTile
                    label="Cancelled"
                    value={approverStats.cancelled || 0}
                    icon={XCircle}
                    tone="gray"
                    borderColor={borderColor}
                  />
                </div>
              </div>

              {/* Pending Queue & Recent Pending Layout */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Approvals queue */}
                <Card className="relative" borderColor={borderColor}>
                  <CardHeader
                    title="Approvals queue"
                    icon={AlertCircle}
                    subtitle="Items currently awaiting your review."
                    borderColor={borderColor}
                  />

                  <div className="p-4">
                    <div
                      className="rounded-xl flex flex-col justify-between h-72 border p-4 transition-colors duration-300 ease-out"
                      style={{
                        borderColor: borderColor,
                        backgroundColor: "var(--app-surface-2)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 ">
                          <div
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Action required
                          </div>

                          <div
                            className="mt-1 text-5xl md:text-6xl font-extrabold"
                            style={{ color: "var(--app-text)" }}
                          >
                            {pendingCount}
                          </div>

                          <div
                            className="mt-2 text-sm leading-relaxed"
                            style={{ color: "var(--app-muted)" }}
                          >
                            {pendingCount > 0
                              ? "Employees are waiting for your approval."
                              : "All caught up! No approvals currently pending."}
                          </div>
                        </div>

                        <div
                          className="flex-shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center"
                          style={{
                            borderColor: borderColor,
                            backgroundColor: "var(--app-surface)",
                            color: "var(--app-muted)",
                          }}
                        >
                          <TrendingUp className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="mt-4">
                        <PrimaryButton
                          disabled={pendingCount === 0}
                          onClick={() => {
                            if (pendingCount > 0)
                              window.location.href = "/app/cto-approvals";
                          }}
                          className="w-full"
                        >
                          {pendingCount > 0 ? "Process approvals" : "Complete"}
                        </PrimaryButton>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Recent Pending */}
                <Card borderColor={borderColor}>
                  <CardHeader
                    title="Recent pending requests"
                    icon={History}
                    subtitle="Latest inbound submissions needing review."
                    borderColor={borderColor}
                    action={
                      <div className="flex items-center gap-2">
                        <Pill
                          tone={pendingRequests.length ? "amber" : "neutral"}
                        >
                          {pendingRequests.length} new
                        </Pill>
                        <Link
                          to={`/app/cto-approvals/`}
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold border transition-colors duration-300 ease-out"
                          style={{
                            backgroundColor: "var(--accent)",
                            borderColor: "var(--accent)",
                            color: "#fff",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.filter = "brightness(0.95)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.filter = "none")
                          }
                        >
                          ({pendingCount}) View all
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    }
                  />

                  <div className="p-4">
                    {pendingRequests.length > 0 ? (
                      <div
                        className="border rounded-xl overflow-y-auto max-h-72 cto-scrollbar transition-colors duration-300 ease-out"
                        style={{
                          borderColor: borderColor,
                          backgroundColor: "var(--app-surface)",
                        }}
                      >
                        {pendingRequests.map((req, idx) => (
                          <PendingRequestItem
                            key={req.id || req._id}
                            request={req}
                            borderColor={borderColor}
                            isLast={idx === pendingRequests.length - 1}
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        className="rounded-xl border border-dashed p-6 text-center"
                        style={{
                          borderColor: borderColor,
                          backgroundColor: "var(--app-surface-2)",
                        }}
                      >
                        <div
                          className="text-sm font-semibold"
                          style={{ color: "var(--app-text)" }}
                        >
                          No new requests
                        </div>
                        <div
                          className="text-xs mt-1"
                          style={{ color: "var(--app-muted)" }}
                        >
                          You’re all set—nothing to review right now.
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CtoDashboard;
