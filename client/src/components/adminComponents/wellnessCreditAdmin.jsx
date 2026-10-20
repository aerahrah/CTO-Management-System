import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { toast } from "react-toastify";

import {
  searchWellnessAdminEmployees,
  fetchWellnessAdminEmployeeBalance,
  recalculateWellnessAdminEmployeeBalance,
  fetchWellnessAdminCredits,
  fetchWellnessAdminCreditById,
  previewWellnessAdminCreditUpdate,
  updateWellnessAdminCredit,
} from "../../api/wellnessApplicationAdmin";

import { StatusBadge } from "../statusUtils";
import FilterSelect from "../filterSelect";
import FullHeightCardContainer from "../pageContainer";
import { useAuth } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";

import {
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Inbox,
  Layers,
  CheckCircle2,
  Users,
  Calendar,
  CalendarDays,
  CalendarX2,
  ArrowUp,
  ArrowLeft,
  Pencil,
  Eye,
  UserSearch,
  X,
  Info,
  AlertTriangle,
  ShieldAlert,
  History,
  ClipboardCheck,
  Save,
  Loader2,
  RefreshCw,
  Scale,
} from "lucide-react";

/* =====================================================================
   CONSTANTS & HELPERS
===================================================================== */

const pageSizeOptions = [20, 50, 100];

const ROW_STATUSES = ["ACTIVE", "EXHAUSTED", "EXPIRED", "ROLLEDBACK"];
const CREDIT_STATUSES = ["CREDITED", "ROLLEDBACK", "EXPIRED"];
const STATUS_LABELS = {
  CREDITED: "Credited",
  ROLLEDBACK: "Rolled Back",
  EXPIRED: "Expired",
  ACTIVE: "Active",
  EXHAUSTED: "Exhausted",
};
const FIELD_LABELS = {
  dateApproved: "Date approved",
  days: "Batch days",
  status: "Status",
  employee: "Employee",
  creditedDays: "Credited",
  usedDays: "Used",
  reservedDays: "Reserved",
  remainingDays: "Remaining",
  dateCredited: "Date credited",
};
const DEFAULT_OPTIONS = {
  adjustBalances: true,
  overrideLimit: false,
  force: false,
};

const TONES = {
  green: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.25)",
    color: "#16a34a",
  },
  red: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.25)",
    color: "#ef4444",
  },
  amber: {
    backgroundColor: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.30)",
    color: "#d97706",
  },
  blue: {
    backgroundColor: "rgba(59,130,246,0.10)",
    borderColor: "rgba(59,130,246,0.25)",
    color: "#2563eb",
  },
  accent: {
    backgroundColor: "var(--accent-soft)",
    borderColor: "var(--accent-soft2)",
    color: "var(--accent)",
  },
};
const ROW_STATUS_TONE = {
  ACTIVE: "green",
  EXHAUSTED: "blue",
  EXPIRED: "amber",
  ROLLEDBACK: "red",
};
const ACTION_META = {
  added: { label: "Added", tone: "green" },
  updated: { label: "Updated", tone: "blue" },
  removed: { label: "Removed", tone: "red" },
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmtNum = (n) => String(round2(num(n)));
const signed = (n) => {
  const v = round2(num(n));
  return v > 0 ? `+${v}` : String(v);
};
const fullName = (e) =>
  e?.fullName ||
  `${e?.firstName || ""} ${e?.lastName || ""}`.trim() ||
  "Unknown employee";
const shortId = (id) => (id ? String(id).slice(-6).toUpperCase() : "-");
const pad = (n) => String(n).padStart(2, "0");

const toInputDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const toDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(value);
};
const formatDate = (value) => {
  if (!value) return "-";
  const d = toDate(value);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};
const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
};
const formatDays = (d) => {
  const v = round2(num(d));
  return `${v} Day${v !== 1 ? "s" : ""}`;
};
const formatValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "-";
  if (field === "dateApproved" || field === "dateCredited")
    return formatDate(value);
  if (field === "status") return STATUS_LABELS[value] || value;
  return String(value);
};

const errDetails = (err) => (Array.isArray(err?.details) ? err.details : []);
const cleanParams = (params) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== "" && v !== null && v !== undefined,
    ),
  );

const getInitials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * List state lives in the URL (?view=…&status=…&q=…&page=…) so that coming
 * back from the edit page restores the same tab, filters and page.
 */
function useUrlState() {
  const [params, setParams] = useSearchParams();
  const update = useCallback(
    (patch) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "")
          next.delete(key);
        else next.set(key, String(value));
      });
      setParams(next, { replace: true });
    },
    [params, setParams],
  );
  return [params, update];
}

const positiveInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/* ------------------ Theme ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

function useThemeColors() {
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolved = useMemo(() => resolveTheme(prefTheme), [prefTheme]);
  return useMemo(
    () =>
      resolved === "dark"
        ? {
            borderColor: "rgba(255,255,255,0.07)",
            skeleton: {
              baseColor: "rgba(255,255,255,0.06)",
              highlightColor: "rgba(255,255,255,0.10)",
            },
          }
        : {
            borderColor: "rgba(15,23,42,0.10)",
            skeleton: {
              baseColor: "rgba(15,23,42,0.06)",
              highlightColor: "rgba(15,23,42,0.10)",
            },
          },
    [resolved],
  );
}

/* ------------------ Edit-form helpers ------------------ */

/** Same rule as the backend (resolveRowState). The server's Review is final. */
function resolveRow(batchStatus, row) {
  const unclaimed = round2(
    num(row.creditedDays) - num(row.usedDays) - num(row.reservedDays),
  );
  if (batchStatus === "ROLLEDBACK" || row.status === "ROLLEDBACK") {
    return { status: "ROLLEDBACK", remaining: 0 };
  }
  if (batchStatus === "EXPIRED") {
    if (row.status === "EXPIRED") return { status: "EXPIRED", remaining: 0 };
    return { status: unclaimed > 0 ? "EXPIRED" : "EXHAUSTED", remaining: 0 };
  }
  if (row.status === "EXPIRED") return { status: "EXPIRED", remaining: 0 };
  return {
    status: unclaimed > 0 ? "ACTIVE" : "EXHAUSTED",
    remaining: Math.max(unclaimed, 0),
  };
}

function toForm(credit) {
  return {
    dateApproved: toInputDate(credit.dateApproved),
    days: String(credit.days ?? ""),
    status: credit.status || "CREDITED",
    rows: (credit.employees || []).map((r) => ({
      key: String(r._id),
      _id: String(r._id),
      employee: r.employeeInfo || {
        _id: String(r.employee),
        firstName: "Deleted",
        lastName: "employee",
        missing: true,
      },
      creditedDays: String(r.creditedDays ?? 0),
      usedDays: String(r.usedDays ?? 0),
      reservedDays: String(r.reservedDays ?? 0),
      status: r.status || "ACTIVE",
      dateCredited: toInputDate(r.dateCredited),
      original: {
        usedDays: num(r.usedDays),
        reservedDays: num(r.reservedDays),
        remainingDays: num(r.remainingDays),
        dateCredited: toInputDate(r.dateCredited),
      },
      period: r.period || null,
    })),
  };
}

function buildPayload(form, credit, options, reason) {
  const toNumber = (v) => (v === "" ? NaN : Number(v)); // NaN → null in JSON → server error
  const payload = {
    days: toNumber(form.days),
    status: form.status,
    options,
    expectedUpdatedAt: credit.updatedAt,
    employees: form.rows.map((r) => {
      const row = {
        employee: String(r.employee._id),
        creditedDays: toNumber(r.creditedDays),
        usedDays: toNumber(r.usedDays),
        reservedDays: toNumber(r.reservedDays),
        status: r.status,
      };
      if (r._id) row._id = r._id;
      // only send dates the admin changed, so the original time of day is kept
      if (
        r.dateCredited &&
        r.dateCredited !== (r.original?.dateCredited ?? "")
      ) {
        row.dateCredited = r.dateCredited;
      }
      return row;
    }),
  };
  if (form.dateApproved !== toInputDate(credit.dateApproved))
    payload.dateApproved = form.dateApproved;
  if (reason.trim()) payload.reason = reason.trim();
  return payload;
}

/* =====================================================================
   SMALL UI PIECES
===================================================================== */

const inputClass =
  "w-full px-3 py-2 rounded-lg text-sm outline-none border transition-colors duration-200 ease-out focus:border-[color:var(--accent)] disabled:opacity-60 disabled:cursor-not-allowed";

const inputStyle = (borderColor) => ({
  backgroundColor: "var(--app-surface)",
  borderColor,
  color: "var(--app-text)",
});

