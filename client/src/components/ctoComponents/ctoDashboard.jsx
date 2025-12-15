import React, { useState } from "react";
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
import { ArrowUp, ArrowDown } from "lucide-react";

// Simple KPI Card Component
const KpiCard = ({ title, value, trend }) => (
  <div className="bg-white shadow-sm rounded-lg p-5 flex flex-col items-center justify-center">
    <h3 className="text-md font-medium text-gray-500">{title}</h3>
    <div className="flex items-center mt-2">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {trend === "up" && <ArrowUp className="text-green-500 w-5 h-5 ml-1" />}
      {trend === "down" && <ArrowDown className="text-red-500 w-5 h-5 ml-1" />}
    </div>
  </div>
);

const Dashboard = () => {
  const [role, setRole] = useState("employee");

  const dashboards = {
    employee: {
      kpis: [
        { title: "Tasks Assigned", value: 12, trend: "up" },
        { title: "Pending Requests", value: 5, trend: "down" },
        { title: "Completed Projects", value: 3, trend: "up" },
      ],
      lineChart: [
        { day: "Mon", tasks: 3 },
        { day: "Tue", tasks: 4 },
        { day: "Wed", tasks: 2 },
        { day: "Thu", tasks: 5 },
        { day: "Fri", tasks: 3 },
      ],
      barChart: [
        { project: "Project A", completed: 3 },
        { project: "Project B", completed: 2 },
        { project: "Project C", completed: 5 },
      ],
    },
    hr: {
      kpis: [
        { title: "Employees", value: 120, trend: "up" },
        { title: "Leave Requests", value: 15, trend: "down" },
        { title: "Open Positions", value: 4, trend: "up" },
      ],
      lineChart: [
        { day: "Mon", hires: 2 },
        { day: "Tue", hires: 1 },
        { day: "Wed", hires: 3 },
        { day: "Thu", hires: 0 },
        { day: "Fri", hires: 2 },
      ],
      barChart: [
        { department: "IT", leaves: 5 },
        { department: "HR", leaves: 2 },
        { department: "Finance", leaves: 3 },
      ],
    },
    admin: {
      kpis: [
        { title: "System Users", value: 50, trend: "up" },
        { title: "Active Sessions", value: 23, trend: "up" },
        { title: "System Alerts", value: 2, trend: "down" },
      ],
      lineChart: [
        { day: "Mon", sessions: 5 },
        { day: "Tue", sessions: 8 },
        { day: "Wed", sessions: 6 },
        { day: "Thu", sessions: 10 },
        { day: "Fri", sessions: 7 },
      ],
      barChart: [
        { module: "Users", count: 50 },
        { module: "Reports", count: 20 },
        { module: "Settings", count: 10 },
      ],
    },
  };

  const data = dashboards[role];

  return (
    <div className="min-h-screen bg-gray-100 w-full">
      {/* Top Bar */}
      <header className="bg-white shadow-sm py-4 px-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2 md:mb-0 capitalize">
          {role} Dashboard
        </h1>
        <div>
          <label className="mr-3 font-medium text-gray-700">Role:</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="p-2 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="employee">Employee</option>
            <option value="hr">HR</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </header>

      {/* KPI Cards */}
      <main className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {data.kpis.map((item, idx) => (
            <KpiCard
              key={idx}
              title={item.title}
              value={item.value}
              trend={item.trend}
            />
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart */}
          <div className="bg-white shadow-sm rounded-lg p-5">
            <h2 className="text-lg font-medium mb-4 text-gray-700">
              Weekly Trend
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.lineChart}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                <XAxis
                  dataKey={Object.keys(data.lineChart[0])[0]}
                  stroke="#6b7280"
                />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey={Object.keys(data.lineChart[0])[1]}
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div className="bg-white shadow-sm rounded-lg p-5">
            <h2 className="text-lg font-medium mb-4 text-gray-700">Overview</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.barChart}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                <XAxis
                  dataKey={Object.keys(data.barChart[0])[0]}
                  stroke="#6b7280"
                />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar
                  dataKey={Object.keys(data.barChart[0])[1]}
                  fill="#4f46e5"
                  barSize={25}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
