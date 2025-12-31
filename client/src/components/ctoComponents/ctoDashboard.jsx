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
const KpiCard = ({ title, value, icon: Icon }) => (
  <div className="bg-white rounded-lg shadow-sm p-5 flex items-center gap-4">
    <div className="p-3 rounded-full bg-indigo-100 text-indigo-600">
      <Icon size={22} />
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  </div>
);

const CtoDashboard = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ctoDashboard"],
    queryFn: fetchDashboard,
  });

  if (isLoading) return <p className="p-6">Loading...</p>;
  if (isError || !data) return <p className="p-6">Failed to load data</p>;

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
    // HR-specific
    totalCreditedCount,
    totalRolledBackCount,
    totalPendingRequests,
  } = data;

  // Charts
  const ctoUsageTrend = myCtoSummary?.trend || [
    { month: "Jan", hours: 0 },
    { month: "Feb", hours: 0 },
  ];
  const ctoSummary = myCtoSummary
    ? [
        { name: "Used", hours: myCtoSummary.used },
        { name: "Balance", hours: myCtoSummary.balance },
        { name: "Pending", hours: myCtoSummary.pending },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-100 w-full">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900">CTO Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">CTO summary and overview</p>
      </header>

      <main className="p-6 space-y-8">
        {/* KPI Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Personal CTO Summary */}
          {myCtoSummary && (
            <>
              <KpiCard
                title="CTO Balance (hrs)"
                value={myCtoSummary.balance}
                icon={Clock}
              />
              <KpiCard
                title="Pending Requests"
                value={myCtoSummary.pending}
                icon={FileText}
              />
              <KpiCard
                title="Total CTO Used (hrs)"
                value={myCtoSummary.used}
                icon={TrendingUp}
              />
            </>
          )}

          {/* Supervisor/Team KPIs */}
          {teamPendingApprovals !== undefined && (
            <KpiCard
              title="Team Pending Approvals"
              value={teamPendingApprovals}
              icon={ClipboardList}
            />
          )}

          {/* Admin KPIs */}
          {topEmployees && (
            <KpiCard
              title="Top Employee CTO Usage"
              value={topEmployees[0]?.usedHours || 0}
              icon={Users}
            />
          )}
          {totalRequests !== undefined && (
            <KpiCard
              title="Total CTO Requests"
              value={totalRequests}
              icon={ClipboardList}
            />
          )}

          {/* HR KPIs */}
          {totalCreditedCount !== undefined && (
            <KpiCard
              title="Total Credited CTOs"
              value={totalCreditedCount}
              icon={TrendingUp}
            />
          )}
          {totalRolledBackCount !== undefined && (
            <KpiCard
              title="Total Rolled Back CTOs"
              value={totalRolledBackCount}
              icon={FileText}
            />
          )}
          {totalPendingRequests !== undefined && (
            <KpiCard
              title="Total Pending Requests"
              value={totalPendingRequests}
              icon={ClipboardList}
            />
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CTO Usage Trend */}
          <div className="bg-white rounded-lg shadow-sm p-5">
            <h2 className="text-lg font-medium text-gray-700 mb-4">
              CTO Usage Trend
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ctoUsageTrend}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* CTO Summary */}
          <div className="bg-white rounded-lg shadow-sm p-5">
            <h2 className="text-lg font-medium text-gray-700 mb-4">
              CTO Summary
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ctoSummary}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="hours"
                  fill="#4f46e5"
                  barSize={40}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions / Links */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-lg font-medium text-gray-700 mb-4">
            Quick Actions & Links
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {quickActions?.map((action, idx) => (
              <button
                key={idx}
                onClick={() => (window.location.href = action.link)}
                className="p-4 rounded-lg border border-gray-200 hover:bg-indigo-50 text-left flex items-center gap-2"
              >
                <FileText size={20} />
                <div>
                  <p className="font-medium text-gray-900">{action.name}</p>
                  <p className="text-sm text-gray-500">
                    {action.description || ""}
                  </p>
                </div>
              </button>
            ))}
            {quickLinks?.map((link, idx) => (
              <button
                key={idx}
                onClick={() => (window.location.href = link.link)}
                className="p-4 rounded-lg border border-gray-200 hover:bg-indigo-50 text-left flex items-center gap-2"
              >
                <ClipboardList size={20} />
                <p className="font-medium text-gray-900">{link.name}</p>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CtoDashboard;