const Pill = ({ tone = "accent", children, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${className}`}
    style={TONES[tone] || TONES.accent}
  >
    {children}
  </span>
);

const RowStatusPill = ({ status }) =>
  status ? (
    <Pill tone={ROW_STATUS_TONE[status] || "accent"}>
      {STATUS_LABELS[status] || status}
    </Pill>
  ) : null;

const Alert = ({
  tone = "red",
  icon: Icon = AlertTriangle,
  title,
  children,
  className = "",
}) => (
  <div
    className={`rounded-xl border p-3 text-xs leading-relaxed flex items-start gap-2.5 ${className}`}
    style={TONES[tone]}
  >
    <Icon className="w-4 h-4 flex-none mt-0.5" />
    <div className="min-w-0 flex-1">
      {title && <p className="font-bold">{title}</p>}
      {children}
    </div>
  </div>
);

const SectionTitle = ({ icon: Icon, children, right }) => (
  <div className="flex items-center justify-between gap-3 mt-6 mb-3">
    <h3
      className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em]"
      style={{ color: "var(--app-muted)" }}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </h3>
    {right}
  </div>
);

const MiniStat = ({ icon: Icon, label, value, borderColor }) => (
  <div
    className="rounded-lg border p-2 transition-colors duration-300 ease-out"
    style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
  >
    <div
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: "var(--app-muted)" }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />} {label}
    </div>
    <div
      className="mt-1 text-sm font-semibold"
      style={{ color: "var(--app-text)" }}
    >
      {value}
    </div>
  </div>
);

const MAX_VISIBLE_EMPLOYEES = 3;

const EmployeesCell = ({ employees = [], borderColor }) => {
  const [expanded, setExpanded] = useState(false);
  const names = useMemo(
    () =>
      (employees || [])
        .map((e) =>
          `${e.employee?.firstName || ""} ${e.employee?.lastName || ""}`.trim(),
        )
        .filter(Boolean),
    [employees],
  );

  if (names.length === 0) {
    return (
      <span className="text-sm" style={{ color: "var(--app-muted)" }}>
        -
      </span>
    );
  }

  const hiddenCount = names.length - MAX_VISIBLE_EMPLOYEES;
  const visibleNames = expanded ? names : names.slice(0, MAX_VISIBLE_EMPLOYEES);

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <Users size={13} style={{ color: "var(--app-muted)" }} />
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "var(--app-muted)" }}
        >
          {names.length} Employee{names.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visibleNames.map((name, idx) => (
          <span
            key={`${name}-${idx}`}
            title={name}
            className="inline-flex items-center gap-1.5 max-w-[190px] pl-0.5 pr-2.5 py-0.5 rounded-full border text-xs font-medium"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
              color: "var(--app-text)",
            }}
          >
            <span
              className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-none"
              style={{
                backgroundColor: "var(--accent-soft)",
                color: "var(--accent)",
              }}
            >
              {getInitials(name)}
            </span>
            <span className="truncate">{name}</span>
          </span>
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            title={
              expanded
                ? "Show less"
                : names.slice(MAX_VISIBLE_EMPLOYEES).join(", ")
            }
            className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-bold"
            style={TONES.accent}
          >
            {expanded ? "Show less" : `+${hiddenCount} more`}
          </button>
        )}
      </div>
    </div>
  );
};

const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  borderColor,
  noun = "batches",
}) => (
  <div
    className="px-4 md:px-6 py-3 border-t transition-colors duration-300 ease-out"
    style={{ backgroundColor: "var(--app-surface)", borderColor }}
  >
    <div className="flex md:hidden items-center justify-between gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={page === 1 || total === 0}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30"
        style={{
          borderColor,
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text)",
        }}
      >
        <ChevronLeft className="w-4 h-4" />
        Prev
      </button>
      <div className="text-center min-w-0">
        <div
          className="text-xs font-mono font-semibold"
          style={{ color: "var(--app-text)" }}
        >
          {page} / {totalPages}
        </div>
        <div
          className="text-[11px] truncate"
          style={{ color: "var(--app-muted)" }}
        >
          {total === 0 ? "0 results" : `${startItem}-${endItem} of ${total}`}
        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages || total === 0}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30"
        style={{
          borderColor,
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text)",
        }}
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>

    <div className="hidden md:flex items-center justify-between gap-4">
      <div
        className="text-xs font-medium"
        style={{ color: "var(--app-muted)" }}
      >
        Showing{" "}
        <span className="font-bold" style={{ color: "var(--app-text)" }}>
          {total === 0 ? 0 : `${startItem}-${endItem}`}
        </span>{" "}
        of{" "}
        <span className="font-bold" style={{ color: "var(--app-text)" }}>
          {total}
        </span>{" "}
        {noun}
      </div>
      <div
        className="flex items-center gap-1 p-1 rounded-lg border"
        style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="p-1.5 rounded-md disabled:opacity-30"
          style={{ color: "var(--app-muted)" }}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span
          className="text-xs font-mono font-medium px-3"
          style={{ color: "var(--app-muted)" }}
        >
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="p-1.5 rounded-md disabled:opacity-30"
          style={{ color: "var(--app-muted)" }}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

const EmptyState = ({ icon: Icon = Inbox, title, children, borderColor }) => (
  <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
    <div
      className="p-6 rounded-full mb-4 ring-1"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor,
        "--tw-ring-color": borderColor,
      }}
    >
      <Icon className="w-10 h-10" style={{ color: "var(--app-muted)" }} />
    </div>
    <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
      {title}
    </h3>
    {children}
  </div>
);

/** Opens the batch on its own page and remembers this list URL for "Back". */
const EditLink = ({ creditId, canEdit, borderColor, full = false }) => {
  const location = useLocation();
  return (
    <Link
      to={String(creditId)}
      state={{ from: `${location.pathname}${location.search}` }}
      className={`${full ? "w-full justify-center py-2 text-sm" : "py-1.5 text-xs"} inline-flex items-center gap-1.5 px-3 rounded-lg border font-bold shadow-sm transition-all duration-200 ease-out active:scale-95`}
      style={
        full
          ? TONES.accent
          : {
              backgroundColor: "var(--app-surface)",
              borderColor,
              color: "var(--app-text)",
            }
      }
    >
      {canEdit ? <Pencil size={14} /> : <Eye size={14} />}
      {canEdit ? "Edit" : "View"}
    </Link>
  );
};

/* =====================================================================
   EMPLOYEE SEARCH (combobox)
===================================================================== */

const EmployeeSearch = ({
  label,
  placeholder,
  excludeIds = [],
  refDate,
  onSelect,
}) => {
  const { borderColor } = useThemeColors();
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 300);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const listId = useRef(
    `wca-emp-${Math.random().toString(36).slice(2)}`,
  ).current;
  const excluded = new Set(excludeIds.map(String));

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["wellnessAdminEmployeeSearch", q, refDate || ""],
    queryFn: () =>
      searchWellnessAdminEmployees(cleanParams({ q, limit: 10, refDate })),
    enabled: q.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const results = q ? data?.results || [] : [];

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const choose = (emp) => {
    if (!emp || excluded.has(String(emp._id))) return;
    onSelect(emp);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation(); // only close the list
      setOpen(false);
    }
  };

  const showList = open && query.trim().length > 0;

  return (
    <div className="relative" ref={boxRef}>
      {label && (
        <label
          htmlFor={`${listId}-input`}
          className="block text-[10px] font-bold uppercase tracking-wider mb-1.5"
          style={{ color: "var(--app-muted)" }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--app-muted)" }}
        />
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && results[active] ? `${listId}-${active}` : undefined
          }
          placeholder={placeholder || "Search by name, email or position..."}
          value={query}
          maxLength={100}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`${inputClass} pl-9 pr-8`}
          style={inputStyle(borderColor)}
        />
        {isFetching && q ? (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
            style={{ color: "var(--app-muted)" }}
          />
        ) : (
          query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
              style={{ color: "var(--app-muted)" }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-40 max-h-80 overflow-y-auto rounded-lg py-1"
          style={{
            backgroundColor: "var(--app-surface)",
            border: `1px solid ${borderColor}`,
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
          }}
        >
          {isError && (
            <li className="px-4 py-3 text-xs" style={{ color: "#ef4444" }}>
              {error?.message || "Search failed."}
            </li>
          )}
          {!isError && q && !isFetching && results.length === 0 && (
            <li
              className="px-4 py-3 text-xs"
              style={{ color: "var(--app-muted)" }}
            >
              No employees match “{q}”.
            </li>
          )}
          {!isError && !q && (
            <li
              className="px-4 py-3 text-xs"
              style={{ color: "var(--app-muted)" }}
            >
              Keep typing…
            </li>
          )}
          {results.map((emp, i) => {
            const disabled = excluded.has(String(emp._id));
            const p = emp.period;
            const isActive = i === active;
            return (
              <li
                key={emp._id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isActive}
                aria-disabled={disabled}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(emp);
                }}
                className={`px-3 py-2 mx-1 rounded-md flex items-center justify-between gap-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                style={{
                  backgroundColor:
                    isActive && !disabled
                      ? "var(--accent-soft)"
                      : "transparent",
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-none"
                    style={{
                      backgroundColor: "var(--accent-soft)",
                      color: "var(--accent)",
                    }}
                  >
                    {getInitials(fullName(emp))}
                  </span>
                  <div className="min-w-0">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--app-text)" }}
                    >
                      {fullName(emp)}
                    </div>
                    <div
                      className="text-[11px] truncate"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {[emp.position, emp.employeeType, emp.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end flex-none text-right">
                  {disabled ? (
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Already added
                    </span>
                  ) : (
                    <>
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: "var(--app-text)" }}
                      >
                        Bal {fmtNum(emp.wellnessBalance)}
                      </span>
                      {p && (
                        <span
                          className="text-[10px] font-medium"
                          style={{
                            color:
                              p.available <= 0 ? "#d97706" : "var(--app-muted)",
                          }}
                        >
                          {fmtNum(p.credited)}/{p.limit} in {p.label}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/* =====================================================================
   VIEW 1 — CREDIT BATCHES
===================================================================== */

const getStatusTabs = (counts = {}) => [
  {
    id: "",
    label: "All Batches",
    icon: Layers,
    count: counts.ALL || 0,
    activeStyle: TONES.accent,
  },
  {
    id: "CREDITED",
    label: "Credited",
    icon: CheckCircle2,
    count: counts.CREDITED || 0,
    activeStyle: {
      backgroundColor: "rgba(34,197,94,0.14)",
      color: "#16a34a",
      borderColor: "rgba(34,197,94,0.25)",
    },
  },
  {
    id: "ROLLEDBACK",
    label: "Rolled Back",
    icon: RotateCcw,
    count: counts.ROLLEDBACK || 0,
    activeStyle: {
      backgroundColor: "rgba(239,68,68,0.14)",
      color: "#ef4444",
      borderColor: "rgba(239,68,68,0.25)",
    },
  },
  {
    id: "EXPIRED",
    label: "Expired",
    icon: CalendarX2,
    count: counts.EXPIRED || 0,
    activeStyle: {
      backgroundColor: "rgba(245,158,11,0.14)",
      color: "#d97706",
      borderColor: "rgba(245,158,11,0.30)",
    },
  },
];

const getStatusStripClass = (status) => {
  switch (status) {
    case "CREDITED":
      return "border-l-4 border-l-emerald-500";
    case "ROLLEDBACK":
      return "border-l-4 border-l-rose-500";
    case "EXPIRED":
      return "border-l-4 border-l-amber-500";
    default:
      return "border-l-4 border-l-slate-300";
  }
};

const CreditBatchesView = ({ canEdit }) => {
  const { borderColor } = useThemeColors();
  const [params, updateParams] = useUrlState();

  // Filters are read from the URL; every change resets to page 1.
  const statusFilter = params.get("status") || "";
  const searchFilter = params.get("q") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const page = positiveInt(params.get("page"), 1);
  const limitParam = positiveInt(params.get("limit"), 20);
  const limit = pageSizeOptions.includes(limitParam) ? limitParam : 20;

  const setStatusFilter = (value) =>
    updateParams({ status: value, page: undefined });
  const setFrom = (value) => updateParams({ from: value, page: undefined });
  const setTo = (value) => updateParams({ to: value, page: undefined });
  const setLimit = (value) =>
    updateParams({
      limit: Number(value) === 20 ? undefined : value,
      page: undefined,
    });
  const setPage = (value) =>
    updateParams({ page: value > 1 ? value : undefined });

  // The search box updates the URL after a short pause.
  const [searchInput, setSearchInput] = useState(searchFilter);
  const debouncedSearch = useDebounced(searchInput.trim(), 500);
  useEffect(() => {
    if (debouncedSearch !== searchFilter)
      updateParams({ q: debouncedSearch, page: undefined });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isFetching, isError, error, isPlaceholderData } =
    useQuery({
      queryKey: [
        "wellnessAdminCredits",
        { page, limit, statusFilter, searchFilter, from, to },
      ],
      queryFn: () =>
        fetchWellnessAdminCredits(
          cleanParams({
            page,
            limit,
            status: statusFilter,
            search: searchFilter,
            from,
            to,
          }),
        ),
      placeholderData: (prev) => prev,
    });

  const credits = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(page * limit, total);

  // e.g. after filtering, page 5 may no longer exist
  useEffect(() => {
    if (data && !isPlaceholderData && page > totalPages) setPage(totalPages);
  }, [data, isPlaceholderData, page, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltered = Boolean(statusFilter || searchFilter || from || to);
  const resetFilters = () => {
    setSearchInput("");
    updateParams({
      status: undefined,
      q: undefined,
      from: undefined,
      to: undefined,
      page: undefined,
    });
  };

  return (
    <div
      className="flex flex-col rounded-xl shadow-sm overflow-visible md:flex-1 md:min-h-0 md:overflow-hidden"
      style={{
        backgroundColor: "var(--app-surface)",
        border: `1px solid ${borderColor}`,
      }}
    >
      {/* Filters */}
      <div
        className="p-4 border-b space-y-4"
        style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
      >
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {getStatusTabs(data?.statusCounts).map((tab) => {
            const isActive = statusFilter === tab.id;
            const Icon = tab.icon;
            return (
              <button
                type="button"
                key={tab.id || "all"}
                onClick={() => setStatusFilter(tab.id)}
                className="px-4 py-1.5 text-xs font-bold rounded-full border transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-2"
                style={
                  isActive
                    ? tab.activeStyle
                    : {
                        backgroundColor: "var(--app-surface)",
                        color: "var(--app-muted)",
                        borderColor,
                      }
                }
                aria-pressed={isActive}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: isActive
                      ? "rgba(255,255,255,0.65)"
                      : "var(--app-surface-2)",
                    color: isActive ? "#0f172a" : "var(--app-muted)",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--app-muted)" }}
            />
            <input
              type="text"
              placeholder="Search employee name, email, position or batch ID..."
              value={searchInput}
              maxLength={100}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`${inputClass} pl-9 pr-8`}
              style={inputStyle(borderColor)}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                style={{ color: "var(--app-muted)" }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:flex lg:items-end">
            <label className="block">
              <span
                className="block text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: "var(--app-muted)" }}
              >
                Approved from
              </span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={inputClass}
                style={inputStyle(borderColor)}
              />
            </label>
            <label className="block">
              <span
                className="block text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: "var(--app-muted)" }}
              >
                Approved to
              </span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={inputClass}
                style={inputStyle(borderColor)}
              />
            </label>
          </div>

          <div
            className="hidden lg:flex items-center gap-2 pl-3 border-l h-[38px]"
            style={{ borderColor }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--app-muted)" }}
            >
              Show
            </span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border text-xs rounded-lg block p-1.5 font-medium outline-none cursor-pointer"
              style={inputStyle(borderColor)}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:hidden flex items-center gap-1.5">
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--app-muted)" }}
            >
              shows
            </span>
            <FilterSelect
              label=""
              value={limit}
              onChange={(v) => setLimit(Number(v))}
              options={pageSizeOptions}
              className="!mb-0 w-20 text-xs"
            />
          </div>
        </div>

        {isFiltered && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[10px] font-bold uppercase"
                style={{ color: "var(--app-muted)" }}
              >
                Active:
              </span>
              {searchFilter && <Pill>“{searchFilter}”</Pill>}
              {statusFilter && <Pill>{STATUS_LABELS[statusFilter]}</Pill>}
              {(from || to) && (
                <Pill>
                  {from ? formatDate(from) : "…"} – {to ? formatDate(to) : "…"}
                </Pill>
              )}
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 text-[10px] font-bold uppercase"
              style={{ color: "var(--accent)" }}
            >
              <RotateCcw size={10} /> Reset
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div
        className={`min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-auto cto-scrollbar transition-opacity ${isFetching && !isLoading ? "opacity-70" : ""}`}
        style={{ backgroundColor: "var(--app-bg)" }}
      >
        {isError ? (
          <div className="p-4">
            <Alert title="Couldn't load credit batches">{error?.message}</Alert>
          </div>
        ) : !isLoading && credits.length === 0 ? (
          <EmptyState title="No Credit Batches Found" borderColor={borderColor}>
            {isFiltered && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 text-sm font-bold underline"
                style={{ color: "var(--accent)" }}
              >
                Clear all filters
              </button>
            )}
          </EmptyState>
        ) : (
          <>
            {/* Mobile / tablet cards */}
            <div className="block lg:hidden p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {isLoading
                  ? [...Array(4)].map((_, i) => (
                      <div
                        key={`sk-${i}`}
                        className="rounded-xl shadow-sm p-4 border"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                        }}
                      >
                        <Skeleton height={18} />
                        <div className="mt-3">
                          <Skeleton height={12} count={2} />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Skeleton height={52} />
                          <Skeleton height={52} />
                        </div>
                      </div>
                    ))
                  : credits.map((credit) => (
                      <div
                        key={credit._id}
                        className={`rounded-xl shadow-sm overflow-hidden border-y border-r ${getStatusStripClass(credit.status)}`}
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                        }}
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span
                                className="text-[10px] font-mono"
                                style={{ color: "var(--app-muted)" }}
                              >
                                #{shortId(credit._id)}
                              </span>
                              <div className="mt-1 flex items-start gap-2">
                                <Users
                                  className="w-4 h-4 mt-[2px] flex-none"
                                  style={{ color: "var(--app-muted)" }}
                                />
                                <div
                                  className="text-xs leading-snug line-clamp-2"
                                  style={{ color: "var(--app-text)" }}
                                >
                                  {(credit.employees || [])
                                    .map((r) =>
                                      `${r.employee?.firstName || ""} ${r.employee?.lastName || ""}`.trim(),
                                    )
                                    .filter(Boolean)
                                    .join(", ") || "-"}
                                </div>
                              </div>
                            </div>
                            <StatusBadge status={credit.status} />
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <MiniStat
                              icon={CalendarDays}
                              label="Days"
                              value={formatDays(credit.days)}
                              borderColor={borderColor}
                            />
                            <MiniStat
                              icon={Calendar}
                              label="Approved"
                              value={formatDate(credit.dateApproved)}
                              borderColor={borderColor}
                            />
                            <MiniStat
                              label="Used / Reserved"
                              value={`${fmtNum(credit.summary?.usedDays)} / ${fmtNum(credit.summary?.reservedDays)}`}
                              borderColor={borderColor}
                            />
                            <MiniStat
                              label="Remaining"
                              value={fmtNum(credit.summary?.remainingDays)}
                              borderColor={borderColor}
                            />
                          </div>
                        </div>
                        <div className="border-t p-3" style={{ borderColor }}>
                          <EditLink
                            full
                            canEdit={canEdit}
                            borderColor={borderColor}
                            creditId={credit._id}
                          />
                        </div>
                      </div>
                    ))}
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block w-full align-middle">
              <table className="w-full min-w-[900px] text-left table-fixed">
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "12%" }} />
                </colgroup>
                <thead
                  className="sticky top-0 z-10 border-b"
                  style={{ backgroundColor: "var(--app-surface)", borderColor }}
                >
                  <tr
                    className="text-[10px] uppercase tracking-[0.12em] font-bold"
                    style={{ color: "var(--app-muted)" }}
                  >
                    <th className="px-6 py-4">Employees</th>
                    <th className="px-4 py-4">Batch</th>
                    <th className="px-4 py-4 text-center">Days</th>
                    <th className="px-4 py-4 text-center">
                      Used · Reserved · Left
                    </th>
                    <th className="px-4 py-4 text-center">Date Approved</th>
                    <th className="px-4 py-4 text-center">Status</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? [...Array(Math.min(limit, 8))].map((_, i) => (
                        <tr key={i}>
                          {[...Array(7)].map((__, j) => (
                            <td key={j} className="px-6 py-4">
                              <Skeleton />
                            </td>
                          ))}
                        </tr>
                      ))
                    : credits.map((credit, i) => {
                        const bg =
                          i % 2 === 0
                            ? "var(--app-surface)"
                            : "var(--app-surface-2)";
                        return (
                          <tr
                            key={credit._id}
                            className="transition-colors duration-200 ease-out border-b"
                            style={{ backgroundColor: bg, borderColor }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "var(--accent-soft)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = bg)
                            }
                          >
                            <td className="px-6 py-4 align-middle">
                              <EmployeesCell
                                employees={credit.employees}
                                borderColor={borderColor}
                              />
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <div className="flex flex-col min-w-0">
                                <span
                                  className="font-mono text-xs font-semibold"
                                  style={{ color: "var(--app-text)" }}
                                >
                                  #{shortId(credit._id)}
                                </span>
                                <span
                                  className="text-[11px] truncate mt-0.5"
                                  style={{ color: "var(--app-muted)" }}
                                >
                                  by{" "}
                                  {credit.creditedBy
                                    ? fullName(credit.creditedBy)
                                    : "-"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center align-middle whitespace-nowrap">
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-xs font-bold"
                                style={{
                                  backgroundColor: "var(--app-surface)",
                                  borderColor,
                                  color: "var(--app-text)",
                                }}
                              >
                                <CalendarDays
                                  size={12}
                                  style={{ color: "var(--app-muted)" }}
                                />
                                {formatDays(credit.days)}
                              </span>
                            </td>
                            <td
                              className="px-4 py-4 text-center align-middle whitespace-nowrap text-sm font-mono"
                              style={{ color: "var(--app-text)" }}
                            >
                              {fmtNum(credit.summary?.usedDays)}
                              <span style={{ color: "var(--app-muted)" }}>
                                {" "}
                                ·{" "}
                              </span>
                              {fmtNum(credit.summary?.reservedDays)}
                              <span style={{ color: "var(--app-muted)" }}>
                                {" "}
                                ·{" "}
                              </span>
                              <span className="font-bold">
                                {fmtNum(credit.summary?.remainingDays)}
                              </span>
                            </td>
                            <td
                              className="px-4 py-4 text-center align-middle whitespace-nowrap text-sm"
                              style={{ color: "var(--app-muted)" }}
                            >
                              {formatDate(credit.dateApproved)}
                            </td>
                            <td className="px-4 py-4 text-center align-middle whitespace-nowrap">
                              <StatusBadge status={credit.status} />
                            </td>
                            <td className="px-4 py-4 text-right align-middle whitespace-nowrap">
                              <EditLink
                                canEdit={canEdit}
                                borderColor={borderColor}
                                creditId={credit._id}
                              />
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <CompactPagination
        page={page}
        totalPages={totalPages}
        total={total}
        startItem={startItem}
        endItem={endItem}
        onPrev={() => setPage(Math.max(page - 1, 1))}
        onNext={() => setPage(Math.min(page + 1, totalPages))}
        borderColor={borderColor}
      />
    </div>
  );
};

/* =====================================================================
   VIEW 2 — EMPLOYEE LOOKUP
===================================================================== */

const BalanceTile = ({ label, value, sub, tone, borderColor, children }) => (
  <div
    className="rounded-xl border p-4 flex flex-col gap-1"
    style={
      tone
        ? TONES[tone]
        : { backgroundColor: "var(--app-surface-2)", borderColor }
    }
  >
    <span
      className="text-[10px] font-bold uppercase tracking-wider"
      style={{ color: tone ? undefined : "var(--app-muted)" }}
    >
      {label}
    </span>
    <span
      className="text-2xl font-bold tracking-tight"
      style={{ color: tone ? undefined : "var(--app-text)" }}
    >
      {value}
    </span>
    {sub && (
      <span
        className="text-[11px]"
        style={{
          color: tone ? undefined : "var(--app-muted)",
          opacity: tone ? 0.85 : 1,
        }}
      >
        {sub}
      </span>
    )}
    {children}
  </div>
);

const EmployeeLookupView = ({ canEdit }) => {
  const queryClient = useQueryClient();
  const { borderColor } = useThemeColors();
  const [params, updateParams] = useUrlState();

  // The selected employee is kept in the URL (?employee=<id>) so "Back" from
  // the edit page returns to them. `picked` just shows their name instantly.
  const employeeId = params.get("employee") || null;
  const page = positiveInt(params.get("epage"), 1);
  const setPage = (value) =>
    updateParams({ epage: value > 1 ? value : undefined });
  const [picked, setPicked] = useState(null);
  const [confirmRecalc, setConfirmRecalc] = useState(false);
  const limit = 10;

  const balanceQ = useQuery({
    queryKey: ["wellnessAdminEmployeeBalance", employeeId],
    queryFn: () => fetchWellnessAdminEmployeeBalance(employeeId),
    enabled: !!employeeId,
  });

  const creditsQ = useQuery({
    queryKey: [
      "wellnessAdminCredits",
      { employeeId, page, limit, sort: "-dateApproved" },
    ],
    queryFn: () =>
      fetchWellnessAdminCredits({
        employeeId,
        page,
        limit,
        sort: "-dateApproved",
      }),
    enabled: !!employeeId,
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey?.[1]?.employeeId === employeeId ? prev : undefined,
  });

  const recalcMutation = useMutation({
    mutationFn: () => recalculateWellnessAdminEmployeeBalance(employeeId),
    onSuccess: (res) => {
      toast.success(res?.message || "Balance recalculated.");
      if (res?.check)
        queryClient.setQueryData(
          ["wellnessAdminEmployeeBalance", employeeId],
          res.check,
        );
      queryClient.invalidateQueries({ queryKey: ["allWellnessCredits"] });
      setConfirmRecalc(false);
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to recalculate balance.");
      setConfirmRecalc(false);
    },
  });

  const pick = (emp) => {
    setPicked(emp);
    setConfirmRecalc(false);
    updateParams({
      employee: emp?._id ? String(emp._id) : undefined,
      epage: undefined,
    });
  };

  const c = balanceQ.data;
  const who =
    c?.employee ||
    (picked && String(picked._id) === employeeId ? picked : null);
  const items = creditsQ.data?.items || [];
  const total = creditsQ.data?.total || 0;
  const totalPages = creditsQ.data?.totalPages || 1;

  return (
    <div
      className="flex flex-col rounded-xl shadow-sm overflow-visible md:flex-1 md:min-h-0 md:overflow-hidden"
      style={{
        backgroundColor: "var(--app-surface)",
        border: `1px solid ${borderColor}`,
      }}
    >
      <div
        className="p-4 border-b relative z-20"
        style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
      >
        <EmployeeSearch
          label="Find an employee"
          placeholder="Type a name, email or position..."
          onSelect={pick}
        />
      </div>

      <div
        className="min-h-[calc(100dvh-24rem)] md:flex-1 md:overflow-y-auto cto-scrollbar"
        style={{ backgroundColor: "var(--app-bg)" }}
      >
        {!employeeId ? (
          <EmptyState
            icon={UserSearch}
            title="Look up an employee"
            borderColor={borderColor}
          >
            <p
              className="text-sm mt-1 max-w-md"
              style={{ color: "var(--app-muted)" }}
            >
              See their stored balance next to what their credits add up to, fix
              it if they don't match, and open any batch they're in.
            </p>
          </EmptyState>
        ) : (
          <div className="p-4 md:p-6 space-y-5">
            {/* Employee header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold flex-none"
                  style={{
                    backgroundColor: "var(--accent-soft)",
                    color: "var(--accent)",
                  }}
                >
                  {who ? getInitials(fullName(who)) : ""}
                </span>
                <div className="min-w-0">
                  {who ? (
                    <>
                      <h2
                        className="text-lg font-bold truncate"
                        style={{ color: "var(--app-text)" }}
                      >
                        {fullName(who)}
                      </h2>
                      <p
                        className="text-xs truncate"
                        style={{ color: "var(--app-muted)" }}
                      >
                        {[who.position, who.employeeType, who.email]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </>
                  ) : (
                    <>
                      <Skeleton width={180} height={20} />
                      <Skeleton width={240} height={12} />
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => pick(null)}
                className="flex items-center gap-1 text-[10px] font-bold uppercase flex-none"
                style={{ color: "var(--accent)" }}
              >
                <X size={12} /> Clear
              </button>
            </div>

            {/* Balance tiles */}
            {balanceQ.isError && (
              <Alert title="Couldn't load balance">
                {balanceQ.error?.message}
              </Alert>
            )}
            {balanceQ.isLoading && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} height={96} borderRadius={12} />
                ))}
              </div>
            )}
            {c && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <BalanceTile
                    label="Stored balance"
                    value={fmtNum(c.storedBalance)}
                    sub="On the employee record"
                    borderColor={borderColor}
                  />
                  <BalanceTile
                    label="From credits"
                    value={fmtNum(c.computedBalance)}
                    sub={`Remaining across ${c.ledger?.batches || 0} batch(es)`}
                    borderColor={borderColor}
                  />
                  <BalanceTile
                    label="Difference"
                    value={c.inSync ? "In sync" : signed(c.difference)}
                    tone={c.inSync ? "green" : "amber"}
                    borderColor={borderColor}
                  >
                    {!c.inSync && canEdit && !confirmRecalc && (
                      <button
                        type="button"
                        onClick={() => setConfirmRecalc(true)}
                        className="mt-1 self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor: "currentColor",
                        }}
                      >
                        <RefreshCw size={12} /> Recalculate
                      </button>
                    )}
                  </BalanceTile>
                  <BalanceTile
                    label={`Credited in ${c.period?.label || ""}`}
                    value={
                      <>
                        {fmtNum(c.period?.credited)}
                        <span
                          className="text-sm font-semibold"
                          style={{ color: "var(--app-muted)" }}
                        >
                          {" "}
                          / {c.period?.limit}
                        </span>
                      </>
                    }
                    sub={
                      c.period?.isJobOrder
                        ? "Job Order · limit per half-year"
                        : "Limit per year"
                    }
                    borderColor={borderColor}
                  />
                </div>

                {confirmRecalc && (
                  <Alert
                    tone="amber"
                    icon={Scale}
                    title="Recalculate this balance?"
                  >
                    <p>
                      This sets {fullName(who)}'s stored balance from{" "}
                      <b>{fmtNum(c.storedBalance)}</b> to{" "}
                      <b>{fmtNum(c.computedBalance)}</b> — the total remaining
                      days on their credits.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={recalcMutation.isPending}
                        onClick={() => recalcMutation.mutate()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-60"
                        style={{ backgroundColor: "#d97706" }}
                      >
                        {recalcMutation.isPending ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        {recalcMutation.isPending
                          ? "Recalculating..."
                          : "Yes, recalculate"}
                      </button>
                      <button
                        type="button"
                        disabled={recalcMutation.isPending}
                        onClick={() => setConfirmRecalc(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                          color: "var(--app-text)",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </Alert>
                )}

                <p
                  className="text-[11px]"
                  style={{ color: "var(--app-muted)" }}
                >
                  All credits: {fmtNum(c.ledger?.creditedDays)} credited ·{" "}
                  {fmtNum(c.ledger?.usedDays)} used ·{" "}
                  {fmtNum(c.ledger?.reservedDays)} reserved ·{" "}
                  {fmtNum(c.ledger?.remainingDays)} remaining
                </p>
              </>
            )}

            {/* Their batches */}
            <div>
              <SectionTitle icon={Layers}>Credit batches</SectionTitle>
              {creditsQ.isError && (
                <Alert title="Couldn't load batches">
                  {creditsQ.error?.message}
                </Alert>
              )}
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor, backgroundColor: "var(--app-surface)" }}
              >
                {creditsQ.isLoading ? (
                  <div className="p-4">
                    <Skeleton height={40} count={3} className="mb-2" />
                  </div>
                ) : items.length === 0 ? (
                  <p
                    className="p-6 text-center text-sm"
                    style={{ color: "var(--app-muted)" }}
                  >
                    This employee has no wellness credit batches.
                  </p>
                ) : (
                  <div className="divide-y" style={{ borderColor }}>
                    {items.map((item) => {
                      const row = (item.employees || []).find(
                        (r) =>
                          String(r.employee?._id ?? r.employee) === employeeId,
                      );
                      return (
                        <div
                          key={item._id}
                          className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 border-b last:border-b-0"
                          style={{ borderColor }}
                        >
                          <div className="flex items-center gap-3 md:w-56 flex-none">
                            <div className="min-w-0">
                              <div
                                className="text-sm font-semibold"
                                style={{ color: "var(--app-text)" }}
                              >
                                {formatDate(item.dateApproved)}
                              </div>
                              <div
                                className="text-[10px] font-mono"
                                style={{ color: "var(--app-muted)" }}
                              >
                                #{shortId(item._id)}
                              </div>
                            </div>
                            <StatusBadge status={item.status} />
                          </div>
                          <div className="grid grid-cols-4 gap-2 flex-1 text-center">
                            {[
                              ["Credited", row?.creditedDays],
                              ["Used", row?.usedDays],
                              ["Reserved", row?.reservedDays],
                              ["Remaining", row?.remainingDays],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <div
                                  className="text-[10px] font-bold uppercase tracking-wide"
                                  style={{ color: "var(--app-muted)" }}
                                >
                                  {label}
                                </div>
                                <div
                                  className="text-sm font-semibold font-mono"
                                  style={{ color: "var(--app-text)" }}
                                >
                                  {fmtNum(value)}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between md:justify-end gap-3 md:w-48 flex-none">
                            <RowStatusPill status={row?.status} />
                            <EditLink
                              canEdit={canEdit}
                              borderColor={borderColor}
                              creditId={item._id}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {totalPages > 1 && (
                  <CompactPagination
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    startItem={(page - 1) * limit + 1}
                    endItem={Math.min(page * limit, total)}
                    onPrev={() => setPage(Math.max(page - 1, 1))}
                    onNext={() => setPage(Math.min(page + 1, totalPages))}
                    borderColor={borderColor}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* =====================================================================
   EDITOR — review panel
===================================================================== */

const ChangeList = ({ changes }) => (
  <ul className="space-y-1">
    {changes.map((c) => (
      <li key={c.field} className="grid grid-cols-[110px_1fr] gap-2 text-xs">
        <span style={{ color: "var(--app-muted)" }}>
          {FIELD_LABELS[c.field] || c.field}
        </span>
        <span style={{ color: "var(--app-text)" }}>
          <span style={{ color: "var(--app-muted)" }}>
            {formatValue(c.field, c.from)}
          </span>
          <span className="mx-1.5">→</span>
          <span className="font-bold">{formatValue(c.field, c.to)}</span>
        </span>
      </li>
    ))}
  </ul>
);

const PlanReview = ({ plan, borderColor }) => {
  const changedRows = (plan.rows || []).filter((r) => r.action !== "unchanged");

  return (
    <div
      className="rounded-xl border p-4 space-y-4"
      style={{ borderColor, backgroundColor: "var(--app-surface-2)" }}
      aria-live="polite"
    >
      <h4
        className="flex items-center gap-2 text-sm font-bold"
        style={{ color: "var(--app-text)" }}
      >
        <ClipboardCheck
          className="w-4 h-4"
          style={{ color: "var(--accent)" }}
        />
        Review
        {plan.valid && plan.hasChanges && (
          <Pill tone="green">Ready to save</Pill>
        )}
        {!plan.valid && <Pill tone="red">Needs fixes</Pill>}
      </h4>

      {plan.errors?.length > 0 && (
        <Alert tone="red" title="Fix these before saving:">
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            {plan.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}

      {plan.warnings?.length > 0 && (
        <Alert tone="amber" icon={Info}>
          <ul className="list-disc pl-4 space-y-0.5">
            {plan.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      {plan.valid && !plan.hasChanges && (
        <p className="text-sm" style={{ color: "var(--app-muted)" }}>
          No changes to save.
        </p>
      )}

      {(plan.header?.changes?.length > 0 || changedRows.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {plan.header?.changes?.length > 0 && (
            <div
              className="rounded-lg border p-3"
              style={{ borderColor, backgroundColor: "var(--app-surface)" }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-wider mb-2"
                style={{ color: "var(--app-muted)" }}
              >
                Batch
              </p>
              <ChangeList changes={plan.header.changes} />
            </div>
          )}
          {changedRows.map((r) => (
            <div
              key={`${r.action}-${r.rowId || r.employee._id}`}
              className="rounded-lg border p-3"
              style={{ borderColor, backgroundColor: "var(--app-surface)" }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--app-text)" }}
                >
                  {r.employee.name}
                </span>
                <Pill tone={ACTION_META[r.action]?.tone}>
                  {ACTION_META[r.action]?.label}
                </Pill>
              </div>
              {r.action === "added" && (
                <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                  {fmtNum(r.after.creditedDays)} credited ·{" "}
                  {fmtNum(r.after.remainingDays)} remaining ·{" "}
                  {STATUS_LABELS[r.after.status]}
                </p>
              )}
              {r.action === "removed" && (
                <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                  Removed from the batch (had {fmtNum(r.before.remainingDays)}{" "}
                  remaining).
                </p>
              )}
              {r.action === "updated" && <ChangeList changes={r.changes} />}
            </div>
          ))}
        </div>
      )}

      {plan.balances?.length > 0 && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor, backgroundColor: "var(--app-surface)" }}
        >
          <p
            className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5"
            style={{ color: "var(--app-muted)", borderColor }}
          >
            <Scale size={12} /> Balance impact
            {plan.options?.adjustBalances ? "" : " (not applied)"}
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--app-muted)" }}>
                <th className="text-left px-3 py-2 font-semibold">Employee</th>
                <th className="text-right px-3 py-2 font-semibold">Now</th>
                <th className="text-right px-3 py-2 font-semibold">Change</th>
                <th className="text-right px-3 py-2 font-semibold">After</th>
              </tr>
            </thead>
            <tbody>
              {plan.balances.map((b) => (
                <tr
                  key={b.employee._id}
                  className="border-t"
                  style={{ borderColor }}
                >
                  <td
                    className="px-3 py-2"
                    style={{ color: "var(--app-text)" }}
                  >
                    {b.employee.name}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-mono"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {fmtNum(b.current)}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-mono font-bold"
                    style={{ color: b.delta < 0 ? "#ef4444" : "#16a34a" }}
                  >
                    {signed(b.delta)}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-mono font-bold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {fmtNum(b.after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* =====================================================================
   EDITOR — option toggle
===================================================================== */

const OptionToggle = ({
  checked,
  onChange,
  label,
  hint,
  tone,
  borderColor,
  disabled,
}) => (
  <label
    className={`flex items-start gap-3 rounded-xl border p-3 transition-colors duration-200 ease-out ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    style={
      checked && tone
        ? TONES[tone]
        : { borderColor, backgroundColor: "var(--app-surface)" }
    }
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-4 w-4 flex-none accent-[color:var(--accent)]"
    />
    <span className="min-w-0">
      <span
        className="block text-sm font-semibold"
        style={{ color: checked && tone ? undefined : "var(--app-text)" }}
      >
        {label}
      </span>
      <span
        className="block text-[11px] mt-0.5"
        style={{ color: checked && tone ? undefined : "var(--app-muted)" }}
      >
        {hint}
      </span>
    </span>
  </label>
);

/* =====================================================================
   EDITOR — main
===================================================================== */

const fieldLabelClass =
  "block text-[10px] font-bold uppercase tracking-wider mb-1.5";

const CreditEditor = ({
  creditId,
  canEdit,
  onDirtyChange,
  onBusyChange,
  onBack,
}) => {
  const queryClient = useQueryClient();
  const { borderColor } = useThemeColors();

  const creditQ = useQuery({
    queryKey: ["wellnessAdminCredit", creditId],
    queryFn: () => fetchWellnessAdminCreditById(creditId),
    refetchOnWindowFocus: false,
    gcTime: 0,
    // a bad or deleted batch id won't fix itself — show the error right away
    retry: (failureCount, err) =>
      ![400, 403, 404].includes(err?.status) && failureCount < 2,
  });
  const credit = creditQ.data?.credit || null;

  const [form, setForm] = useState(null);
  const [initialForm, setInitialForm] = useState("");
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState(null);
  const [problem, setProblem] = useState(null);
  const [statusNote, setStatusNote] = useState("");

  // (Re)initialise the form whenever a new version of the batch arrives.
  const version = credit ? `${credit._id}:${credit.updatedAt}` : "";
  useEffect(() => {
    if (!credit) return;
    const f = toForm(credit);
    setForm(f);
    setInitialForm(JSON.stringify(f));
    setOptions(DEFAULT_OPTIONS);
    setReason("");
    setPlan(null);
    setProblem(null);
    setStatusNote("");
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = !!form && JSON.stringify(form) !== initialForm;
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  const previewMutation = useMutation({
    mutationFn: (payload) =>
      previewWellnessAdminCreditUpdate(creditId, payload),
    onSuccess: (res) => setPlan(res?.plan || null),
    onError: (err) =>
      setProblem({
        message: err?.message || "Review failed.",
        details: errDetails(err),
      }),
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => updateWellnessAdminCredit(creditId, payload),
    retry: 0,
    onSuccess: (res) => {
      toast.success(
        res?.changed ? "Wellness credit updated." : "No changes to save.",
      );
      if (res?.credit)
        queryClient.setQueryData(["wellnessAdminCredit", creditId], {
          credit: res.credit,
        });
      [
        "wellnessAdminCredits",
        "wellnessAdminEmployeeBalance",
        "allWellnessCredits",
      ].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: (err) => {
      setPlan(null);
      setProblem({
        message: err?.message || "Save failed.",
        details: errDetails(err),
        conflict: err?.status === 409,
      });
      toast.error(err?.message || "Failed to save changes.");
    },
  });

  const busy = previewMutation.isPending || saveMutation.isPending;
  useEffect(
    () => onBusyChange?.(saveMutation.isPending),
    [saveMutation.isPending, onBusyChange],
  );

  /* ----- form changes (each one makes the last review stale) ----- */
  const edit = (updater) => {
    setForm(updater);
    setPlan(null);
    setProblem(null);
  };
  const setOption = (key, value) => {
    setOptions((o) => ({ ...o, [key]: value }));
    setPlan(null);
    setProblem(null);
  };
  const setHeader = (field, value) => edit((f) => ({ ...f, [field]: value }));
  const setRow = (key, field, value) =>
    edit((f) => ({
      ...f,
      rows: f.rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    }));
  const removeRow = (key) =>
    edit((f) => ({ ...f, rows: f.rows.filter((r) => r.key !== key) }));
  const applyDaysToAll = () =>
    edit((f) => ({
      ...f,
      rows: f.rows.map((r) => ({ ...r, creditedDays: f.days })),
    }));
  const resetForm = () => {
    edit(() => JSON.parse(initialForm));
    setStatusNote("");
  };

  const changeBatchStatus = (value) => {
    let rows = form.rows;
    let note = "";
    if (form.status === "ROLLEDBACK" && value !== "ROLLEDBACK") {
      rows = rows.map((r) =>
        r.status === "ROLLEDBACK" ? { ...r, status: "ACTIVE" } : r,
      );
      note =
        "Rolled-back employees were switched back to Active. Change any you want to keep rolled back.";
    }
    if (form.status === "EXPIRED" && value === "CREDITED") {
      rows = rows.map((r) =>
        r.status === "EXPIRED" ? { ...r, status: "ACTIVE" } : r,
      );
      note =
        "Expired employees were switched back to Active, so their unused days come back.";
    }
    if (value === "EXPIRED")
      note = "Unused days will be forfeited and removed from balances.";
    if (value === "ROLLEDBACK")
      note =
        "Every employee will be rolled back and their remaining days removed.";
    setStatusNote(note);
    edit((f) => ({ ...f, status: value, rows }));
  };

  const addEmployee = (emp) =>
    edit((f) => ({
      ...f,
      rows: [
        ...f.rows,
        {
          key: `new-${emp._id}`,
          _id: null,
          employee: emp,
          creditedDays: f.days || "1",
          usedDays: "0",
          reservedDays: "0",
          status: "ACTIVE",
          dateCredited: "",
          original: null,
          period: emp.period || null,
        },
      ],
    }));

  const runReview = () => {
    setProblem(null);
    previewMutation.mutate(buildPayload(form, credit, options, reason));
  };
  const save = () => {
    if (!plan?.valid || !plan?.hasChanges) return;
    saveMutation.mutate(buildPayload(form, credit, options, reason));
  };

  /* ----- loading / error ----- */
  if (creditQ.isLoading || (!form && !creditQ.isError)) {
    return (
      <div className="p-2 space-y-3">
        <Skeleton height={14} width="40%" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </div>
        <Skeleton height={44} count={3} className="mb-2" />
      </div>
    );
  }
  if (creditQ.isError) {
    return (
      <div className="p-2">
        <Alert title="Couldn't load this credit batch">
          <p>{creditQ.error?.message}</p>
          <div className="mt-2 flex gap-4">
            <button
              type="button"
              className="underline font-bold"
              onClick={() => creditQ.refetch()}
            >
              Try again
            </button>
            {onBack && (
              <button
                type="button"
                className="underline font-bold"
                onClick={onBack}
              >
                Back to the list
              </button>
            )}
          </div>
        </Alert>
      </div>
    );
  }

  const rowEmployeeIds = form.rows.map((r) => String(r.employee._id));
  const history = credit.editHistory || [];
  const numberInputClass =
    "w-full lg:w-20 px-2 py-1.5 rounded-lg text-sm text-right font-mono outline-none border focus:border-[color:var(--accent)] disabled:opacity-60";

  const rowView = (row) => {
    const resolved = resolveRow(form.status, row);
    const o = row.original;
    return {
      resolved,
      over:
        round2(num(row.usedDays) + num(row.reservedDays)) >
        num(row.creditedDays),
      locked: Boolean(row._id && o && (o.usedDays > 0 || o.reservedDays > 0)),
      remainingChanged:
        o && round2(resolved.remaining) !== round2(o.remainingDays),
      periodTotal: row.period
        ? round2(row.period.credited + num(row.creditedDays))
        : 0,
      name: fullName(row.employee),
    };
  };

  const RemoveButton = ({ row, v }) =>
    canEdit ? (
      <button
        type="button"
        onClick={() => removeRow(row.key)}
        disabled={v.locked}
        aria-label={`Remove ${v.name}`}
        title={
          v.locked
            ? "Can't remove: days were already used or reserved. Change the status instead."
            : `Remove ${v.name}`
        }
        className="p-1.5 rounded-md transition-colors duration-200 ease-out disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[rgba(239,68,68,0.10)]"
        style={{ color: "#ef4444" }}
      >
        <X size={16} />
      </button>
    ) : null;

  const PeriodInfo = ({ row, v }) =>
    row.period ? (
      <span
        className="text-xs font-mono"
        style={{
          color:
            v.periodTotal > row.period.limit ? "#d97706" : "var(--app-muted)",
          fontWeight: v.periodTotal > row.period.limit ? 700 : 500,
        }}
        title="Credited for this period across all batches, including this one. Re-checked on review."
      >
        {fmtNum(v.periodTotal)} / {row.period.limit}
        <span className="block text-[10px] font-sans">{row.period.label}</span>
      </span>
    ) : (
      <span style={{ color: "var(--app-muted)" }}>-</span>
    );

  return (
    <div className="p-1">
      {/* Meta */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 rounded-xl border text-xs"
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor,
          color: "var(--app-muted)",
        }}
      >
        <span
          className="font-mono font-bold"
          style={{ color: "var(--app-text)" }}
        >
          #{shortId(credit._id)}
        </span>
        <StatusBadge status={credit.status} />
        {credit.creditedBy && (
          <span>Credited by {fullName(credit.creditedBy)}</span>
        )}
        <span>Created {formatDateTime(credit.createdAt)}</span>
        <span>Updated {formatDateTime(credit.updatedAt)}</span>
        {credit.status === "ROLLEDBACK" && credit.dateRolledBack && (
          <span>
            Rolled back {formatDateTime(credit.dateRolledBack)}
            {credit.rolledBackBy && ` by ${fullName(credit.rolledBackBy)}`}
          </span>
        )}
      </div>

      {!canEdit && (
        <Alert tone="blue" icon={ShieldAlert} className="mt-3">
          View only — you need the <b>wellness.admin_edit</b> permission to
          change wellness credits.
        </Alert>
      )}

      {/* Batch details */}
      <SectionTitle icon={CalendarDays}>Batch details</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span
            className={fieldLabelClass}
            style={{ color: "var(--app-muted)" }}
          >
            Date approved
          </span>
          <input
            type="date"
            value={form.dateApproved}
            disabled={!canEdit}
            onChange={(e) => setHeader("dateApproved", e.target.value)}
            className={inputClass}
            style={inputStyle(borderColor)}
          />
        </label>
        <label className="block">
          <span
            className={fieldLabelClass}
            style={{ color: "var(--app-muted)" }}
          >
            Days per employee
          </span>
          <input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={form.days}
            disabled={!canEdit}
            onChange={(e) => setHeader("days", e.target.value)}
            className={inputClass}
            style={inputStyle(borderColor)}
          />
        </label>
        <label className="block">
          <span
            className={fieldLabelClass}
            style={{ color: "var(--app-muted)" }}
          >
            Batch status
          </span>
          <select
            value={form.status}
            disabled={!canEdit}
            onChange={(e) => changeBatchStatus(e.target.value)}
            className={`${inputClass} cursor-pointer`}
            style={inputStyle(borderColor)}
          >
            {CREDIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {statusNote && (
        <Alert tone="blue" icon={Info} className="mt-3">
          {statusNote}
        </Alert>
      )}

      {/* Employees */}
      <SectionTitle
        icon={Users}
        right={
          canEdit && (
            <button
              type="button"
              onClick={applyDaysToAll}
              disabled={!form.rows.length || !form.days}
              className="text-[11px] font-bold disabled:opacity-40"
              style={{ color: "var(--accent)" }}
            >
              Set everyone to {form.days || "-"} day(s)
            </button>
          )
        }
      >
        Employees ({form.rows.length})
      </SectionTitle>

      {canEdit && (
        <div className="mb-3">
          <EmployeeSearch
            placeholder="Add an employee — search by name, email or position..."
            excludeIds={rowEmployeeIds}
            refDate={form.dateApproved}
            onSelect={addEmployee}
          />
        </div>
      )}

      {form.rows.length === 0 && (
        <Alert tone="amber">
          No employees. Add at least one before saving.
        </Alert>
      )}

      {/* Desktop rows */}
      {form.rows.length > 0 && (
        <div
          className="hidden lg:block rounded-xl border overflow-x-auto"
          style={{ borderColor }}
        >
          <table className="w-full text-left">
            <thead style={{ backgroundColor: "var(--app-surface-2)" }}>
              <tr
                className="text-[10px] uppercase tracking-[0.12em] font-bold"
                style={{ color: "var(--app-muted)" }}
              >
                <th className="px-4 py-3">Employee</th>
                <th className="px-2 py-3 text-right">Credited</th>
                <th className="px-2 py-3 text-right">Used</th>
                <th className="px-2 py-3 text-right">Reserved</th>
                <th className="px-3 py-3 text-right">Remaining</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Date credited</th>
                <th className="px-3 py-3">Period</th>
                <th className="px-2 py-3" aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row) => {
                const v = rowView(row);
                return (
                  <tr
                    key={row.key}
                    className="border-t"
                    style={{
                      borderColor,
                      backgroundColor: v.over
                        ? TONES.red.backgroundColor
                        : "var(--app-surface)",
                      boxShadow: !row._id
                        ? "inset 3px 0 0 var(--accent)"
                        : undefined,
                    }}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: "var(--app-text)" }}
                        >
                          {v.name}
                        </span>
                        {!row._id && <Pill tone="green">New</Pill>}
                      </div>
                      <div
                        className="text-[11px]"
                        style={{ color: "var(--app-muted)" }}
                      >
                        {[row.employee.position, row.employee.employeeType]
                          .filter(Boolean)
                          .join(" · ") ||
                          (row.employee.missing
                            ? "Employee record not found"
                            : "")}
                      </div>
                      {v.over && (
                        <div
                          className="text-[11px] font-semibold"
                          style={{ color: "#ef4444" }}
                        >
                          Used + reserved is more than credited.
                        </div>
                      )}
                    </td>
                    {["creditedDays", "usedDays", "reservedDays"].map(
                      (field) => (
                        <td
                          key={field}
                          className="px-2 py-3 align-middle text-right"
                        >
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            inputMode="decimal"
                            aria-label={`${FIELD_LABELS[field]} days for ${v.name}`}
                            value={row[field]}
                            disabled={!canEdit}
                            onChange={(e) =>
                              setRow(row.key, field, e.target.value)
                            }
                            className={numberInputClass}
                            style={inputStyle(borderColor)}
                          />
                        </td>
                      ),
                    )}
                    <td className="px-3 py-3 align-middle text-right">
                      <span
                        className="text-sm font-bold font-mono"
                        style={{ color: "var(--app-text)" }}
                      >
                        {fmtNum(v.resolved.remaining)}
                      </span>
                      {v.remainingChanged && (
                        <span
                          className="block text-[10px]"
                          style={{ color: "var(--app-muted)" }}
                        >
                          was {fmtNum(row.original.remainingDays)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <select
                        value={row.status}
                        aria-label={`Status for ${v.name}`}
                        disabled={!canEdit || form.status === "ROLLEDBACK"}
                        onChange={(e) =>
                          setRow(row.key, "status", e.target.value)
                        }
                        className="px-2 py-1.5 rounded-lg text-xs font-semibold border outline-none cursor-pointer disabled:opacity-60"
                        style={inputStyle(borderColor)}
                      >
                        {ROW_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      {v.resolved.status !== row.status && (
                        <span
                          className="block text-[10px] mt-0.5"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Saves as {STATUS_LABELS[v.resolved.status]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <input
                        type="date"
                        aria-label={`Date credited for ${v.name}`}
                        value={row.dateCredited}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setRow(row.key, "dateCredited", e.target.value)
                        }
                        className="px-2 py-1.5 rounded-lg text-xs border outline-none disabled:opacity-60"
                        style={inputStyle(borderColor)}
                      />
                      {!row.dateCredited && (
                        <span
                          className="block text-[10px] mt-0.5"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Uses date approved
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <PeriodInfo row={row} v={v} />
                    </td>
                    <td className="px-2 py-3 align-middle text-right">
                      <RemoveButton row={row} v={v} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile rows */}
      <div className="lg:hidden space-y-3">
        {form.rows.map((row) => {
          const v = rowView(row);
          return (
            <div
              key={row.key}
              className={`rounded-xl border p-3 ${!row._id ? "border-l-4" : ""}`}
              style={{
                borderColor,
                borderLeftColor: !row._id ? "var(--accent)" : borderColor,
                backgroundColor: v.over
                  ? TONES.red.backgroundColor
                  : "var(--app-surface)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--app-text)" }}
                    >
                      {v.name}
                    </span>
                    {!row._id && <Pill tone="green">New</Pill>}
                    <RowStatusPill status={v.resolved.status} />
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {[row.employee.position, row.employee.employeeType]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <RemoveButton row={row} v={v} />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                {["creditedDays", "usedDays", "reservedDays"].map((field) => (
                  <label key={field} className="block">
                    <span
                      className="block text-[10px] font-bold uppercase tracking-wide mb-1"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {FIELD_LABELS[field]}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      value={row[field]}
                      disabled={!canEdit}
                      onChange={(e) => setRow(row.key, field, e.target.value)}
                      className={numberInputClass}
                      style={inputStyle(borderColor)}
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className="block">
                  <span
                    className="block text-[10px] font-bold uppercase tracking-wide mb-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Status
                  </span>
                  <select
                    value={row.status}
                    disabled={!canEdit || form.status === "ROLLEDBACK"}
                    onChange={(e) => setRow(row.key, "status", e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold border outline-none disabled:opacity-60"
                    style={inputStyle(borderColor)}
                  >
                    {ROW_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span
                    className="block text-[10px] font-bold uppercase tracking-wide mb-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Date credited
                  </span>
                  <input
                    type="date"
                    value={row.dateCredited}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setRow(row.key, "dateCredited", e.target.value)
                    }
                    className="w-full px-2 py-1.5 rounded-lg text-xs border outline-none disabled:opacity-60"
                    style={inputStyle(borderColor)}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between mt-3 text-xs">
                <span style={{ color: "var(--app-muted)" }}>
                  Remaining{" "}
                  <b
                    className="font-mono text-sm"
                    style={{ color: "var(--app-text)" }}
                  >
                    {fmtNum(v.resolved.remaining)}
                  </b>
                  {v.remainingChanged &&
                    ` (was ${fmtNum(row.original.remainingDays)})`}
                </span>
                <PeriodInfo row={row} v={v} />
              </div>
              {v.over && (
                <p
                  className="text-[11px] font-semibold mt-1"
                  style={{ color: "#ef4444" }}
                >
                  Used + reserved is more than credited.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] mt-2" style={{ color: "var(--app-muted)" }}>
        Remaining is always credited − used − reserved (0 for expired or
        rolled-back employees).
      </p>

      {canEdit && (
        <>
          {/* Save options */}
          <SectionTitle icon={ShieldAlert}>Save options</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <OptionToggle
              checked={options.adjustBalances}
              onChange={(v) => setOption("adjustBalances", v)}
              label="Adjust employee balances"
              hint="Recommended. Moves each balance by the change in that employee's remaining days."
              borderColor={borderColor}
            />
            <OptionToggle
              checked={options.overrideLimit}
              onChange={(v) => setOption("overrideLimit", v)}
              label="Override yearly / half-year limit"
              hint="Allow more than 5 days a year (2 per half-year for Job Order)."
              tone="amber"
              borderColor={borderColor}
            />
            <OptionToggle
              checked={options.force}
              onChange={(v) => setOption("force", v)}
              label="Force"
              hint="Allow rolling back used days and balances going below zero."
              tone="red"
              borderColor={borderColor}
            />
          </div>

          <label className="block mt-4">
            <span
              className={fieldLabelClass}
              style={{ color: "var(--app-muted)" }}
            >
              Reason for change (saved in the edit log)
            </span>
            <textarea
              rows={2}
              maxLength={500}
              value={reason}
              placeholder="e.g. Correction per HR memo 2026-114"
              onChange={(e) => setReason(e.target.value)}
              className={`${inputClass} resize-y`}
              style={inputStyle(borderColor)}
            />
          </label>

          {problem && (
            <Alert tone="red" title={problem.message} className="mt-4">
              {problem.details?.length > 1 && (
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {problem.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
              {problem.conflict && (
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1 underline font-bold"
                  onClick={() => creditQ.refetch()}
                >
                  <RefreshCw size={12} /> Reload latest version
                </button>
              )}
            </Alert>
          )}

          {plan && (
            <div className="mt-4">
              <PlanReview plan={plan} borderColor={borderColor} />
            </div>
          )}
        </>
      )}

      {/* Edit history */}
      {history.length > 0 && (
        <details className="mt-6 rounded-xl border" style={{ borderColor }}>
          <summary
            className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            style={{ color: "var(--app-muted)" }}
          >
            <History size={14} /> Edit history ({history.length})
          </summary>
          <ul className="px-4 pb-4 space-y-2">
            {history.map((h) => (
              <li
                key={h._id || h.editedAt}
                className="rounded-lg border p-3 text-xs"
                style={{ borderColor, backgroundColor: "var(--app-surface-2)" }}
              >
                <div className="flex flex-wrap items-center gap-x-2">
                  <span
                    className="font-bold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {h.editedBy ? fullName(h.editedBy) : "Unknown"}
                  </span>
                  <span style={{ color: "var(--app-muted)" }}>
                    {formatDateTime(h.editedAt)}
                  </span>
                </div>
                {h.reason && (
                  <p
                    className="mt-1 italic"
                    style={{ color: "var(--app-text)" }}
                  >
                    “{h.reason}”
                  </p>
                )}
                <p className="mt-1" style={{ color: "var(--app-muted)" }}>
                  {(h.changes?.header?.length || 0) > 0 &&
                    `Batch: ${h.changes.header.map((c) => FIELD_LABELS[c.field] || c.field).join(", ")}. `}
                  {(h.changes?.rows?.length || 0) > 0 &&
                    `Employees: ${h.changes.rows.map((r) => `${r.name} (${r.action})`).join(", ")}.`}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Footer actions */}
      {canEdit && (
        <div
          className="sticky bottom-0 md:-bottom-6 z-10 mt-6 -mx-4 md:-mx-6 -mb-4 md:-mb-6 px-4 md:px-6 py-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-b-xl"
          style={{ backgroundColor: "var(--app-surface)", borderColor }}
        >
          <span className="text-xs" style={{ color: "var(--app-muted)" }}>
            {isDirty ? "Unsaved changes" : "No changes yet"}
            {plan?.valid && plan?.hasChanges && " · Reviewed, ready to save"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetForm}
              disabled={!isDirty || busy}
              className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{ color: "var(--app-muted)" }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={runReview}
              disabled={busy}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border whitespace-nowrap disabled:opacity-50"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "var(--accent)",
                color: "var(--accent)",
              }}
            >
              {previewMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ClipboardCheck className="w-4 h-4" />
              )}
              {previewMutation.isPending ? (
                "Checking..."
              ) : (
                <span>
                  Review<span className="hidden sm:inline"> changes</span>
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || !plan?.valid || !plan?.hasChanges}
              title={!plan ? "Review your changes first" : undefined}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-md whitespace-nowrap disabled:opacity-40 disabled:shadow-none"
              style={{ backgroundColor: "var(--accent, #2563EB)" }}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveMutation.isPending ? (
                "Saving..."
              ) : (
                <span>
                  Save<span className="hidden sm:inline"> changes</span>
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* =====================================================================
   PAGE — EDIT ONE BATCH  (/app/console/wellness-credits/:creditId)
===================================================================== */

export const WellnessCreditAdminEditPage = () => {
  const { creditId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();
  const canEdit = can("wellness.admin_edit");
  const { borderColor, skeleton } = useThemeColors();

  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  // Warn before closing / refreshing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Back to the exact list (tab, filters, page) the admin came from.
  const goBack = () => {
    if (busy) return;
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    if (location.state?.from) navigate(location.state.from);
    else navigate("..", { relative: "path" });
  };

  return (
    <FullHeightCardContainer>
      <div
        className="w-full h-full min-h-0 flex flex-col md:p-0 transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
          color: "var(--app-text, #0f172a)",
        }}
      >
        <SkeletonTheme
          baseColor={skeleton.baseColor}
          highlightColor={skeleton.highlightColor}
        >
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain md:contents cto-scrollbar">
            <div className="pt-2 pb-3 md:pb-6 px-1">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={busy}
                  aria-label="Back to the list"
                  title="Back to the list"
                  className="mt-1 p-2 rounded-lg border flex-none transition-colors duration-200 ease-out disabled:opacity-40"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor,
                    color: "var(--app-text)",
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-sans">
                    {canEdit ? "Edit Wellness Credit" : "Wellness Credit"}
                  </h1>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Batch{" "}
                    <span className="font-mono font-semibold">
                      #{shortId(creditId)}
                    </span>
                    {canEdit &&
                      " · Change any detail, review the effect on balances, then save."}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="flex flex-col rounded-xl shadow-sm md:flex-1 md:min-h-0 md:overflow-hidden"
              style={{
                backgroundColor: "var(--app-surface)",
                border: `1px solid ${borderColor}`,
              }}
            >
              <div className="p-4 md:p-6 md:flex-1 md:min-h-0 md:overflow-y-auto cto-scrollbar">
                <CreditEditor
                  key={creditId}
                  creditId={creditId}
                  canEdit={canEdit}
                  onDirtyChange={setDirty}
                  onBusyChange={setBusy}
                  onBack={goBack}
                />
              </div>
            </div>
          </div>
        </SkeletonTheme>
      </div>
    </FullHeightCardContainer>
  );
};

/* =====================================================================
   PAGE — LIST  (/app/console/wellness-credits)
===================================================================== */

const VIEWS = [
  { id: "batches", label: "Credit Batches", icon: Layers },
  { id: "employees", label: "Employee Lookup", icon: UserSearch },
];

const WellnessCreditAdmin = () => {
  const { can } = usePermissions();
  const canEdit = can("wellness.admin_edit");
  const { borderColor, skeleton } = useThemeColors();

  const [params, updateParams] = useUrlState();
  const view = params.get("view") === "employees" ? "employees" : "batches";
  const setView = (id) =>
    updateParams({ view: id === "batches" ? undefined : id });

  const scrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = () => setShowScrollTop(el.scrollTop > 240);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <FullHeightCardContainer>
      <div
        className="w-full h-full min-h-0 flex flex-col md:p-0 transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
          color: "var(--app-text, #0f172a)",
        }}
      >
        <SkeletonTheme
          baseColor={skeleton.baseColor}
          highlightColor={skeleton.highlightColor}
        >
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain md:contents cto-scrollbar"
          >
            <div className="pt-2 pb-3 md:pb-6 px-1">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-sans">
                    Wellness Credit Admin
                  </h1>
                  <p
                    className="text-sm mt-1 max-w-2xl"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Find any credit batch or employee and correct every detail.
                    Each change is reviewed before it's saved.
                  </p>
                </div>

                <div
                  className="inline-flex p-1 rounded-xl border w-full md:w-auto"
                  style={{ backgroundColor: "var(--app-surface)", borderColor }}
                  role="tablist"
                  aria-label="Admin views"
                >
                  {VIEWS.map((v) => {
                    const Icon = v.icon;
                    const active = view === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setView(v.id)}
                        className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 ease-out whitespace-nowrap"
                        style={
                          active
                            ? {
                                backgroundColor: "var(--accent-soft)",
                                color: "var(--accent)",
                              }
                            : { color: "var(--app-muted)" }
                        }
                      >
                        <Icon className="w-4 h-4" />
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {view === "batches" ? (
              <CreditBatchesView canEdit={canEdit} />
            ) : (
              <EmployeeLookupView canEdit={canEdit} />
            )}
          </div>

          {showScrollTop && (
            <button
              type="button"
              onClick={() =>
                scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
              }
              className="md:hidden fixed bottom-5 right-5 z-[1] h-10 w-10 rounded-full shadow-lg active:scale-95 flex items-center justify-center"
              style={{
                backgroundColor: "var(--accent, #2563EB)",
                color: "#fff",
              }}
              aria-label="Scroll to top"
              title="Back to top"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          )}
        </SkeletonTheme>
      </div>
    </FullHeightCardContainer>
  );
};

export default WellnessCreditAdmin;
