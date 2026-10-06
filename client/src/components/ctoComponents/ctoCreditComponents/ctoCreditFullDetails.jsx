import React, { useMemo, useState } from "react";
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
  Briefcase,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  CalendarCheck,
} from "lucide-react";
import { StatusBadge, StatusIcon } from "../../statusUtils";
import { buildApiUrl } from "../../../config/env";

/* =========================
   THEME TOKENS
========================= */
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
  amber: "#f59e0b",
  red: "#ef4444",
  green: "#16a34a",
};

const EMPLOYEE_SEARCH_THRESHOLD = 6;

/* =========================
   HELPERS
========================= */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// 4.666666 -> "4.67", 8 -> "8"
const fmtHours = (v) => `${Number(toNum(v).toFixed(2))}`;

// { hours: 8, minutes: 0 } -> "8 hrs", { hours: 1, minutes: 30 } -> "1 hr 30 mins"
const fmtDuration = (duration) => {
  const h = toNum(duration?.hours);
  const m = toNum(duration?.minutes);
  if (!h && !m) return "0 hrs";
  const parts = [];
  if (h) parts.push(`${h} ${h === 1 ? "hr" : "hrs"}`);
  if (m) parts.push(`${m} ${m === 1 ? "min" : "mins"}`);
  return parts.join(" ");
};

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

const formatOvertimeDates = (start, end) => {
  if (!start && !end) return "-";
  const s = formatDate(start);
  const e = formatDate(end || start);
  return s === e ? s : `${s} – ${e}`;
};

const fullName = (p) =>
  `${p?.firstName || ""} ${p?.lastName || ""}`.trim() || "-";

const getFileKind = (path = "") => {
  const p = String(path).toLowerCase();
  if (p.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|gif|webp)$/.test(p)) return "image";
  return "other";
};

const getStatusMeta = (status) => {
  switch (status) {
    case "ROLLEDBACK":
      return { chipBg: "rgba(239,68,68,0.14)", chipText: "#e11d48" };
    case "CREDITED":
    case "ACTIVE":
      return { chipBg: "rgba(34,197,94,0.14)", chipText: ui.green };
    case "EXHAUSTED":
      return { chipBg: "rgba(245,158,11,0.16)", chipText: "#d97706" };
    default:
      return { chipBg: ui.surface2, chipText: ui.muted };
  }
};

/* =========================
   SMALL UI
========================= */
const SectionTitle = ({ icon: Icon, children, right }) => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <h4
      className="flex items-center gap-2 text-sm font-bold"
      style={{ color: ui.text }}
    >
      {Icon && <Icon size={16} style={{ color: ui.muted }} />}
      {children}
    </h4>
    {right}
  </div>
);

const MetaChip = ({ icon: Icon, children, strong }) => (
  <span
    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
    style={
      strong
        ? {
            backgroundColor: ui.accentSoft,
            borderColor: ui.accentSoft2,
            color: ui.accent,
          }
        : {
            backgroundColor: ui.surface,
            borderColor: ui.border,
            color: ui.muted,
          }
    }
  >
    <Icon size={12} />
    {children}
  </span>
);

const InfoTile = ({ icon: Icon, label, children, sub, className = "" }) => (
  <div
    className={`flex items-start gap-3 rounded-xl border p-3 min-w-0 ${className}`}
    style={{ backgroundColor: ui.surface2, borderColor: ui.borderSoft }}
  >
    <div
      className="shrink-0 rounded-lg border p-1.5"
      style={{
        backgroundColor: ui.surface,
        borderColor: ui.border,
        color: ui.muted,
      }}
    >
      <Icon size={16} />
    </div>
    <div className="min-w-0 flex-1">
      <p
        className="mb-0.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ color: ui.muted }}
      >
        {label}
      </p>
      <div className="text-sm font-bold break-words" style={{ color: ui.text }}>
        {children}
      </div>
      {sub && (
        <p className="mt-0.5 text-xs truncate" style={{ color: ui.muted }}>
          {sub}
        </p>
      )}
    </div>
  </div>
);

