import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../../api/cto";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Clock,
  FileText,
  TrendingUp,
  Users,
  ClipboardList,
} from "lucide-react";

/* KPI Card */
const KpiCard = ({ title, value, icon: Icon, accent }) => (
  <div
    className={`
      bg-gray-50 rounded-xl p-6 flex items-center gap-4 transition-transform duration-150
      hover:scale-[1.02] shadow-sm
    `}
  >
    <div
      className={`
        p-3 rounded-full flex items-center justify-center
        ${accent === "indigo" ? "bg-indigo-100 text-indigo-600" : ""}
        ${accent === "teal" ? "bg-teal-100 text-teal-600" : ""}
        ${accent === "yellow" ? "bg-yellow-100 text-yellow-600" : ""}
        ${accent === "rose" ? "bg-rose-100 text-rose-600" : ""}
      `}
    >
      <Icon size={24} />
    </div>
    <div className="flex flex-col">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);

const CtoDashboard = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ctoDashboard"],
    queryFn: fetchDashboard,
  });

  if (isLoading)
    return (
      <p className="text-center text-gray-600 text-lg mt-8">
        Loading dashboard...
      </p>
    );
  if (isError || !data)
    return (
      <p className="text-center text-red-500 text-lg mt-8">
        Failed to load dashboard data
      </p>
    );

  const {
    myCtoSummary,
    teamPendingApprovals,
    teamCtoUsage,
    totalRequests,
    approvedRequests,
    rejectedRequests,
    topEmployees,
    quickActions,
    quickLinks,
    totalCreditedCount,
    totalRolledBackCount,
    totalPendingRequests,
  } = data;

  const ctoUsageTrend = myCtoSummary?.trend || [
    { month: "Jan", hours: 0 },
    { month: "Feb", hours: 0 },
  ];
  const ctoSummary = myCtoSummary
    ? [
        { name: "Used (hrs)", hours: myCtoSummary.used },
        { name: "Balance (hrs)", hours: myCtoSummary.balance },
        { name: "Pending Requests", hours: myCtoSummary.pending },
        { name: "Approved Requests", hours: myCtoSummary.approved },
      ]
    : [];

  return (
    <div className="space-y-6 w-full bg-white p-6">
      {/* HEADER */}
      <header className="pb-4 border-b">
        <h1 className="text-2xl font-bold text-gray-900">CTO Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Overview of your CTO usage and team metrics
        </p>
      </header>

      {/* PERSONAL KPI SECTION */}
      {myCtoSummary && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">My CTO KPIs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard
              title="CTO Balance (hrs)"
              value={Number(myCtoSummary.balance).toFixed(2)}
              icon={Clock}
              accent="indigo"
            />
            <KpiCard
              title="Pending Requests"
              value={myCtoSummary.pending}
              icon={FileText}
              accent="teal"
            />
            <KpiCard
              title="Total CTO Used (hrs)"
              value={myCtoSummary.used}
              icon={TrendingUp}
              accent="yellow"
            />
            <KpiCard
              title="Approved Requests"
              value={myCtoSummary.approved}
              icon={Users}
              accent="rose"
            />
          </div>
        </section>
      )}

      {/* SUPERVISOR SECTION */}
      {teamPendingApprovals !== undefined && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Team KPIs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <KpiCard
              title="Team Pending Approvals"
              value={teamPendingApprovals}
              icon={ClipboardList}
              accent="teal"
            />
            {teamCtoUsage?.map((member, idx) => (
              <KpiCard
                key={idx}
                title={`${member.name} CTO Used`}
                value={member.used}
                icon={Users}
                accent="indigo"
              />
            ))}
          </div>
        </section>
      )}

      {/* ADMIN SECTION */}
      {(topEmployees || totalRequests !== undefined) && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Admin KPIs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {topEmployees && (
              <KpiCard
                title="Top Employee CTO (hrs)"
                value={topEmployees[0]?.usedHours || 0}
                icon={Users}
                accent="yellow"
              />
            )}
            {totalRequests !== undefined && (
              <KpiCard
                title="Total CTO Requests"
                value={totalRequests}
                icon={ClipboardList}
                accent="indigo"
              />
            )}
            {approvedRequests !== undefined && (
              <KpiCard
                title="Total Approved Requests"
                value={approvedRequests}
                icon={TrendingUp}
                accent="teal"
              />
            )}
            {rejectedRequests !== undefined && (
              <KpiCard
                title="Total Rejected Requests"
                value={rejectedRequests}
                icon={FileText}
                accent="rose"
              />
            )}
          </div>
        </section>
      )}

      {/* HR SECTION */}
      {(totalCreditedCount !== undefined ||
        totalRolledBackCount !== undefined ||
        totalPendingRequests !== undefined) && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">HR KPIs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {totalCreditedCount !== undefined && (
              <KpiCard
                title="Total Credited CTOs"
                value={totalCreditedCount}
                icon={TrendingUp}
                accent="yellow"
              />
            )}
            {totalRolledBackCount !== undefined && (
              <KpiCard
                title="Total Rolled Back CTOs"
                value={totalRolledBackCount}
                icon={FileText}
                accent="rose"
              />
            )}
            {totalPendingRequests !== undefined && (
              <KpiCard
                title="Total Pending Requests"
                value={totalPendingRequests}
                icon={ClipboardList}
                accent="teal"
              />
            )}
          </div>
        </section>
      )}

      {/* CHARTS SECTION */}
      <section className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        {/* <div className="bg-gray-50 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            CTO Usage Trend
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={ctoUsageTrend}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                contentStyle={{ borderRadius: "8px", borderColor: "#ddd" }}
              />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="#6366F1"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div> */}

        <div className="bg-gray-50 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            CTO Summary Overview
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ctoSummary}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                contentStyle={{ borderRadius: "8px", borderColor: "#ddd" }}
              />
              <Bar
                dataKey="hours"
                fill="#4f46e5"
                barSize={40}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* QUICK ACTIONS / LINKS */}
      <section className="bg-gray-50 rounded-xl p-6 space-y-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800">
          Quick Actions & Links
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions?.map((action, idx) => (
            <button
              key={idx}
              onClick={() => (window.location.href = action.link)}
              className="p-4 rounded-lg hover:bg-indigo-50 transition flex items-center gap-3"
            >
              <FileText size={20} className="text-indigo-500" />
              <div>
                <p className="font-medium text-gray-900">{action.name}</p>
                <p className="text-sm text-gray-500">{action.description}</p>
              </div>
            </button>
          ))}
          {quickLinks?.map((link, idx) => (
            <button
              key={idx}
              onClick={() => (window.location.href = link.link)}
              className="p-4 rounded-lg hover:bg-indigo-50 transition flex items-center gap-3"
            >
              <ClipboardList size={20} className="text-indigo-500" />
              <p className="font-medium text-gray-900">{link.name}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CtoDashboard;
