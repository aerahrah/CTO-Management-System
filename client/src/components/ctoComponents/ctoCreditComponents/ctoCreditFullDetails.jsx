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
} from "lucide-react";
import { StatusBadge, StatusIcon } from "../../statusUtils";
import { buildApiUrl } from "../../../config/env";

const ui = {
  bg: "var(--app-bg, #f8fafc)",
  surface: "var(--app-surface, #ffffff)",
  surface2: "var(--app-surface-2, #f8fafc)",
  text: "var(--app-text, #0f172a)",
  muted: "var(--app-muted, #64748b)",
  border: "var(--app-border, rgba(15,23,42,0.10))",
  borderSoft: "rgba(15,23,42,0.06)",
  accent: "var(--accent, #2563eb)",
  accentSoft: "var(--accent-soft, rgba(37,99,235,0.10))",
  accentSoft2: "var(--accent-soft2, rgba(37,99,235,0.18))",
};

const getStatusMeta = (status) => {
  switch (status) {
    case "ROLLEDBACK":
      return {
        chipBg: "rgba(239,68,68,0.14)",
        chipText: "#e11d48",
        label: "#e11d48",
      };
    case "CREDITED":
    case "ACTIVE":
      return {
        chipBg: "rgba(34,197,94,0.14)",
        chipText: "#16a34a",
        label: "#16a34a",
      };
    case "EXHAUSTED":
      return {
        chipBg: "rgba(245,158,11,0.16)",
        chipText: "#d97706",
        label: "#d97706",
      };
    default:
      return {
        chipBg: ui.surface2,
        chipText: ui.muted,
        label: ui.muted,
      };
  }
};

const UtilizationBar = ({
  used = 0,
  reserved = 0,
  total = 0,
  compact = false,
}) => {
  const totalValue = Number(total || 0);
  const usedValue = Number(used || 0);
  const reservedValue = Number(reserved || 0);

  const usedPct =
    totalValue > 0 ? Math.min((usedValue / totalValue) * 100, 100) : 0;
  const reservedPct =
    totalValue > 0
      ? Math.min((reservedValue / totalValue) * 100, 100 - usedPct)
      : 0;

  return (
    <div className="w-full">
      {!compact && (
        <div
          className="mb-1.5 flex justify-between text-[10px] font-medium transition-colors duration-300 ease-out"
          style={{ color: ui.muted }}
        >
          <div className="flex gap-3">
            <span className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: ui.accent }}
              />
              {usedValue}h Used
            </span>
            {reservedValue > 0 && (
              <span className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: "#f59e0b" }}
                />
                {reservedValue}h Reserved
              </span>
            )}
          </div>
          <span>{totalValue}h Total</span>
        </div>
      )}

      <div
        className={`flex w-full overflow-hidden rounded-full ${
          compact ? "h-2" : "h-3"
        } transition-colors duration-300 ease-out`}
        style={{ backgroundColor: ui.surface2 }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${usedPct}%`, backgroundColor: ui.accent }}
          title={`${usedValue}h Used`}
        />
        <div
          className="relative h-full transition-all duration-500"
          style={{ width: `${reservedPct}%`, backgroundColor: "#f59e0b" }}
          title={`${reservedValue}h Reserved`}
        >
          <div className="absolute inset-0 opacity-20 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzhhYWGMYAEYB8RmROaABADeOQ8CXl/xfgAAAABJRU5ErkJggg==')]" />
        </div>
      </div>
    </div>
  );
};

const UserAvatar = ({ firstName, lastName }) => {
  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`;

  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold shadow-sm transition-colors duration-300 ease-out"
      style={{
        backgroundColor: ui.accentSoft,
        color: ui.accent,
        borderColor: ui.surface,
      }}
    >
      {initials}
    </div>
  );
};