const SummaryStat = ({ label, value, color, first }) => (
  <div
    className="min-w-0 px-3 py-2 text-center"
    style={first ? undefined : { borderLeft: `1px solid ${ui.border}` }}
  >
    <p
      className="text-[10px] font-bold uppercase tracking-wider truncate"
      style={{ color: ui.muted }}
    >
      {label}
    </p>
    <p
      className="text-base font-extrabold tabular-nums truncate"
      style={{ color: color || ui.text }}
    >
      {value}
    </p>
  </div>
);

const UtilizationBar = ({ used = 0, reserved = 0, total = 0, height = 8 }) => {
  const t = toNum(total);
  const u = toNum(used);
  const r = toNum(reserved);
  const usedPct = t > 0 ? Math.min((u / t) * 100, 100) : 0;
  const reservedPct = t > 0 ? Math.min((r / t) * 100, 100 - usedPct) : 0;

  return (
    <div
      className="flex w-full overflow-hidden rounded-full"
      style={{
        backgroundColor: ui.surface2,
        height,
        boxShadow: `inset 0 0 0 1px ${ui.borderSoft}`,
      }}
      role="img"
      aria-label={`${fmtHours(u)}h used, ${fmtHours(r)}h reserved of ${fmtHours(t)}h`}
    >
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${usedPct}%`, backgroundColor: ui.accent }}
        title={`${fmtHours(u)}h used`}
      />
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${reservedPct}%`, backgroundColor: ui.amber }}
        title={`${fmtHours(r)}h reserved`}
      />
    </div>
  );
};

const Legend = () => (
  <div
    className="flex items-center gap-3 text-[10px] font-medium"
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
        style={{ backgroundColor: ui.amber }}
      />
      Reserved
    </span>
    <span className="flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full border"
        style={{ backgroundColor: ui.surface2, borderColor: ui.border }}
      />
      Remaining
    </span>
  </div>
);

