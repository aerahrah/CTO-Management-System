import React, { useMemo, useState } from "react";
import {
  Users,
  Calendar,
  CalendarDays,
  CalendarCheck,
  User,
  Check,
  Copy,
  AlertCircle,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { StatusBadge, StatusIcon } from "../../statusUtils";

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

// 2.5 -> "2.5", 5 -> "5"
const fmtNum = (v) => `${Number(toNum(v).toFixed(2))}`;

// 1 -> "1 day", 5 -> "5 days"
const fmtDays = (v) => {
  const n = Number(toNum(v).toFixed(2));
  return `${n} ${n === 1 ? "day" : "days"}`;
};

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

// creditedBy / rolledBackBy may be a populated object or just an id
const personName = (p) =>
  p && typeof p === "object"
    ? `${p.firstName || ""} ${p.lastName || ""}`.trim() || "-"
    : "-";

const fullName = (p) =>
  `${p?.firstName || ""} ${p?.lastName || ""}`.trim() || "-";

// Live wellness balance of the employee (only if the API populated it)
const getBalance = (e) => {
  const v = e?.employee?.balances?.wellnessDays;
  return typeof v === "number" ? v : null;
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
      aria-label={`${fmtDays(u)} used, ${fmtDays(r)} reserved of ${fmtDays(t)}`}
    >
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${usedPct}%`, backgroundColor: ui.accent }}
        title={`${fmtDays(u)} used`}
      />
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${reservedPct}%`, backgroundColor: ui.amber }}
        title={`${fmtDays(r)} reserved`}
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

const DaysPill = ({ value, positiveColor, positiveBg, positiveBorder }) => {
  const n = toNum(value);
  const positive = n > 0;
  return (
    <span
      className="inline-block min-w-[3rem] rounded-md px-2 py-0.5 text-xs font-bold tabular-nums"
      style={{
        backgroundColor: positive ? positiveBg || "transparent" : "transparent",
        color: positive ? positiveColor : ui.muted,
        border: `1px solid ${positive ? positiveBorder || "transparent" : "transparent"}`,
      }}
    >
      {fmtNum(n)}d
    </span>
  );
};

/* =========================
   EMPLOYEE MOBILE CARD
========================= */
const EmployeeMobileCard = ({ data, showBalance }) => {
  const credited = toNum(data.creditedDays);
  const used = toNum(data.usedDays);
  const reserved = toNum(data.reservedDays);
  const remaining = toNum(data.remainingDays);
  const balance = getBalance(data);

  const cols = [
    { label: "Credited", value: credited, color: ui.text },
    { label: "Used", value: used, color: used > 0 ? ui.accent : ui.muted },
    {
      label: "Reserved",
      value: reserved,
      color: reserved > 0 ? ui.amber : ui.muted,
    },
    {
      label: "Left",
      value: remaining,
      color: remaining > 0 ? ui.green : ui.muted,
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
              {fmtNum(c.value)}d
            </p>
          </div>
        ))}
      </div>

      {showBalance && balance !== null && (
        <div
          className="mt-2 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
          style={{ backgroundColor: ui.accentSoft, color: ui.accent }}
        >
          <span className="flex items-center gap-1.5 font-semibold">
            <Wallet size={12} /> Current wellness balance
          </span>
          <span className="font-extrabold tabular-nums">
            {fmtDays(balance)}
          </span>
        </div>
      )}
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
  credited: { label: "Credited", get: (e) => toNum(e.creditedDays) },
  used: { label: "Used", get: (e) => toNum(e.usedDays) },
  remaining: { label: "Remaining", get: (e) => toNum(e.remainingDays) },
  balance: { label: "Balance", get: (e) => getBalance(e) ?? -1 },
};