const EmployeeMobileCard = ({ data }) => {
  const reserved = Number(data.reservedHours || 0);

  return (
    <div
      className="rounded-xl border p-4 shadow-sm transition-colors duration-300 ease-out"
      style={{
        backgroundColor: ui.surface,
        borderColor: ui.border,
      }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <UserAvatar
            firstName={data.employee.firstName}
            lastName={data.employee.lastName}
          />
          <div>
            <p
              className="text-sm font-bold transition-colors duration-300 ease-out"
              style={{ color: ui.text }}
            >
              {data.employee.firstName} {data.employee.lastName}
            </p>
            <p
              className="text-xs font-medium transition-colors duration-300 ease-out"
              style={{ color: ui.muted }}
            >
              {data.employee.position}
            </p>
          </div>
        </div>
        <StatusBadge status={data.status} className="text-[10px]" />
      </div>

      <div
        className="rounded-lg border p-3 transition-colors duration-300 ease-out"
        style={{
          backgroundColor: ui.surface2,
          borderColor: ui.borderSoft,
        }}
      >
        <UtilizationBar
          used={data.usedHours}
          reserved={reserved}
          total={data.creditedHours}
        />

        <div
          className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 transition-colors duration-300 ease-out"
          style={{ borderColor: ui.border }}
        >
          <div className="text-center">
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: ui.muted }}
            >
              Used
            </p>
            <p className="text-sm font-bold" style={{ color: ui.accent }}>
              {data.usedHours}h
            </p>
          </div>

          <div
            className="text-center border-l"
            style={{ borderColor: ui.border }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: ui.muted }}
            >
              Reserved
            </p>
            <p className="text-sm font-bold" style={{ color: "#f59e0b" }}>
              {reserved}h
            </p>
          </div>

          <div
            className="text-center border-l"
            style={{ borderColor: ui.border }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: ui.muted }}
            >
              Left
            </p>
            <p className="text-sm font-bold" style={{ color: ui.text }}>
              {data.remainingHours}h
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const EmptyEmployees = () => (
  <div
    className="flex flex-col items-center justify-center rounded-xl border py-12 text-center transition-colors duration-300 ease-out"
    style={{
      backgroundColor: ui.surface2,
      borderColor: ui.border,
      color: ui.muted,
    }}
  >
    <AlertCircle size={24} className="mb-2 opacity-60" />
    <span className="text-sm italic">No employees assigned.</span>
  </div>
);

