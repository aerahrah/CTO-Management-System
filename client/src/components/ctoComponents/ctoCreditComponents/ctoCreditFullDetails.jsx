import React, { useState } from "react";
import {
  Users,
  Clock,
  Calendar,
  FileText,
  User,
  ExternalLink,
  Info,
  Check,
  Copy,
  Download,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { StatusBadge, StatusIcon, getStatusStyles } from "../../statusUtils";
// import Modal from "../../modal"; // Uncomment if needed

// --- Helper: Enhanced Utilization Bar (Supports Reserved Hours) ---
const UtilizationBar = ({
  used = 0,
  reserved = 0,
  total = 0,
  compact = false,
}) => {
  const usedPct = Math.min((used / total) * 100, 100);
  const reservedPct = Math.min((reserved / total) * 100, 100 - usedPct); // Clamp so it doesn't overflow

  return (
    <div className="w-full">
      {/* Legend / Text Labels (Only show on non-compact or if specifically asked) */}
      {!compact && (
        <div className="flex justify-between text-[10px] font-medium text-slate-500 mb-1.5">
          <div className="flex gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              {used}h Used
            </span>
            {reserved > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                {reserved}h Reserved
              </span>
            )}
          </div>
          <span>{total}h Total</span>
        </div>
      )}

      {/* The Stacked Bar */}
      <div
        className={`w-full bg-slate-100 rounded-full overflow-hidden flex ${compact ? "h-2" : "h-3"}`}
      >
        {/* Used Segment */}
        <div
          className="bg-blue-500 h-full transition-all duration-500"
          style={{ width: `${usedPct}%` }}
          title={`${used}h Used`}
        />
        {/* Reserved Segment */}
        <div
          className="bg-amber-400 h-full transition-all duration-500 relative"
          style={{ width: `${reservedPct}%` }}
          title={`${reserved}h Reserved`}
        >
          {/* striped pattern overlay for reserved to make it distinct */}
          <div className="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzhhYWGMYAEYB8RmROaABADeOQ8CXl/xfgAAAABJRU5ErkJggg==')] opacity-20"></div>
        </div>
      </div>
    </div>
  );
};

