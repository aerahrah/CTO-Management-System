import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../../api/cto";
import { useAuth } from "../../store/authStore";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Briefcase,
  ArrowUpRight,
  LayoutGrid,
  ChevronRight,
  Activity,
  History,
  ShieldCheck,
  User,
  Calendar,
} from "lucide-react";

// --- ENHANCED UI COMPONENTS ---

const DashboardCard = ({
  children,
  className = "",
  title,
  action,
  subtitle,
}) => (
  <div
    className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col transition-all hover:shadow-md hover:border-indigo-100 ${className}`}
  >
    {(title || action) && (
      <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center">
        <div>
          {title && (
            <h3 className="font-bold text-slate-800 text-sm tracking-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    )}
    <div className="px-6 py-1 flex-1 relative">{children}</div>
  </div>
);

const StatBadge = ({ label, value, icon: Icon, colorClass, trend }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-all duration-300">
    <div className="space-y-1">
      <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-extrabold text-slate-900">{value}</p>
        {trend && (
          <span className="text-[10px] text-emerald-500 font-bold">
            ↑ {trend}
          </span>
        )}
      </div>
    </div>
    <div
      className={`p-3 rounded-xl transition-transform group-hover:scale-110 duration-300 ${colorClass}`}
    >
      <Icon size={22} />
    </div>
  </div>
);

const ActionButton = ({ label, link, icon: Icon, variant = "default" }) => (
  <button
    onClick={() => (window.location.href = link)}
    className={`
      group flex items-center bg-slate-50 border-slate-200 gap-4 p-2 rounded-xl transition-all duration-200 border w-full text-left
      ${
        variant === "urgent"
          ? "bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100"
          : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5"
      }
    `}
  >
    <div
      className={`p-2 rounded-lg ${variant === "urgent" ? "bg-rose-200/50" : "bg-white border border-slate-200 group-hover:border-indigo-100 group-hover:text-indigo-600 transition-colors"}`}
    >
      <Icon size={18} />
    </div>
    <div className="flex-1">
      <span className="text-[13.5px] font-bold block">{label}</span>
      <span className="text-[10px] text-slate-400 block mt-0.5">
        Quick Access
      </span>
    </div>
    <ChevronRight
      size={14}
      className="text-slate-300 group-hover:text-indigo-400 transition-transform group-hover:translate-x-1"
    />
  </button>
);

const SectionHeader = ({ title, icon: Icon }) => (
  <div className="flex items-center gap-2 mb-4 mt-8 first:mt-0">
    <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
      <Icon size={16} />
    </div>
    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">
      {title}
    </h2>
  </div>
);

const getStatusStyles = (status) => {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "REJECTED":
      return "bg-red-100 text-red-700";
    case "PENDING":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

// Loading Skeleton Component for better UX
const LoadingSkeleton = () => (
  <div className="min-h-screen bg-[#fcfcfd] p-6 lg:p-10 font-sans text-slate-800 animate-pulse">
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="h-10 bg-slate-200 rounded-xl"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-200 rounded-2xl"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="h-64 bg-slate-200 rounded-2xl"></div>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-4 space-y-8">
          <div className="h-48 bg-slate-200 rounded-2xl"></div>
          <div className="h-64 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    </div>
  </div>
);

// --- MAIN DASHBOARD ---

const CtoDashboard = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ctoDashboard"],
    queryFn: fetchDashboard,
  });

  const { admin } = useAuth();
  const role = admin?.role;

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !data)
    return (
      <div className="p-10 text-center text-rose-500 font-medium">
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

  const balance = Number(myCtoSummary?.balance || 0);
  const used = Number(myCtoSummary?.used || 0);
  const totalPotential = balance + used;
  const usagePercentage =
    totalPotential > 0 ? (used / totalPotential) * 100 : 0;

  const formatDate = (dateString) => {
    if (!dateString) return "Date N/A";

    // Returns: "Mon, Jan 30 • 10:48 AM"
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    })
      .format(new Date(dateString))
      .replace(",", " •"); // Replaces the comma after the date with a dot
  };

  return (
    <div className="min-h-screen  rounded-xl p-6 font-sans text-slate-800">
      {/* 1. HEADER */}
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <div className="h-1 w-6 bg-indigo-600 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Management Portal
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight font-sans">
            CTO Overview
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-slate-600">
              System Live
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-10">
        {/* 2. ORGANIZATION VITALS */}
        {(role === "admin" || role === "hr") && (
          <section>
            <SectionHeader title="Organization Insights" icon={ShieldCheck} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatBadge
                label="Total Requests"
                value={totalRequests || 0}
                icon={Activity}
                colorClass="bg-indigo-50 text-indigo-600"
              />
              <StatBadge
                label="Approved"
                value={approvedRequests || 0}
                icon={CheckCircle}
                colorClass="bg-emerald-50 text-emerald-600"
              />
              <StatBadge
                label="Pending Review"
                value={totalPendingRequests || 0}
                icon={Clock}
                colorClass="bg-amber-50 text-amber-600"
              />
              <StatBadge
                label="Total Rejected"
                value={(rejectedRequests || 0) + (totalRolledBackCount || 0)}
                icon={AlertCircle}
                colorClass="bg-rose-50 text-rose-600"
              />
            </div>

            {/* Moved Team Approval and Recent Inbound to Organization Section */}
          </section>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CARD 1: URGENT APPROVALS */}
          <div
            className={`relative overflow-hidden rounded-2xl p-5 opacity-h-70 flex flex-col justify-between transition-all duration-300 shadow-lg 
    ${
      teamPendingApprovals > 0
        ? "bg-slate-900 text-white shadow-slate-200"
        : "bg-slate-50 border border-slate-200 text-slate-500 shadow-none"
    }`}
          >
            {/* Subtle Background Icon - Scaled down for h-60 */}
            <div className="absolute -right-2 -top-2 opacity-10 rotate-12">
              <AlertCircle size={120} />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider
          ${teamPendingApprovals > 0 ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"}`}
                >
                  {teamPendingApprovals > 0 ? "Pending Request" : "Cleared"}
                </span>
              </div>

              <p
                className={`text-5xl font-black leading-none mb-2 ${teamPendingApprovals > 0 ? "text-white" : "text-slate-300"}`}
              >
                {teamPendingApprovals}
              </p>
              <p className="text-[12px] font-medium leading-tight opacity-80 max-w-[180px]">
                {teamPendingApprovals > 0
                  ? "Some employees are waiting for approval."
                  : "All caught up! No approvals currently pending."}
              </p>
            </div>

            <button
              disabled={teamPendingApprovals === 0}
              onClick={() => {
                if (teamPendingApprovals > 0) {
                  window.location.href = "/app/cto/approvals";
                }
              }}
              className={`w-full py-2.5 rounded-lg text-[11px] font-bold transition-all transform active:scale-95
    ${
      teamPendingApprovals > 0
        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20"
        : "bg-slate-200 text-slate-400 cursor-not-allowed"
    }`}
            >
              {teamPendingApprovals > 0 ? "Process Approvals" : "Complete"}
            </button>
          </div>

          {/* CARD 2: RECENT INBOUND */}
          <DashboardCard
            title="Recent Pending Request"
            className="h-70 border border-slate-100 shadow-sm flex flex-col"
            action={
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold
        ${pendingRequests.length > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"}`}
              >
                {pendingRequests.length} New
              </span>
            }
          >
            <div className="flex flex-col h-50">
              {" "}
              {/* Precise height to prevent overflow */}
              {pendingRequests.length > 0 ? (
                <>
                  <div className="space-y-1 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                    {pendingRequests.map((req) => (
                      <PendingRequestItem key={req.id} request={req} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-[11px] font-medium text-slate-400">
                    No new requests
                  </p>
                </div>
              )}
            </div>
          </DashboardCard>
        </div>

        {/* 3. CORE CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT COLUMN: PERSONAL SUMMARY */}
          <div className="lg:col-span-8 space-y-8">
            <section>
              <SectionHeader title="My CTO Dashboard" icon={History} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* My Balance Card */}
                <DashboardCard
                  title="Time Credits"
                  subtitle="Usage vs Available Balance"
                >
                  <div className="flex flex-col h-full justify-between py-2">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <span className="text-5xl font-black text-slate-900 tracking-tighter">
                          {balance.toFixed(1)}
                        </span>
                        <span className="ml-2 text-slate-400 font-bold text-sm uppercase">
                          Hours Left
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                          {usagePercentage.toFixed(0)}% Utilized
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden p-1">
                        <div
                          className="bg-indigo-500 h-full rounded-full shadow-[0_0_10px_rgba(99,102,241,0.4)] transition-all duration-1000 ease-out"
                          style={{ width: `${usagePercentage}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                        <span className="text-slate-400">
                          Consumed:{" "}
                          <span className="text-slate-700">{used}h</span>
                        </span>
                        <span className="text-slate-400">
                          Total Allotted:{" "}
                          <span className="text-slate-700">
                            {totalPotential.toFixed(1)}h
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </DashboardCard>

                {/* Quick Mini Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      My Requests
                    </p>
                    <p className="text-2xl font-black text-slate-800">
                      {myCtoSummary?.totalRequests || 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Approved
                    </p>
                    <p className="text-2xl font-black text-emerald-600">
                      {myCtoSummary?.approved || 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Rejected
                    </p>
                    <p className="text-2xl font-black text-rose-500">
                      {myCtoSummary?.rejected || 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Pending
                    </p>
                    <p className="text-2xl font-black text-indigo-600">
                      {myCtoSummary.pending || 0}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Additional UX Improvement: Recent Activity Section */}
            <section>
              <SectionHeader title="Recent Activity" icon={Calendar} />
              <DashboardCard
                title="My Recent Requests"
                subtitle={`Last ${myCtoSummary.recentRequests.length} submissions`}
                action={
                  <Link
                    to={`/app/cto/apply/`}
                    className="flex-shrink-0 translate-x-1 group-hover:translate-x-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all duration-200"
                  >
                    ({myCtoSummary.totalRequests}) View all my request
                  </Link>
                }
              >
                <div className="space-y-1">
                  {myCtoSummary.recentRequests &&
                  myCtoSummary.recentRequests.length > 0 ? (
                    myCtoSummary.recentRequests.map((request) => (
                      <div
                        key={request._id}
                        className="flex items-center gap-3 py-3 group hover:bg-slate-50 rounded-xl px-2 transition-all duration-200 border-b border-slate-50 last:border-0"
                      >
                        {/* ICON/AVATAR CIRCLE */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shadow-sm group-hover:border-blue-200 transition-colors">
                          <User size={18} className="text-blue-600" />
                        </div>

                        {/* REQUEST DETAILS */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 text-[13px] truncate leading-none">
                              Request #{request._id.slice(-6).toUpperCase()}
                            </p>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-tight">
                              {request.requestedHours}h
                            </span>
                          </div>

                          <div className="mt-1 flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                              Date Submitted
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium leading-tight">
                              {formatDate(request.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* STATUS BADGE - Styled like the 'Review' action but non-clickable */}
                        <div className="flex-shrink-0">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all duration-200 ${getStatusStyles(request.overallStatus)}`}
                          >
                            {request.overallStatus}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-sm font-medium text-slate-400">
                        No recent requests found.
                      </p>
                    </div>
                  )}
                </div>
              </DashboardCard>
            </section>
          </div>

          {/* RIGHT COLUMN: ACTIONS & TEAM */}
          <div className="lg:col-span-4 space-y-8">
            <section>
              <SectionHeader title="Action Center" icon={TrendingUp} />
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {quickActions?.slice(0, 4).map((action, idx) => (
                    <ActionButton
                      key={idx}
                      label={action.name}
                      link={action.link}
                      icon={Briefcase}
                    />
                  ))}
                  {quickLinks?.slice(0, 4).map((link, idx) => (
                    <ActionButton
                      key={idx}
                      label={link.name}
                      link={link.link}
                      icon={ArrowUpRight}
                    />
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-component refinement
const PendingRequestItem = ({ request }) => {
  const initial = request.employeeName?.charAt(0).toUpperCase() || "?";

  // Format: "Mon, Jan 30 • 10:48 AM"
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
    <div className="flex items-center gap-3 py-3 group hover:bg-slate-50 rounded-xl px-2 transition-all duration-200 border-b border-slate-50 last:border-0">
      {/* AVATAR */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shadow-sm group-hover:border-blue-200 transition-colors">
        <span className="text-blue-600 font-bold text-sm">{initial}</span>
      </div>

      {/* CONTENT */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-bold text-slate-800 text-[13px] truncate leading-none">
            {request.employeeName}
          </p>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-tight">
            {request.requestedHours}h
          </span>
        </div>

        <div className="mt-1 flex flex-col">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
            Date Submitted
          </span>
          <span className="text-[11px] text-slate-500 font-medium leading-tight">
            {formattedDate}
          </span>
        </div>
      </div>

      {/* ACTION */}
      <Link
        to={`/app/cto/approvals/${request.id}`}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all duration-200"
      >
        Review
      </Link>
    </div>
  );
};

export default CtoDashboard;