const CtoCreditDetails = ({ credit }) => {
  const [copied, setCopied] = useState(false);

  if (!credit) return null;

  const statusMeta = getStatusMeta(credit.status);

  const handleCopyMemo = async () => {
    try {
      await navigator.clipboard.writeText(credit.memoNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
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
    ? buildApiUrl(credit.uploadedMemo.replace(/\\/g, "/"))
    : "";

  return (
    <div
      className="max-h-[75vh] overflow-y-auto custom-scrollbar transition-colors duration-300 ease-out"
      style={{
        backgroundColor: ui.surface,
        color: ui.text,
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-20 border-b p-3 transition-colors duration-300 ease-out"
        style={{
          backgroundColor: ui.surface2,
          borderColor: ui.border,
        }}
      >
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span
                className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: ui.accentSoft,
                  color: ui.accent,
                  border: `1px solid ${ui.accentSoft2}`,
                }}
              >
                Reference Memo
              </span>
            </div>

            <div className="group flex items-center gap-3">
              <h2
                className="pl-2 text-2xl font-black tracking-tight tabular-nums transition-colors duration-300 ease-out"
                style={{ color: ui.text }}
              >
                {credit.memoNo}
              </h2>

              <button
                onClick={handleCopyMemo}
                className="rounded-md p-1.5 transition-all focus:outline-none focus:ring-2"
                style={{
                  color: ui.muted,
                  outlineColor: ui.accent,
                }}
                title="Copy Reference Number"
                type="button"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = ui.surface;
                  e.currentTarget.style.color = ui.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = ui.muted;
                }}
              >
                {copied ? (
                  <Check size={16} style={{ color: "#16a34a" }} />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>

          <div
            className="flex w-full items-center justify-center gap-3 rounded-xl border p-2 pr-4 shadow-sm transition-colors duration-300 ease-out md:w-auto"
            style={{
              backgroundColor: ui.surface,
              borderColor: ui.border,
            }}
          >
            <div
              className="rounded-lg p-2.5 transition-colors duration-300 ease-out"
              style={{
                backgroundColor: statusMeta.chipBg,
                color: statusMeta.chipText,
              }}
            >
              <StatusIcon status={credit.status} size={20} />
            </div>

            <div>
              <p
                className="mb-1 text-[10px] font-bold uppercase leading-none"
                style={{ color: ui.muted }}
              >
                Status
              </p>
              <p
                className="text-xs font-semibold"
                style={{ color: statusMeta.label }}
              >
                {credit.status}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-4 transition-colors duration-300 ease-out md:space-y-8 md:p-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          <div
            className="flex items-start gap-4 rounded-xl border p-4 transition-colors duration-300 ease-out"
            style={{
              backgroundColor: ui.surface2,
              borderColor: ui.borderSoft,
            }}
          >
            <div
              className="rounded-lg border p-2 transition-colors duration-300 ease-out"
              style={{
                backgroundColor: ui.surface,
                borderColor: ui.border,
                color: ui.muted,
              }}
            >
              <Clock size={20} />
            </div>
            <div>
              <p
                className="mb-1 text-xs font-bold uppercase tracking-wider"
                style={{ color: ui.muted }}
              >
                Duration
              </p>
              <p
                className="text-xl font-bold tabular-nums"
                style={{ color: ui.text }}
              >
                {credit.duration?.hours || 0}
                <span
                  className="text-sm font-medium"
                  style={{ color: ui.muted }}
                >
                  h
                </span>{" "}
                {credit.duration?.minutes || 0}
                <span
                  className="text-sm font-medium"
                  style={{ color: ui.muted }}
                >
                  m
                </span>
              </p>
            </div>
          </div>

          <div
            className="flex items-start gap-4 rounded-xl border p-4 transition-colors duration-300 ease-out"
            style={{
              backgroundColor: ui.surface2,
              borderColor: ui.borderSoft,
            }}
          >
            <div
              className="rounded-lg border p-2 transition-colors duration-300 ease-out"
              style={{
                backgroundColor: ui.surface,
                borderColor: ui.border,
                color: ui.muted,
              }}
            >
              <User size={20} />
            </div>
            <div className="min-w-0">
              <p
                className="mb-1 text-xs font-bold uppercase tracking-wider"
                style={{ color: ui.muted }}
              >
                Authorized By
              </p>
              <p
                className="truncate text-sm font-bold"
                style={{ color: ui.text }}
                title={`${credit.creditedBy?.firstName} ${credit.creditedBy?.lastName}`}
              >
                {credit.creditedBy?.firstName} {credit.creditedBy?.lastName}
              </p>
              <p className="truncate text-xs" style={{ color: ui.muted }}>
                {credit.creditedBy?.position}
              </p>
            </div>
          </div>

          <div
            className="flex items-start gap-4 rounded-xl border p-4 transition-colors duration-300 ease-out"
            style={{
              backgroundColor: ui.surface2,
              borderColor: ui.borderSoft,
            }}
          >
            <div
              className="rounded-lg border p-2 transition-colors duration-300 ease-out"
              style={{
                backgroundColor: ui.surface,
                borderColor: ui.border,
                color: ui.muted,
              }}
            >
              <Calendar size={20} />
            </div>
            <div>
              <p
                className="mb-1 text-xs font-bold uppercase tracking-wider"
                style={{ color: ui.muted }}
              >
                Credited Date
              </p>
              <p className="text-sm font-bold" style={{ color: ui.text }}>
                {formatDate(credit.dateCredited)}
              </p>
              <p className="text-xs" style={{ color: ui.muted }}>
                Approved: {formatDate(credit.dateApproved)}
              </p>
            </div>
          </div>
        </div>

        {/* Employees */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4
              className="flex items-center gap-2 text-sm font-bold transition-colors duration-300 ease-out"
              style={{ color: ui.text }}
            >
              <Users size={16} style={{ color: ui.muted }} />
              Beneficiary Employees
              <span
                className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: ui.surface2,
                  color: ui.muted,
                  borderColor: ui.border,
                }}
              >
                {credit.employees?.length || 0}
              </span>
            </h4>

            <div
              className="hidden items-center gap-3 text-[10px] font-medium md:flex transition-colors duration-300 ease-out"
              style={{ color: ui.muted }}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ui.accent }}
                />
                Used
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: "#f59e0b" }}
                />
                Reserved
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full border"
                  style={{
                    backgroundColor: ui.surface2,
                    borderColor: ui.border,
                  }}
                />
                Remaining
              </span>
            </div>
          </div>

          <div className="block space-y-3 md:hidden">
            {credit.employees?.length ? (
              credit.employees.map((e) => (
                <EmployeeMobileCard key={e._id} data={e} />
              ))
            ) : (
              <EmptyEmployees />
            )}
          </div>

          <div
            className="relative hidden overflow-hidden rounded-xl border shadow-sm transition-colors duration-300 ease-out md:block"
            style={{
              backgroundColor: ui.surface,
              borderColor: ui.border,
            }}
          >
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              <table className="w-full border-collapse text-left">
                <thead
                  className="sticky top-0 z-10 border-b transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: ui.surface2,
                    borderColor: ui.border,
                  }}
                >
                  <tr>
                    <th
                      className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: ui.muted }}
                    >
                      Employee
                    </th>
                    <th
                      className="w-5/12 px-4 py-3 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: ui.muted }}
                    >
                      Utilization
                    </th>
                    <th
                      className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: ui.muted }}
                    >
                      Remaining
                    </th>
                    <th
                      className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: ui.muted }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody
                  className="divide-y transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: ui.surface,
                    borderColor: ui.borderSoft,
                  }}
                >
                  {credit.employees?.map((e, i) => {
                    const rowBg = i % 2 === 0 ? ui.surface : ui.surface2;

                    return (
                      <tr
                        key={e._id}
                        className="transition-colors duration-200 ease-out"
                        style={{ backgroundColor: rowBg }}
                        onMouseEnter={(ev) => {
                          ev.currentTarget.style.backgroundColor =
                            ui.accentSoft;
                        }}
                        onMouseLeave={(ev) => {
                          ev.currentTarget.style.backgroundColor = rowBg;
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              firstName={e.employee.firstName}
                              lastName={e.employee.lastName}
                            />
                            <div>
                              <p
                                className="text-sm font-bold transition-colors duration-200 ease-out"
                                style={{ color: ui.text }}
                              >
                                {e.employee.firstName} {e.employee.lastName}
                              </p>
                              <p
                                className="text-[11px] font-medium"
                                style={{ color: ui.muted }}
                              >
                                {e.employee.position}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <UtilizationBar
                            used={e.usedHours}
                            reserved={e.reservedHours || 0}
                            total={e.creditedHours}
                            compact={true}
                          />
                          <div
                            className="mt-1 flex gap-3 text-[10px] font-medium transition-colors duration-300 ease-out"
                            style={{ color: ui.muted }}
                          >
                            <span>
                              Used:{" "}
                              <span style={{ color: ui.text }}>
                                {e.usedHours}h
                              </span>
                            </span>
                            {e.reservedHours > 0 && (
                              <span>
                                Reserved:{" "}
                                <span style={{ color: "#f59e0b" }}>
                                  {e.reservedHours}h
                                </span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center align-middle">
                          <span
                            className="inline-block rounded-md px-2 py-1 text-sm font-bold tabular-nums transition-colors duration-300 ease-out"
                            style={{
                              backgroundColor:
                                e.remainingHours > 0
                                  ? ui.accentSoft
                                  : ui.surface2,
                              color:
                                e.remainingHours > 0 ? ui.accent : ui.muted,
                              border: `1px solid ${
                                e.remainingHours > 0
                                  ? ui.accentSoft2
                                  : ui.border
                              }`,
                            }}
                          >
                            {e.remainingHours}h
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right align-middle">
                          <StatusBadge
                            status={e.status}
                            className="inline-flex text-[10px]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {(!credit.employees || credit.employees.length === 0) && (
              <div
                className="flex flex-col items-center justify-center py-12 transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: ui.surface2,
                  color: ui.muted,
                }}
              >
                <AlertCircle size={24} className="mb-2 opacity-60" />
                <span className="text-sm italic">No employees assigned.</span>
              </div>
            )}
          </div>
        </div>

        {/* Document */}
        {credit.uploadedMemo && (
          <div
            className="space-y-3 border-t pt-2 transition-colors duration-300 ease-out"
            style={{ borderColor: ui.border }}
          >
            <div className="flex items-center justify-between">
              <h4
                className="flex items-center gap-2 text-sm font-bold transition-colors duration-300 ease-out"
                style={{ color: ui.text }}
              >
                <FileText size={16} style={{ color: ui.muted }} />
                Supporting Memos
              </h4>

              <div className="flex gap-2">
                <a
                  href={PDF_URL}
                  download
                  className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors duration-200 ease-out"
                  style={{
                    borderColor: ui.border,
                    backgroundColor: ui.surface,
                    color: ui.muted,
                  }}
                >
                  <Download size={12} /> Download
                </a>

                <a
                  href={PDF_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors duration-200 ease-out"
                  style={{
                    backgroundColor: ui.accentSoft,
                    borderColor: ui.accentSoft2,
                    color: ui.accent,
                  }}
                >
                  Open New Tab <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-xl border p-1 transition-colors duration-300 ease-out"
              style={{
                borderColor: ui.border,
                backgroundColor: ui.surface2,
              }}
            >
              {credit.uploadedMemo.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={`${PDF_URL}#toolbar=0`}
                  className="h-[400px] w-full rounded-lg"
                  style={{ backgroundColor: ui.surface }}
                  title="Memo Preview"
                />
              ) : (
                <div
                  className="m-2 flex h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: ui.surface2,
                    borderColor: ui.border,
                    color: ui.muted,
                  }}
                >
                  <Info size={32} className="mb-2 opacity-30" />
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