const UserAvatar = ({ firstName, lastName }) => (
  <div
    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
    style={{ backgroundColor: ui.accentSoft, color: ui.accent }}
  >
    {`${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?"}
  </div>
);

const HoursPill = ({ value, positiveColor, positiveBg, positiveBorder }) => {
  const n = toNum(value);
  const positive = n > 0;
  return (
    <span
      className="inline-block min-w-[3.25rem] rounded-md px-2 py-0.5 text-xs font-bold tabular-nums"
      style={{
        backgroundColor: positive ? positiveBg || "transparent" : "transparent",
        color: positive ? positiveColor : ui.muted,
        border: `1px solid ${positive ? positiveBorder || "transparent" : "transparent"}`,
      }}
    >
      {fmtHours(n)}h
    </span>
  );
};

/* =========================
   EMPLOYEE MOBILE CARD
========================= */
const EmployeeMobileCard = ({ data }) => {
  const credited = toNum(data.creditedHours);
  const used = toNum(data.usedHours);
  const reserved = toNum(data.reservedHours);
  const remaining = toNum(data.remainingHours);
  const forfeited = toNum(data.forfeitedHours);

  const cols = [
    { label: "Credited", value: credited, color: ui.text },
    { label: "Used", value: used, color: used > 0 ? ui.accent : ui.muted },
    {
      label: "Left",
      value: remaining,
      color: remaining > 0 ? ui.green : ui.muted,
    },
    forfeited > 0
      ? { label: "Forfeited", value: forfeited, color: ui.red }
      : {
          label: "Reserved",
          value: reserved,
          color: reserved > 0 ? ui.amber : ui.muted,
        },
  ];

  return (
    <div
      className="rounded-xl border p-3"
      style={{ backgroundColor: ui.surface, borderColor: ui.border }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar
            firstName={data.employee?.firstName}
            lastName={data.employee?.lastName}
          />
          <div className="min-w-0">
            <p
              className="truncate text-sm font-bold"
              style={{ color: ui.text }}
            >
              {fullName(data.employee)}
            </p>
            <p className="truncate text-[11px]" style={{ color: ui.muted }}>
              {data.employee?.position || "-"}
            </p>
          </div>
        </div>
        <StatusBadge status={data.status} className="text-[10px]" />
      </div>

      <div className="mt-3">
        <UtilizationBar used={used} reserved={reserved} total={credited} />
      </div>

      <div
        className="mt-3 grid grid-cols-4 rounded-lg border"
        style={{ backgroundColor: ui.surface2, borderColor: ui.borderSoft }}
      >
        {cols.map((c, i) => (
          <div
            key={c.label}
            className="px-1 py-1.5 text-center"
            style={
              i === 0 ? undefined : { borderLeft: `1px solid ${ui.border}` }
            }
          >
            <p
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: ui.muted }}
            >
              {c.label}
            </p>
            <p
              className="text-sm font-bold tabular-nums"
              style={{ color: c.color }}
            >
              {fmtHours(c.value)}h
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const EmptyEmployees = ({ filtered }) => (
  <div
    className="flex flex-col items-center justify-center rounded-xl border py-10 text-center"
    style={{
      backgroundColor: ui.surface2,
      borderColor: ui.border,
      color: ui.muted,
    }}
  >
    <AlertCircle size={22} className="mb-2 opacity-60" />
    <span className="text-sm">
      {filtered ? "No employees match your search." : "No employees assigned."}
    </span>
  </div>
);

/* =========================
   MAIN COMPONENT
========================= */
const SORTS = {
  name: { label: "Name", get: (e) => fullName(e.employee).toLowerCase() },
  credited: { label: "Credited", get: (e) => toNum(e.creditedHours) },
  remaining: { label: "Remaining", get: (e) => toNum(e.remainingHours) },
  used: { label: "Used", get: (e) => toNum(e.usedHours) },
};

const CtoCreditDetails = ({ credit }) => {
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [showPreview, setShowPreview] = useState(true);

  const employees = useMemo(() => credit?.employees || [], [credit]);

  // Usage across all employees on this memo (credited is NOT summed — the memo's
  // credited hours come from credit.duration)
  const totals = useMemo(
    () =>
      employees.reduce(
        (acc, e) => {
          acc.credited += toNum(e.creditedHours);
          acc.used += toNum(e.usedHours);
          acc.reserved += toNum(e.reservedHours);
          acc.remaining += toNum(e.remainingHours);
          acc.forfeited += toNum(e.forfeitedHours);
          return acc;
        },
        { credited: 0, used: 0, reserved: 0, remaining: 0, forfeited: 0 },
      ),
    [employees],
  );

  const visibleEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? employees.filter((e) =>
          `${fullName(e.employee)} ${e.employee?.position || ""}`
            .toLowerCase()
            .includes(q),
        )
      : employees;

    const getter = SORTS[sort.key]?.get || SORTS.name.get;
    return [...filtered].sort((a, b) => {
      const va = getter(a);
      const vb = getter(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [employees, query, sort]);

  if (!credit) return null;

  const statusMeta = getStatusMeta(credit.status);
  const showSearch = employees.length >= EMPLOYEE_SEARCH_THRESHOLD;
  const hasForfeited = totals.forfeited > 0;
  const utilPct =
    totals.credited > 0
      ? Math.round(((totals.used + totals.reserved) / totals.credited) * 100)
      : 0;

  const FILE_URL = credit.uploadedMemo
    ? buildApiUrl(String(credit.uploadedMemo).replace(/\\/g, "/"))
    : "";
  const fileKind = getFileKind(credit.uploadedMemo);
  const fileName = credit.uploadedMemo
    ? String(credit.uploadedMemo).split(/[\\/]/).pop()
    : "";

  const handleCopyMemo = async () => {
    try {
      await navigator.clipboard.writeText(credit.memoNo || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );

  const SortHeader = ({ k, children, align = "center" }) => {
    const active = sort.key === k;
    const Icon = sort.dir === "asc" ? ChevronUp : ChevronDown;
    return (
      <th
        className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-${align}`}
        style={{ color: active ? ui.accent : ui.muted }}
      >
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="inline-flex items-center gap-1"
          title={`Sort by ${SORTS[k].label}`}
        >
          {children}
          {active ? (
            <Icon size={12} />
          ) : (
            <ChevronDown size={12} className="opacity-30" />
          )}
        </button>
      </th>
    );
  };

  return (
    <div
      className="max-h-[75vh] overflow-y-auto custom-scrollbar"
      style={{ backgroundColor: ui.surface, color: ui.text }}
    >
      {/* ================= COMPACT HEADER ================= */}
      <div
        className="sticky top-0 z-20 border-b px-4 py-2.5 md:px-5"
        style={{ backgroundColor: ui.surface2, borderColor: ui.border }}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2
                className="min-w-0 truncate text-base md:text-lg font-extrabold leading-tight"
                style={{ color: ui.text }}
                title={credit.memoNo}
              >
                {credit.memoNo || "-"}
              </h2>
              <button
                onClick={handleCopyMemo}
                className="shrink-0 rounded-md p-1 transition-colors"
                style={{ color: copied ? ui.green : ui.muted }}
                title={copied ? "Copied!" : "Copy reference"}
                aria-label="Copy reference"
                type="button"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = ui.surface;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <MetaChip icon={Clock} strong>
                {fmtDuration(credit.duration)} credited
              </MetaChip>
              <MetaChip icon={Calendar}>
                {formatOvertimeDates(
                  credit.inclusiveDates?.startDate,
                  credit.inclusiveDates?.endDate,
                )}
              </MetaChip>
              <MetaChip icon={Users}>
                {employees.length} employee{employees.length !== 1 ? "s" : ""}
              </MetaChip>
            </div>
          </div>

          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{
              backgroundColor: statusMeta.chipBg,
              color: statusMeta.chipText,
            }}
          >
            <StatusIcon status={credit.status} size={13} />
            {credit.status || "-"}
          </span>
        </div>
      </div>

      <div className="space-y-5 p-4 md:p-5">
        {/* ================= USAGE SUMMARY ================= */}
        {employees.length > 0 && (
          <div
            className="rounded-xl border"
            style={{ backgroundColor: ui.surface, borderColor: ui.border }}
          >
            <div
              className={`grid ${
                hasForfeited
                  ? "grid-cols-2 sm:grid-cols-5"
                  : "grid-cols-2 sm:grid-cols-4"
              }`}
            >
              <SummaryStat
                first
                label="Credited"
                value={fmtDuration(credit.duration)}
              />
              <SummaryStat
                label="Used"
                value={`${fmtHours(totals.used)}h`}
                color={ui.accent}
              />
              <SummaryStat
                label="Reserved"
                value={`${fmtHours(totals.reserved)}h`}
                color={ui.amber}
              />
              <SummaryStat
                label="Remaining"
                value={`${fmtHours(totals.remaining)}h`}
                color={ui.green}
              />
              {hasForfeited && (
                <SummaryStat
                  label="Forfeited"
                  value={`${fmtHours(totals.forfeited)}h`}
                  color={ui.red}
                />
              )}
            </div>
            <div
              className="space-y-1.5 border-t px-3 py-2.5"
              style={{ borderColor: ui.border }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: ui.muted }}
                >
                  {utilPct}% utilized across {employees.length} employee
                  {employees.length !== 1 ? "s" : ""}
                </span>
                <Legend />
              </div>
              <UtilizationBar
                used={totals.used}
                reserved={totals.reserved}
                total={totals.credited}
                height={8}
              />
            </div>
          </div>
        )}

        {/* ================= DETAILS ================= */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <InfoTile icon={Calendar} label="Overtime Rendered">
            {formatOvertimeDates(
              credit.inclusiveDates?.startDate,
              credit.inclusiveDates?.endDate,
            )}
          </InfoTile>

          <InfoTile
            icon={CalendarCheck}
            label="Credited Date"
            sub={`Approved: ${formatDate(credit.dateApproved)}`}
          >
            {formatDate(credit.dateCredited)}
          </InfoTile>

          <InfoTile
            icon={User}
            label="Authorized By"
            sub={credit.creditedBy?.position}
          >
            <span
              className="block truncate"
              title={fullName(credit.creditedBy)}
            >
              {fullName(credit.creditedBy)}
            </span>
          </InfoTile>

          <InfoTile
            icon={Briefcase}
            label="Purpose / Activity"
            className="sm:col-span-2 lg:col-span-3"
          >
            <span className="font-semibold leading-snug">
              {credit.purpose || "-"}
            </span>
          </InfoTile>
        </div>

        {/* ================= EMPLOYEES ================= */}
        <div className="space-y-3">
          <SectionTitle
            icon={Users}
            right={
              showSearch && (
                <div className="relative w-full sm:w-56">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: ui.muted }}
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search employee..."
                    maxLength={80}
                    className="h-8 w-full rounded-lg border pl-8 pr-8 text-xs outline-none"
                    style={{
                      backgroundColor: ui.surface,
                      borderColor: ui.border,
                      color: ui.text,
                    }}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
                      style={{ color: ui.muted }}
                      aria-label="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )
            }
          >
            Beneficiary Employees
            <span
              className="rounded-md border px-1.5 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: ui.surface2,
                color: ui.muted,
                borderColor: ui.border,
              }}
            >
              {query
                ? `${visibleEmployees.length} / ${employees.length}`
                : employees.length}
            </span>
          </SectionTitle>

          {/* Mobile */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:hidden">
            {visibleEmployees.length ? (
              visibleEmployees.map((e, i) => (
                <EmployeeMobileCard key={e._id || i} data={e} />
              ))
            ) : (
              <div className="sm:col-span-2">
                <EmptyEmployees filtered={!!query} />
              </div>
            )}
          </div>

          {/* Desktop */}
          <div
            className="hidden overflow-hidden rounded-xl border md:block"
            style={{ backgroundColor: ui.surface, borderColor: ui.border }}
          >
            {visibleEmployees.length === 0 ? (
              <EmptyEmployees filtered={!!query} />
            ) : (
              <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                <table className="w-full table-fixed border-collapse text-left">
                  <colgroup>
                    <col style={{ width: "34%" }} />
                    <col style={{ width: hasForfeited ? "11%" : "13%" }} />
                    <col style={{ width: hasForfeited ? "11%" : "13%" }} />
                    <col style={{ width: hasForfeited ? "11%" : "13%" }} />
                    <col style={{ width: hasForfeited ? "11%" : "13%" }} />
                    {hasForfeited && <col style={{ width: "10%" }} />}
                    <col style={{ width: "14%" }} />
                  </colgroup>
                  <thead
                    className="sticky top-0 z-10"
                    style={{
                      backgroundColor: ui.surface2,
                      boxShadow: `inset 0 -1px 0 ${ui.border}`,
                    }}
                  >
                    <tr>
                      <SortHeader k="name" align="left">
                        Employee
                      </SortHeader>
                      <SortHeader k="credited">Credited</SortHeader>
                      <SortHeader k="used">Used</SortHeader>
                      <th
                        className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: ui.muted }}
                      >
                        Reserved
                      </th>
                      <SortHeader k="remaining">Remaining</SortHeader>
                      {hasForfeited && (
                        <th
                          className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: ui.muted }}
                          title="Hours forfeited due to CSC limits (120h balance / 40h per month)"
                        >
                          Forfeited
                        </th>
                      )}
                      <th
                        className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: ui.muted }}
                      >
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleEmployees.map((e, i) => {
                      const rowBg = i % 2 === 0 ? ui.surface : ui.surface2;
                      const credited = toNum(e.creditedHours);
                      const used = toNum(e.usedHours);
                      const reserved = toNum(e.reservedHours);
                      const remaining = toNum(e.remainingHours);
                      const forfeited = toNum(e.forfeitedHours);

                      return (
                        <tr
                          key={e._id || i}
                          className="transition-colors duration-150"
                          style={{
                            backgroundColor: rowBg,
                            boxShadow: `inset 0 -1px 0 ${ui.borderSoft}`,
                          }}
                          onMouseEnter={(ev) => {
                            ev.currentTarget.style.backgroundColor =
                              ui.accentSoft;
                          }}
                          onMouseLeave={(ev) => {
                            ev.currentTarget.style.backgroundColor = rowBg;
                          }}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar
                                firstName={e.employee?.firstName}
                                lastName={e.employee?.lastName}
                              />
                              <div className="min-w-0 flex-1">
                                <p
                                  className="truncate text-sm font-bold"
                                  style={{ color: ui.text }}
                                  title={fullName(e.employee)}
                                >
                                  {fullName(e.employee)}
                                </p>
                                <p
                                  className="truncate text-[11px]"
                                  style={{ color: ui.muted }}
                                  title={e.employee?.position}
                                >
                                  {e.employee?.position || "-"}
                                </p>
                                <div className="mt-1.5">
                                  <UtilizationBar
                                    used={used}
                                    reserved={reserved}
                                    total={credited}
                                    height={5}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <span
                              className="text-sm font-bold tabular-nums"
                              style={{ color: ui.text }}
                            >
                              {fmtHours(credited)}h
                            </span>
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <HoursPill value={used} positiveColor={ui.accent} />
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <HoursPill
                              value={reserved}
                              positiveColor={ui.amber}
                            />
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <HoursPill
                              value={remaining}
                              positiveColor={ui.accent}
                              positiveBg={ui.accentSoft}
                              positiveBorder={ui.accentSoft2}
                            />
                          </td>

                          {hasForfeited && (
                            <td className="px-3 py-2.5 text-center">
                              <HoursPill
                                value={forfeited}
                                positiveColor={ui.red}
                              />
                            </td>
                          )}

                          <td className="px-3 py-2.5 text-right">
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
            )}
          </div>
        </div>

        {/* ================= DOCUMENT ================= */}
        {credit.uploadedMemo ? (
          <div
            className="space-y-3 border-t pt-5"
            style={{ borderColor: ui.border }}
          >
            <SectionTitle
              icon={FileText}
              right={
                <div className="flex flex-wrap gap-2">
                  {fileKind !== "other" && (
                    <button
                      type="button"
                      onClick={() => setShowPreview((v) => !v)}
                      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                      style={{
                        borderColor: ui.border,
                        backgroundColor: ui.surface,
                        color: ui.muted,
                      }}
                    >
                      {showPreview ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                      {showPreview ? "Hide preview" : "Show preview"}
                    </button>
                  )}
                  <a
                    href={FILE_URL}
                    download
                    className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                    style={{
                      borderColor: ui.border,
                      backgroundColor: ui.surface,
                      color: ui.muted,
                    }}
                  >
                    <Download size={12} /> Download
                  </a>
                  <a
                    href={FILE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                    style={{
                      backgroundColor: ui.accentSoft,
                      borderColor: ui.accentSoft2,
                      color: ui.accent,
                    }}
                  >
                    Open <ExternalLink size={12} />
                  </a>
                </div>
              }
            >
              Supporting Memo
            </SectionTitle>

            <p
              className="truncate text-[11px] font-mono"
              style={{ color: ui.muted }}
              title={fileName}
            >
              {fileName}
            </p>

            {showPreview && (
              <div
                className="overflow-hidden rounded-xl border p-1"
                style={{ borderColor: ui.border, backgroundColor: ui.surface2 }}
              >
                {fileKind === "pdf" && (
                  <iframe
                    src={`${FILE_URL}#toolbar=0`}
                    className="h-[60vh] min-h-[360px] w-full rounded-lg"
                    style={{ backgroundColor: ui.surface }}
                    title="Memo preview"
                    loading="lazy"
                  />
                )}
                {fileKind === "image" && (
                  <img
                    src={FILE_URL}
                    alt="Memo"
                    loading="lazy"
                    className="mx-auto max-h-[60vh] w-auto rounded-lg object-contain"
                  />
                )}
                {fileKind === "other" && (
                  <div
                    className="m-2 flex h-36 flex-col items-center justify-center rounded-lg border-2 border-dashed"
                    style={{ borderColor: ui.border, color: ui.muted }}
                  >
                    <Info size={28} className="mb-2 opacity-40" />
                    <p className="text-sm font-medium">
                      Preview not available for this file type
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm"
            style={{ borderColor: ui.border, color: ui.muted }}
          >
            <FileText size={16} className="opacity-60" />
            No memo file attached to this credit.
          </div>
        )}
      </div>
    </div>
  );
};

export default CtoCreditDetails;