const WellnessCreditDetails = ({ credit }) => {
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });

  const employees = useMemo(() => credit?.employees || [], [credit]);

  // Usage across all employees on this credit (credited is NOT summed — the
  // days per employee come from credit.days)
  const totals = useMemo(
    () =>
      employees.reduce(
        (acc, e) => {
          acc.credited += toNum(e.creditedDays);
          acc.used += toNum(e.usedDays);
          acc.reserved += toNum(e.reservedDays);
          acc.remaining += toNum(e.remainingDays);
          return acc;
        },
        { credited: 0, used: 0, reserved: 0, remaining: 0 },
      ),
    [employees],
  );

  // Show the live balance column only when the API sends employee balances
  const showBalance = useMemo(
    () => employees.some((e) => getBalance(e) !== null),
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
  const isRolledBack = credit.status === "ROLLEDBACK";
  const shortId = credit._id ? String(credit._id).slice(-6).toUpperCase() : "-";
  const utilPct =
    totals.credited > 0
      ? Math.round(((totals.used + totals.reserved) / totals.credited) * 100)
      : 0;

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(shortId);
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

  const SortHeader = ({ k, children, align = "center", title }) => {
    const active = sort.key === k;
    const Icon = sort.dir === "asc" ? ChevronUp : ChevronDown;
    return (
      <th
        className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-${align}`}
        style={{ color: active ? ui.accent : ui.muted }}
        title={title}
      >
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="inline-flex items-center gap-1"
          title={title || `Sort by ${SORTS[k].label}`}
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
              >
                Wellness Credit{" "}
                <span className="font-mono" style={{ color: ui.muted }}>
                  #{shortId}
                </span>
              </h2>
              <button
                onClick={handleCopyId}
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
              <MetaChip icon={CalendarDays} strong>
                {fmtDays(credit.days)} per employee
              </MetaChip>
              <MetaChip icon={Calendar}>
                Approved {formatDate(credit.dateApproved)}
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
            <div className="grid grid-cols-2 sm:grid-cols-4">
              <SummaryStat
                first
                label="Credited"
                value={fmtDays(credit.days)}
              />
              <SummaryStat
                label="Used"
                value={fmtDays(totals.used)}
                color={ui.accent}
              />
              <SummaryStat
                label="Reserved"
                value={fmtDays(totals.reserved)}
                color={ui.amber}
              />
              <SummaryStat
                label="Remaining"
                value={fmtDays(totals.remaining)}
                color={ui.green}
              />
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
          <InfoTile icon={Calendar} label="Date Approved">
            {formatDate(credit.dateApproved)}
          </InfoTile>

          <InfoTile icon={CalendarCheck} label="Credited Date">
            {formatDate(credit.dateCredited)}
          </InfoTile>

          <InfoTile
            icon={User}
            label="Authorized By"
            sub={credit.creditedBy?.position}
          >
            <span
              className="block truncate"
              title={personName(credit.creditedBy)}
            >
              {personName(credit.creditedBy)}
            </span>
          </InfoTile>

          {isRolledBack && (
            <InfoTile
              icon={RotateCcw}
              label="Rolled Back"
              sub={`By: ${personName(credit.rolledBackBy)}`}
              className="sm:col-span-2 lg:col-span-3"
            >
              {formatDate(credit.dateRolledBack)}
            </InfoTile>
          )}
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
                <EmployeeMobileCard
                  key={e._id || i}
                  data={e}
                  showBalance={showBalance}
                />
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
                    <col style={{ width: showBalance ? "30%" : "36%" }} />
                    <col style={{ width: showBalance ? "11%" : "13%" }} />
                    <col style={{ width: showBalance ? "11%" : "13%" }} />
                    <col style={{ width: showBalance ? "11%" : "13%" }} />
                    <col style={{ width: showBalance ? "11%" : "11%" }} />
                    {showBalance && <col style={{ width: "12%" }} />}
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
                      {showBalance && (
                        <SortHeader
                          k="balance"
                          title="Employee's current wellness balance (all credits, after filed leave)"
                        >
                          Balance
                        </SortHeader>
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
                      const credited = toNum(e.creditedDays);
                      const used = toNum(e.usedDays);
                      const reserved = toNum(e.reservedDays);
                      const remaining = toNum(e.remainingDays);
                      const balance = getBalance(e);

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
                              {fmtNum(credited)}d
                            </span>
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <DaysPill value={used} positiveColor={ui.accent} />
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <DaysPill
                              value={reserved}
                              positiveColor={ui.amber}
                            />
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <DaysPill
                              value={remaining}
                              positiveColor={ui.accent}
                              positiveBg={ui.accentSoft}
                              positiveBorder={ui.accentSoft2}
                            />
                          </td>

                          {showBalance && (
                            <td className="px-3 py-2.5 text-center">
                              {balance === null ? (
                                <span
                                  className="text-xs"
                                  style={{ color: ui.muted }}
                                >
                                  -
                                </span>
                              ) : (
                                <span
                                  className="text-sm font-extrabold tabular-nums"
                                  style={{
                                    color: balance > 0 ? ui.green : ui.muted,
                                  }}
                                >
                                  {fmtNum(balance)}d
                                </span>
                              )}
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
      </div>
    </div>
  );
};

export default WellnessCreditDetails;