// --- Helper: User Avatar ---
const UserAvatar = ({ firstName, lastName }) => {
  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`;
  return (
    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 border-2 border-white shadow-sm shrink-0">
      {initials}
    </div>
  );
};

// --- Helper: Mobile Employee Card ---
const EmployeeMobileCard = ({ data }) => {
  // Assuming data structure: { employee: {...}, usedHours, reservedHours, creditedHours, remainingHours, status }
  const reserved = data.reservedHours || 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Card Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <UserAvatar
            firstName={data.employee.firstName}
            lastName={data.employee.lastName}
          />
          <div>
            <p className="text-sm font-bold text-slate-800">
              {data.employee.firstName} {data.employee.lastName}
            </p>
            <p className="text-xs text-slate-500 font-medium">
              {data.employee.position}
            </p>
          </div>
        </div>
        <StatusBadge status={data.status} className="text-[10px]" />
      </div>

      {/* Utilization Section */}
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
        <UtilizationBar
          used={data.usedHours}
          reserved={reserved}
          total={data.creditedHours}
        />

        {/* Data Grid */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200">
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Used
            </p>
            <p className="text-sm font-bold text-blue-600">{data.usedHours}h</p>
          </div>
          <div className="text-center border-l border-slate-200">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Reserved
            </p>
            <p className="text-sm font-bold text-amber-500">{reserved}h</p>
          </div>
          <div className="text-center border-l border-slate-200">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Left
            </p>
            <p className="text-sm font-bold text-slate-700">
              {data.remainingHours}h
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const CtoCreditDetails = ({ credit }) => {
  const [copied, setCopied] = useState(false);

  if (!credit) return null;

  const handleCopyMemo = () => {
    navigator.clipboard.writeText(credit.memoNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "-";

  const PDF_URL = credit.uploadedMemo
    ? `http://localhost:3000/${credit.uploadedMemo.replace(/\\/g, "/")}`
    : "";

  return (
    <div className="max-h-[75vh] overflow-y-auto custom-scrollbar bg-white text-slate-900">
      {/* 1. Header Section */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 sticky top-0 z-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-blue-100 text-blue-600  text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                Reference Memo
              </span>
            </div>
            <div className="flex items-center gap-3 group">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight tabular-nums pl-2">
                {credit.memoNo}
              </h2>
              <button
                onClick={handleCopyMemo}
                className="p-1.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-blue-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                title="Copy Reference Number"
              >
                {copied ? (
                  <Check size={16} className="text-emerald-600" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 bg-white p-2 pr-4 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto">
            <div
              className={`p-2.5 rounded-lg ${getStatusStyles(credit.status)}`}
            >
              <StatusIcon status={credit.status} size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">
                Status
              </p>
              <p
                className={`font-semibold text-xs ${
                  credit.status === "ROLLEDBACK"
                    ? "text-rose-600"
                    : credit.status === "CREDITED"
                      ? "text-emerald-600"
                      : "text-gray-600"
                }`}
              >
                {credit.status}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6 md:space-y-8">
        {/* 2. Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* Duration Card */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 flex items-start gap-4">
            <div className="p-2 bg-slate-100 rounded-lg border border-slate-200 text-slate-600">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Duration
              </p>
              <p className="text-xl font-bold text-slate-700 tabular-nums">
                {credit.duration?.hours || 0}
                <span className="text-sm text-slate-400 font-medium">
                  h
                </span>{" "}
                {credit.duration?.minutes || 0}
                <span className="text-sm text-slate-400 font-medium">m</span>
              </p>
            </div>
          </div>

          {/* Authorizer Card */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 flex items-start gap-4">
            <div className="p-2 bg-slate-100 rounded-lg border border-slate-200 text-slate-600">
              <User size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Authorized By
              </p>
              <p
                className="text-sm font-bold text-slate-700 truncate"
                title={`${credit.creditedBy?.firstName} ${credit.creditedBy?.lastName}`}
              >
                {credit.creditedBy?.firstName} {credit.creditedBy?.lastName}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {credit.creditedBy?.position}
              </p>
            </div>
          </div>

          {/* Date Card */}
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 flex items-start gap-4">
            <div className="p-2 bg-slate-100 rounded-lg border border-slate-200 text-slate-600">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Credited Date
              </p>
              <p className="text-sm font-bold text-slate-700">
                {formatDate(credit.dateCredited)}
              </p>
              <p className="text-xs text-slate-500">
                Approved: {formatDate(credit.dateApproved)}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Employee Utilization Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Users size={16} className="text-slate-600" />
              Beneficiary Employees
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-xs font-medium border border-slate-200">
                {credit.employees?.length || 0}
              </span>
            </h4>

            {/* Legend for the Bars */}
            <div className="hidden md:flex items-center gap-3 text-[10px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>Used
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Reserved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-100 border border-slate-300"></span>
                Remaining
              </span>
            </div>
          </div>

          {/* --- MOBILE VIEW: Cards List (Visible on small screens) --- */}
          <div className="block md:hidden space-y-3">
            {credit.employees?.map((e) => (
              <EmployeeMobileCard key={e._id} data={e} />
            ))}
          </div>

          {/* --- DESKTOP VIEW: Table (Visible on medium+ screens) --- */}
          <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-5/12">
                      Utilization
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
                      Remaining
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {credit.employees?.map((e) => (
                    <tr
                      key={e._id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            firstName={e.employee.firstName}
                            lastName={e.employee.lastName}
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                              {e.employee.firstName} {e.employee.lastName}
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium">
                              {e.employee.position}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <UtilizationBar
                          used={e.usedHours}
                          reserved={e.reservedHours || 0} // Ensure reservedHours exists in data
                          total={e.creditedHours}
                          compact={true}
                        />
                        <div className="flex gap-3 mt-1 text-[10px] text-slate-400 font-medium">
                          <span>
                            Used:{" "}
                            <span className="text-slate-600">
                              {e.usedHours}h
                            </span>
                          </span>
                          {e.reservedHours > 0 && (
                            <span>
                              Reserved:{" "}
                              <span className="text-amber-500">
                                {e.reservedHours}h
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center align-middle">
                        <span
                          className={`inline-block px-2 py-1 rounded-md text-sm font-bold tabular-nums ${
                            e.remainingHours > 0
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {e.remainingHours}h
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <StatusBadge
                          status={e.status}
                          className="text-[10px] inline-flex "
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(!credit.employees || credit.employees.length === 0) && (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                <AlertCircle size={24} className="mb-2 opacity-50" />
                <span className="text-sm italic">No employees assigned.</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Document Section */}
        {credit.uploadedMemo && (
          <div className="space-y-3 pt-2 border-t border-dashed border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <FileText size={16} className="text-slate-600" />
                Supporting Memos
              </h4>
              <div className="flex gap-2">
                <a
                  href={PDF_URL}
                  download
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition-colors"
                >
                  <Download size={12} /> Download
                </a>
                <a
                  href={PDF_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-xs font-bold text-blue-600 hover:bg-blue-100 flex items-center gap-2 transition-colors"
                >
                  Open New Tab <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-1 overflow-hidden">
              {credit.uploadedMemo.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={`${PDF_URL}#toolbar=0`}
                  className="w-full h-[400px] rounded-lg bg-white"
                  title="Memo Preview"
                />
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 m-2">
                  <Info size={32} className="mb-2 opacity-20" />
                  <p className="text-sm font-medium">
                    Preview not available for this file type
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CtoCreditDetails;
