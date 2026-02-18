// pages/cto/CtoDashboard.jsx
import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../../api/cto";
import { useAuth } from "../../store/authStore";
import Breadcrumbs from "../breadCrumbs";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  ShieldCheck,
  TrendingUp,
  User,
} from "lucide-react";

/* =========================
   UI Primitives (Premium SaaS vibe)
========================= */
const Card = ({ children, className = "" }) => (
  <div
    className={[
      "bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);

const CardHeader = ({ title, icon: Icon, subtitle, action }) => (
  <div className="px-4 py-3 border-b border-gray-100 bg-white">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="w-4 h-4 text-gray-600" /> : null}
          {title ? (
            <div className="text-sm font-semibold text-gray-900">{title}</div>
          ) : null}
        </div>
        {subtitle ? (
          <div className="text-xs text-gray-500 mt-1 leading-relaxed">
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
    neutral: "bg-gray-50 border-gray-200 text-gray-700",
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    green: "bg-emerald-50 border-emerald-100 text-emerald-700",
    rose: "bg-rose-50 border-rose-100 text-rose-700",
    dark: "bg-gray-900 border-gray-900 text-white",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border",
        tones[tone] || tones.neutral,
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
};

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-700 border border-gray-200">
            <Icon className="w-4 h-4" />
          </span>
        ) : null}
        <h2 className="text-sm font-bold text-gray-900 tracking-tight">
          {title}
        </h2>
      </div>
      {subtitle ? (
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{subtitle}</p>
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
      "text-sm font-bold border transition",
      disabled
        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
        : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700",
      className,
    ].join(" ")}
  >
    {children}
  </button>
);

const MetricTile = ({ label, value, icon: Icon, tone = "blue" }) => {
  const toneMap = {
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    green: "bg-emerald-50 border-emerald-100 text-emerald-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    rose: "bg-rose-50 border-rose-100 text-rose-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {label}
          </div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">
            {value}
          </div>
        </div>

        <div
          className={[
            "w-10 h-10 rounded-xl border flex items-center justify-center",
            toneMap[tone] || toneMap.gray,
          ].join(" ")}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const Progress = ({ reservedPct = 0, usedPct = 0 }) => {
  const clamp = (n) => Math.min(Math.max(Number(n) || 0, 0), 100);

  let r = clamp(reservedPct);
  let u = clamp(usedPct);

  const sum = r + u;
  if (sum > 100 && sum > 0) {
    r = (r / sum) * 100;
    u = (u / sum) * 100;
  }

  return (
    <div className="w-full rounded-full bg-gray-100 border border-gray-200 h-3 overflow-hidden">
      <div className="h-full flex">
        <div
          className="h-full bg-amber-500 transition-all duration-700"
          style={{ width: `${r}%` }}
          aria-label="Reserved"
        />
        <div
          className="h-full bg-rose-500 transition-all duration-700"
          style={{ width: `${u}%` }}
          aria-label="Used"
        />
      </div>
    </div>
  );
};

const getStatusStyles = (status) => {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-50 border-emerald-100 text-emerald-700";
    case "REJECTED":
      return "bg-rose-50 border-rose-100 text-rose-700";
    case "PENDING":
      return "bg-amber-50 border-amber-100 text-amber-700";
    default:
      return "bg-gray-50 border-gray-200 text-gray-700";
  }
};

/* =========================
   Loading Skeleton (layout-matched)
========================= */
const Skeleton = ({ className = "" }) => (
  <div className={["bg-gray-100 rounded-lg", className].join(" ")} />
);

const LoadingSkeleton = ({ role }) => {
  const showOrg = role === "admin" || role === "hr";

  return (
    <div
      className="w-full flex-1 min-h-screen flex flex-col"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className=" w-full mx-auto py-3 sm:py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-9 w-56" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>

          {/* Stack until XL so tablet width isn't cramped (sidebar eats space) */}
          <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-8 space-y-4">
              {showOrg ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-52 w-full" />
                <Skeleton className="h-52 w-full" />
              </div>

              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>

            <div className="xl:col-span-4 space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-80 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================
   Sub-components
========================= */
const ActionItem = ({ label, link, icon: Icon }) => (
  <button
    type="button"
    onClick={() => (window.location.href = link)}
    className={[
      "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5",
      "border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition",
      "text-left",
    ].join(" ")}
  >
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700">
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">
          {label}
        </div>
        <div className="text-xs text-gray-500">Quick access</div>
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-gray-300" />
  </button>
);

const PendingRequestItem = ({ request }) => {
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
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold border border-blue-200 flex-none">
            {initial}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {request.employeeName}
              </div>
              <Pill tone="blue" className="normal-case">
                {request.requestedHours}h
              </Pill>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Submitted: {formattedDate}
            </div>
          </div>
        </div>

        <Link
          to={`/app/cto-approvals/${request.id}`}
          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-bold border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 transition "
        >
          Review
        </Link>
      </div>
    </div>
  );
};

/* =========================
   Main Page (logic unchanged)
========================= */
const CtoDashboard = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ctoDashboard"],
    queryFn: fetchDashboard,
  });

  const { admin } = useAuth();
  const role = admin?.role;

  if (isLoading) return <LoadingSkeleton role={role} />;

  if (isError || !data)
    return (
      <div className="p-10 text-center text-rose-600 font-medium">
        System currently unavailable. Please try again later.
      </div>
    );

  const {
    myCtoSummary,
    teamPendingApprovals,
    totalRequests,
    approvedRequests,
    rejectedRequests,
    quickActions,
    quickLinks,
    totalCreditedCount,
    totalRolledBackCount,
    totalPendingRequests,
    pendingRequests = [],
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
    <div className="w-full flex-1 min-h-screen flex flex-col">
      <div className="w-full mx-auto py-3 sm:py-4">
        <div className="mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="min-w-0">
              <Breadcrumbs rootLabel="home" rootTo="/app" />
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                CTO <span className="font-bold">Overview</span>
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Track requests, approvals, balances, and recent activity in one
                place.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Pill tone="green" className="normal-case">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  System Live
                </span>
              </Pill>
            </div>
          </div>

          {/* Stack main + right rail until XL (better with sidebar on tablet) */}
          <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* MAIN */}
            <div className="xl:col-span-8 space-y-4">
              {/* Organization Insights */}
              {(role === "admin" || role === "hr") && (
                <div className="space-y-3">
                  <SectionTitle
                    icon={ShieldCheck}
                    title="Organization insights"
                    subtitle="View total, approved, pending, rejected requests across the organization."
                  />

                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <MetricTile
                      label="Total Requests"
                      value={totalRequests || 0}
                      icon={Activity}
                      tone="blue"
                    />
                    <MetricTile
                      label="Approved"
                      value={approvedRequests || 0}
                      icon={CheckCircle2}
                      tone="green"
                    />
                    <MetricTile
                      label="Pending Review"
                      value={totalPendingRequests || 0}
                      icon={Clock}
                      tone="amber"
                    />
                    <MetricTile
                      label="Total Rejected"
                      value={
                        (rejectedRequests || 0) + (totalRolledBackCount || 0)
                      }
                      icon={AlertCircle}
                      tone="rose"
                    />
                  </div>
                </div>
              )}

              {/* Priority row (2-up on tablet, stacked on phone) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Urgent Approvals */}
                <Card className="relative">
                  <CardHeader
                    title="Approvals queue"
                    icon={AlertCircle}
                    subtitle="Items awaiting your review."
                    action={
                      pendingCount > 0 ? (
                        <Pill tone="amber">{pendingCount} pending</Pill>
                      ) : (
                        <Pill tone="green">Cleared</Pill>
                      )
                    }
                  />

                  <div className="p-4">
                    <div className="rounded-xl flex flex-col justify-between h-56 border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 ">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Pending approvals
                          </div>
                          <div className="mt-1 text-5xl font-extrabold text-blue-700">
                            {pendingCount}
                          </div>
                          <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                            {pendingCount > 0
                              ? "Some employees are waiting for approval."
                              : "All caught up! No approvals currently pending."}
                          </div>
                        </div>

                        <div className="flex-shrink-0 w-12 h-12 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-700">
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
                <Card>
                  <CardHeader
                    title="Recent pending requests"
                    icon={History}
                    subtitle="Latest inbound submissions needing review."
                    action={
                      <Pill tone={pendingRequests.length ? "amber" : "neutral"}>
                        {pendingRequests.length} new
                      </Pill>
                    }
                  />
                  <div className="p-4">
                    {pendingRequests.length > 0 ? (
                      <div className="max-h-56 overflow-y-auto pr-1">
                        {pendingRequests.map((req) => (
                          <PendingRequestItem key={req.id} request={req} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                        <div className="text-sm font-semibold text-gray-900">
                          No new requests
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          You’re all set—nothing to review right now.
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* My CTO Dashboard */}
              <div className="space-y-3">
                <SectionTitle
                  icon={History}
                  title="My CTO dashboard"
                  subtitle="Your balance, usage, and request outcomes."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Time Credits */}
                  <Card>
                    <CardHeader
                      title="Time credits"
                      icon={Clock}
                      subtitle="Total credit, utilization, and available balance."
                      action={
                        <Pill tone="blue">
                          {utilizationPct.toFixed(0)}% utilized
                        </Pill>
                      }
                    />
                    <div className="p-4">
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              Hours left
                            </div>
                            <div className="mt-1 text-5xl font-extrabold text-gray-900 tracking-tight">
                              {balance.toFixed(1)}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs font-semibold text-gray-700">
                              Total Credited Hours:{" "}
                              <span className="font-bold">
                                {totalCredit.toFixed(1)}h
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-gray-700 mt-0.5">
                              Reserved:{" "}
                              <span className="font-bold">
                                {reserved.toFixed(1)}h
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-gray-700 mt-0.5">
                              Used:{" "}
                              <span className="font-bold">
                                {used.toFixed(1)}h
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Balance:{" "}
                              <span className="font-semibold text-gray-700">
                                {balance.toFixed(1)}h
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <Progress
                            reservedPct={reservedPct}
                            usedPct={usedPct}
                          />

                          {/* Legend: Balance (grey) + Reserved (amber) + Used (rose) */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-gray-500">
                            <div className="inline-flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-gray-300 border border-gray-200" />
                              <span>Balance</span>
                            </div>

                            {reserved > 0 ? (
                              <div className="inline-flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                <span>Reserved</span>
                              </div>
                            ) : null}

                            {used > 0 ? (
                              <div className="inline-flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                <span>Used</span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-4 gap-2">
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              Total
                            </div>
                            <div className="mt-1 text-sm font-bold text-gray-900">
                              {totalCredit.toFixed(1)}h
                            </div>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              Balance
                            </div>
                            <div className="mt-1 text-sm font-bold text-gray-900">
                              {balance.toFixed(1)}h
                            </div>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              Reserved
                            </div>
                            <div className="mt-1 text-sm font-bold text-gray-900">
                              {reserved.toFixed(1)}h
                            </div>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              Used
                            </div>
                            <div className="mt-1 text-sm font-bold text-gray-900">
                              {used.toFixed(1)}h
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Mini stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <MetricTile
                      label="My Requests"
                      value={myCtoSummary?.totalRequests || 0}
                      icon={Activity}
                      tone="gray"
                    />
                    <MetricTile
                      label="Approved"
                      value={myCtoSummary?.approved || 0}
                      icon={CheckCircle2}
                      tone="green"
                    />
                    <MetricTile
                      label="Rejected"
                      value={myCtoSummary?.rejected || 0}
                      icon={AlertCircle}
                      tone="rose"
                    />
                    <MetricTile
                      label="Pending"
                      value={myCtoSummary?.pending || 0}
                      icon={Clock}
                      tone="amber"
                    />
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader
                  title="My recent requests"
                  icon={Calendar}
                  subtitle={`Last ${
                    myCtoSummary?.recentRequests?.length || 0
                  } submissions`}
                  action={
                    <Link
                      to={`/app/cto-apply/`}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                      ({myCtoSummary?.totalRequests || 0}) View all
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  }
                />
                <div className="p-4">
                  {myCtoSummary?.recentRequests &&
                  myCtoSummary.recentRequests.length > 0 ? (
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                      {myCtoSummary.recentRequests.map((request) => (
                        <div
                          key={request._id}
                          className="p-4 hover:bg-gray-50 transition"
                        >
                          <div className="flex flex-row items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700 flex-shrink-0">
                                <User className="w-4 h-4" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                  <div className="text-sm font-semibold text-gray-900 truncate">
                                    Request #
                                    {request._id.slice(-6).toUpperCase()}
                                  </div>
                                  <Pill tone="blue" className="normal-case">
                                    {request.requestedHours}h
                                  </Pill>
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  Submitted: {formatDate(request.createdAt)}
                                </div>
                              </div>
                            </div>

                            <span
                              className={[
                                "inline-flex items-center rounded-full px-2.5 py-1 text-[10px]",
                                "font-bold uppercase tracking-wider border w-fit",
                                getStatusStyles(request.overallStatus),
                              ].join(" ")}
                            >
                              {request.overallStatus}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                      <div className="text-sm font-semibold text-gray-900">
                        No recent requests found.
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Submit a request to start tracking activity here.
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* RIGHT RAIL (stacks below main until XL) */}
            <div className="xl:col-span-4 space-y-4">
              <Card>
                <CardHeader
                  title="Action center"
                  icon={TrendingUp}
                  subtitle="Shortcuts to common tasks and links."
                />
                <div className="p-4 space-y-3">
                  <div className="space-y-2">
                    {quickActions?.slice(0, 4).map((action, idx) => (
                      <ActionItem
                        key={`qa-${idx}`}
                        label={action.name}
                        link={action.link}
                        icon={Briefcase}
                      />
                    ))}
                    {quickLinks?.slice(0, 4).map((link, idx) => (
                      <ActionItem
                        key={`ql-${idx}`}
                        label={link.name}
                        link={link.link}
                        icon={ArrowUpRight}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* NOTE: totalCreditedCount kept from payload (unused), per original */}
          {typeof totalCreditedCount !== "undefined" ? null : null}
        </div>
      </div>
    </div>
  );
};

export default CtoDashboard;
