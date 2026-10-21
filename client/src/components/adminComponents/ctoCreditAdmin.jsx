// ctoCreditAdmin.jsx
//
// Admin-only pages for CTO credit memos (inside the admin console).
//   • List  (/<ADMIN_CONSOLE_PATH>/cto-credits)
//       – "Credit Memos" tab: status chips, search, overtime dates, sort
//       – "Employee Lookup" tab: stored vs. computed CTO balance (+ recalculate),
//         CSC room this month, and the employee's memos
//   • Edit  (/<ADMIN_CONSOLE_PATH>/cto-credits/:creditId)
//       – memo details, memo file, every employee row (credited / used / reserved /
//         forfeited hours, status, date), add / remove employees, rollback
//       – review the effect on CSC limits and CTO balances, then save
//
// Uses adminCtoCredit.js. Admin edits send no emails or notifications.

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useId,
  cloneElement,
  isValidElement,
} from "react";
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

import API from "../../api/api";
import {
  searchCtoCreditAdminEmployees,
  fetchCtoCreditAdminEmployeeBalance,
  recalculateCtoCreditAdminEmployeeBalance,
  fetchCtoCreditAdminCredits,
  fetchCtoCreditAdminCreditById,
  previewCtoCreditAdminUpdate,
  updateCtoCreditAdmin,
} from "../../api/adminCtoCredit";

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
  UserSearch,
  CalendarDays,
  Clock,
  FileText,
  FileUp,
  ExternalLink,
  ArrowUp,
  ArrowLeft,
  Pencil,
  Eye,
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
  Paperclip,
  Hourglass,
} from "lucide-react";

/* =====================================================================
   CONSTANTS & HELPERS
===================================================================== */

const pageSizeOptions = [20, 50, 100];
const MEMO_STATUSES = ["CREDITED", "ROLLEDBACK"];
const ROW_STATUSES = ["ACTIVE", "EXHAUSTED", "ROLLEDBACK"];
const STATUS_LABELS = {
  CREDITED: "Credited",
  ROLLEDBACK: "Rolled back",
  ACTIVE: "Active",
  EXHAUSTED: "Exhausted",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  REVOCATION_REQUESTED: "Revocation Requested",
  REVOKED: "Revoked",
};
const ROW_TONE = { ACTIVE: "green", EXHAUSTED: "slate", ROLLEDBACK: "red" };
const HOUR_FIELDS = [
  "creditedHours",
  "usedHours",
  "reservedHours",
  "forfeitedHours",
];
const FIELD_LABELS = {
  creditedHours: "Credited",
  usedHours: "Used",
  reservedHours: "Reserved",
  remainingHours: "Remaining",
  forfeitedHours: "Forfeited",
  status: "Status",
  dateCredited: "Date credited",
  employee: "Employee",
};
const DATE_FIELDS = new Set([
  "dateApproved",
  "dateCredited",
  "startDate",
  "endDate",
]);
const ACTION_META = {
  added: { label: "Added", tone: "green" },
  updated: { label: "Updated", tone: "blue" },
  removed: { label: "Removed", tone: "red" },
};
const SORT_OPTIONS = [
  { value: "-createdAt", label: "Newest first" },
  { value: "-inclusiveDates.startDate", label: "Overtime date (newest)" },
  { value: "-dateApproved", label: "Date approved (newest)" },
  { value: "memoNo", label: "Memo no. (A–Z)" },
];
const DEFAULT_OPTIONS = {
  adjustBalances: true,
  overrideLimit: false,
  force: false,
};
const MEMO_FILE_TYPES = [".pdf", ".png", ".jpg", ".jpeg"];

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
  slate: {
    backgroundColor: "rgba(100,116,139,0.10)",
    borderColor: "rgba(100,116,139,0.25)",
    color: "#64748b",
  },
  accent: {
    backgroundColor: "var(--accent-soft)",
    borderColor: "var(--accent-soft2)",
    color: "var(--accent)",
  },
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
const formatHours = (h) => {
  const v = round2(num(h));
  return `${v} hr${v !== 1 ? "s" : ""}`;
};
const fullName = (e) =>
  e?.fullName ||
  `${e?.firstName || ""} ${e?.lastName || ""}`.trim() ||
  "Unknown employee";
const shortId = (id) => (id ? String(id).slice(-6).toUpperCase() : "-");
const pad = (n) => String(n).padStart(2, "0");
const strOf = (v) => (v === null || v === undefined ? "" : String(v));

const toInputDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const localMidnight = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
    ? localMidnight(String(value))
    : new Date(value);
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
const formatShortDate = (value) => {
  const d = toDate(value);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
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
const formatRange = (start, end) => {
  if (!start) return "-";
  if (!end || toInputDate(start) === toInputDate(end)) return formatDate(start);
  return `${formatShortDate(start)} – ${formatDate(end)}`;
};
const monthKey = (key) => (key ? key.slice(0, 7) : "");
const memoHoursOf = (hours, minutes) => round2(num(hours) + num(minutes) / 60);

/** "YYYY-MM-DD" → ISO timestamp, keeping the original value's time of day (no time-zone shift). */
const isoKeepingTime = (key, original) => {
  const base = localMidnight(key);
  const o = original ? new Date(original) : null;
  if (o && !Number.isNaN(o.getTime())) {
    const offset = o.getTime() - localMidnight(toInputDate(o)).getTime();
    return new Date(base.getTime() + offset).toISOString();
  }
  return base.toISOString();
};

/** Link to an uploaded memo file. Files are served by the backend, next to /api. */
const memoFileUrl = (filePath) => {
  if (!filePath) return null;
  const clean = String(filePath).replace(/\\/g, "/");
  if (/^https?:\/\//i.test(clean)) return clean;
  const base = String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");
  const path = clean.startsWith("/") ? clean : `/${clean}`;
  try {
    return new URL(base + path, window.location.origin).href;
  } catch {
    return path;
  }
};
const fileNameOf = (filePath) =>
  String(filePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop() || "memo";

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
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const positiveInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** List state lives in the URL so "Back" from the edit page restores it. */
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

/* =====================================================================
   EDIT FORM <-> PAYLOAD
===================================================================== */

/** Same rule as the backend (resolveRowState). The server's review is final. */
function resolveRow(memoStatus, row) {
  if (memoStatus === "ROLLEDBACK" || row.status === "ROLLEDBACK")
    return { status: "ROLLEDBACK", remaining: 0 };
  const remaining = Math.max(
    round2(
      num(row.creditedHours) - num(row.usedHours) - num(row.reservedHours),
    ),
    0,
  );
  if (row.status === "EXHAUSTED" && remaining === 0)
    return { status: "EXHAUSTED", remaining: 0 };
  return { status: "ACTIVE", remaining };
}

function toForm(credit) {
  return {
    memoNo: credit.memoNo || "",
    purpose: credit.purpose || "",
    status: credit.status || "CREDITED",
    dateApproved: toInputDate(credit.dateApproved),
    dateCredited: toInputDate(credit.dateCredited),
    startDate: toInputDate(credit.inclusiveDates?.startDate),
    endDate: toInputDate(credit.inclusiveDates?.endDate),
    hours: strOf(credit.duration?.hours ?? 0),
    minutes: strOf(credit.duration?.minutes ?? 0),
    rows: (credit.employees || []).map((r) => ({
      key: String(r._id),
      _id: String(r._id),
      employee: r.employeeInfo || {
        _id: String(r.employee),
        fullName: "Deleted employee",
        missing: true,
      },
      creditedHours: strOf(r.creditedHours ?? 0),
      usedHours: strOf(r.usedHours ?? 0),
      reservedHours: strOf(r.reservedHours ?? 0),
      forfeitedHours: strOf(r.forfeitedHours ?? 0),
      status: r.status || "ACTIVE",
      dateCredited: toInputDate(r.dateCredited),
      original: {
        creditedHours: num(r.creditedHours),
        usedHours: num(r.usedHours),
        reservedHours: num(r.reservedHours),
        remainingHours: num(r.remainingHours),
        dateCredited: toInputDate(r.dateCredited),
        dateCreditedRaw: r.dateCredited || null,
      },
      room: r.room || null,
      applications: r.applications || null,
    })),
  };
}

const toNumber = (v) => (v === "" ? NaN : Number(v)); // NaN → null in JSON → server error
const rowsForCompare = (rows) =>
  rows.map((r) => [
    r._id,
    String(r.employee._id),
    ...HOUR_FIELDS.map((f) => r[f]),
    r.status,
    r.dateCredited,
  ]);

/** Only what changed is sent; the server re-checks everything anyway. */
function buildPayload(form, initial, credit, options, reason) {
  const payload = { options, expectedUpdatedAt: credit.updatedAt };
  if (reason.trim()) payload.reason = reason.trim();

  ["memoNo", "purpose", "status"].forEach((k) => {
    if (form[k] !== initial[k]) payload[k] = form[k];
  });
  if (form.dateApproved !== initial.dateApproved) {
    payload.dateApproved = form.dateApproved
      ? isoKeepingTime(form.dateApproved, credit.dateApproved)
      : "";
  }
  if (form.dateCredited !== initial.dateCredited && form.dateCredited) {
    payload.dateCredited = isoKeepingTime(
      form.dateCredited,
      credit.dateCredited,
    );
  }
  const inc = {};
  if (form.startDate !== initial.startDate) {
    inc.startDate = form.startDate
      ? isoKeepingTime(form.startDate, credit.inclusiveDates?.startDate)
      : "";
  }
  if (form.endDate !== initial.endDate) {
    inc.endDate = form.endDate
      ? isoKeepingTime(form.endDate, credit.inclusiveDates?.endDate)
      : "";
  }
  if (Object.keys(inc).length) payload.inclusiveDates = inc;
  if (form.hours !== initial.hours || form.minutes !== initial.minutes) {
    payload.duration = {
      hours: toNumber(form.hours),
      minutes: toNumber(form.minutes),
    };
  }

  if (!sameJson(rowsForCompare(form.rows), rowsForCompare(initial.rows))) {
    payload.employees = form.rows.map((r) => {
      const row = {
        employee: String(r.employee._id),
        creditedHours: toNumber(r.creditedHours),
        usedHours: toNumber(r.usedHours),
        reservedHours: toNumber(r.reservedHours),
        forfeitedHours: toNumber(r.forfeitedHours),
        status: r.status,
      };
      if (r._id) row._id = r._id;
      // only send dates the admin changed, so the original time of day is kept
      if (
        r.dateCredited &&
        r.dateCredited !== (r.original?.dateCredited ?? "")
      ) {
        row.dateCredited = isoKeepingTime(
          r.dateCredited,
          r.original?.dateCreditedRaw || credit.dateApproved,
        );
      }
      return row;
    });
  }
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
const fieldLabelClass =
  "block text-[10px] font-bold uppercase tracking-wider mb-1.5";

/** Label + one input/select/textarea, linked by id. */
const Field = ({ label, children, className = "", hint }) => {
  const id = useId();
  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={id}
        className={fieldLabelClass}
        style={{ color: "var(--app-muted)" }}
      >
        {label}
      </label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
      {hint && (
        <span
          className="block text-[10px] mt-1"
          style={{ color: "var(--app-muted)" }}
        >
          {hint}
        </span>
      )}
    </div>
  );
};

const Pill = ({ tone = "accent", children, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${className}`}
    style={TONES[tone] || TONES.accent}
  >
    {children}
  </span>
);

const RowStatusPill = ({ status }) => (
  <Pill tone={ROW_TONE[status] || "slate"}>
    {STATUS_LABELS[status] || status}
  </Pill>
);

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
  <div className="flex items-center justify-between gap-3 mt-7 mb-3">
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
    className="rounded-lg border p-2 min-w-0"
    style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
  >
    <div
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: "var(--app-muted)" }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />} {label}
    </div>
    <div
      className="mt-1 text-sm font-semibold truncate"
      style={{ color: "var(--app-text)" }}
    >
      {value}
    </div>
  </div>
);

const EmptyState = ({ icon: Icon = Inbox, title, children, borderColor }) => (
  <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
    <div
      className="p-6 rounded-full mb-4 ring-1"
      style={{
        backgroundColor: "var(--app-surface)",
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

const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  borderColor,
  noun = "memos",
}) => (
  <div
    className="px-4 md:px-6 py-3 border-t"
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

/** Opens the memo on its own page and remembers this list URL for "Back". */
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

const MemoFileLink = ({ path, compact = false }) => {
  const href = memoFileUrl(path);
  if (!href) return <span style={{ color: "var(--app-muted)" }}>No file</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 font-semibold hover:underline min-w-0 ${compact ? "text-[11px]" : "text-xs"}`}
      style={{ color: "var(--accent)" }}
      title={fileNameOf(path)}
    >
      <Paperclip size={compact ? 11 : 13} className="flex-none" />
      <span className="truncate">{compact ? "Memo" : fileNameOf(path)}</span>
      {!compact && <ExternalLink size={11} className="flex-none" />}
    </a>
  );
};

const OptionToggle = ({
  checked,
  onChange,
  label,
  hint,
  tone,
  borderColor,
}) => (
  <label
    className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors duration-200 ease-out"
    style={
      checked && tone
        ? TONES[tone]
        : { borderColor, backgroundColor: "var(--app-surface)" }
    }
  >
    <input
      type="checkbox"
      checked={checked}
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
   EMPLOYEE SEARCH (combobox) — shows CTO balance and CSC room
===================================================================== */

const EmployeeSearch = ({
  label,
  placeholder,
  excludeIds = [],
  refDate,
  onSelect,
  compact = false,
}) => {
  const { borderColor } = useThemeColors();
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 300);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const listId = useRef(
    `ccr-emp-${Math.random().toString(36).slice(2)}`,
  ).current;
  const excluded = new Set(excludeIds.map(String));

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["ctoCreditAdminEmployeeSearch", q, refDate || ""],
    queryFn: () =>
      searchCtoCreditAdminEmployees(cleanParams({ q, limit: 10, refDate })),
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
      e.stopPropagation();
      setOpen(false);
    }
  };

  const showList = open && query.trim().length > 0;

  return (
    <div className="relative" ref={boxRef}>
      {label && (
        <label
          htmlFor={`${listId}-input`}
          className={fieldLabelClass}
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
          placeholder={
            placeholder || "Search by name, email, position or division..."
          }
          value={query}
          maxLength={100}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`${inputClass} pl-9 pr-8 ${compact ? "py-1.5 text-xs" : ""}`}
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
          {results.map((emp, i) => {
            const disabled = excluded.has(String(emp._id));
            const isActive = i === active;
            const room = emp.room;
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
                    style={TONES.accent}
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
                      {[emp.position, emp.employeeType]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                </div>
                <div className="flex-none text-right">
                  {disabled ? (
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Already in memo
                    </span>
                  ) : (
                    <>
                      <span
                        className="block text-[11px] font-semibold"
                        style={{ color: "var(--app-text)" }}
                      >
                        CTO {fmtNum(emp.ctoBalance)}h
                      </span>
                      {room && (
                        <span
                          className="block text-[10px]"
                          style={{
                            color:
                              room.creditableNow > 0
                                ? "var(--app-muted)"
                                : "#d97706",
                          }}
                        >
                          {fmtNum(room.creditableNow)}h creditable ({room.month}
                          )
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
   VIEW 1 — CREDIT MEMOS
===================================================================== */

const STATUS_TABS = [
  { id: "", label: "All", icon: Layers, tone: "accent" },
  { id: "CREDITED", label: "Credited", icon: CheckCircle2, tone: "green" },
  { id: "ROLLEDBACK", label: "Rolled back", icon: RotateCcw, tone: "red" },
];

const HoursLine = ({ s }) => (
  <span
    className="font-mono text-xs whitespace-nowrap"
    style={{ color: "var(--app-muted)" }}
    title="Credited · used · reserved · remaining"
  >
    <b style={{ color: "var(--app-text)" }}>{fmtNum(s.creditedHours)}</b> ·{" "}
    {fmtNum(s.usedHours)} · {fmtNum(s.reservedHours)} ·{" "}
    <b style={{ color: "var(--app-text)" }}>{fmtNum(s.remainingHours)}</b>
  </span>
);

const MAX_VISIBLE_EMPLOYEES = 2;

const EmployeesCell = ({ employees = [], borderColor }) => {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(employees.length - MAX_VISIBLE_EMPLOYEES, 0);
  const shown = expanded
    ? employees
    : employees.slice(0, MAX_VISIBLE_EMPLOYEES);
  const chipTitle = (r) =>
    `${fullName(r.employee)} · ${fmtNum(r.creditedHours)}h credited · ${fmtNum(
      r.remainingHours,
    )}h left${r.status === "ROLLEDBACK" ? " · rolled back" : ""}`;
  const toggle =
    hiddenCount > 0 ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
        title={
          expanded
            ? "Show less"
            : employees
                .slice(MAX_VISIBLE_EMPLOYEES)
                .map((r) => fullName(r.employee))
                .join(", ")
        }
        className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold cursor-pointer hover:opacity-80 transition-opacity"
        style={TONES.accent}
      >
        {expanded ? "Show less" : `+${hiddenCount} more`}
      </button>
    ) : null;
  return (
    <div className="flex flex-col items-start gap-1.5 min-w-0">
      <div
        className={`flex flex-wrap items-center gap-1 min-w-0 w-full ${
          expanded && employees.length > 12
            ? "max-h-40 overflow-y-auto pr-1"
            : ""
        }`}
      >
        {shown.map((r) => (
          <span
            key={String(r._id)}
            className="inline-flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full border text-[11px] max-w-[150px]"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
              color: "var(--app-text)",
              opacity: r.status === "ROLLEDBACK" ? 0.55 : 1,
            }}
            title={chipTitle(r)}
          >
            <span
              className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-none"
              style={TONES.accent}
            >
              {getInitials(fullName(r.employee))}
            </span>
            <span className="truncate">{fullName(r.employee)}</span>
          </span>
        ))}
        {!expanded && toggle}
      </div>
      {/* Kept outside the scroll area so "Show less" is always reachable */}
      {expanded && toggle}
    </div>
  );
};

const CreditMemosView = ({ canEdit }) => {
  const { borderColor } = useThemeColors();
  const [params, updateParams] = useUrlState();

  const statusFilter = params.get("status") || "";
  const searchFilter = params.get("q") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const sort = params.get("sort") || "";
  const page = positiveInt(params.get("page"), 1);
  const limitParam = positiveInt(params.get("limit"), 20);
  const limit = pageSizeOptions.includes(limitParam) ? limitParam : 20;

  const setFilter = (key, value) =>
    updateParams({ [key]: value, page: undefined });
  const setPage = (value) =>
    updateParams({ page: value > 1 ? value : undefined });

  const [searchInput, setSearchInput] = useState(searchFilter);
  const debouncedSearch = useDebounced(searchInput.trim(), 500);
  useEffect(() => {
    if (debouncedSearch !== searchFilter)
      updateParams({ q: debouncedSearch, page: undefined });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isFetching, isError, error, isPlaceholderData } =
    useQuery({
      queryKey: [
        "ctoCreditAdminCredits",
        { page, limit, statusFilter, searchFilter, from, to, sort },
      ],
      queryFn: () =>
        fetchCtoCreditAdminCredits(
          cleanParams({
            page,
            limit,
            status: statusFilter,
            search: searchFilter,
            overtimeFrom: from,
            overtimeTo: to,
            sort,
          }),
        ),
      placeholderData: (prev) => prev,
    });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(page * limit, total);
  const counts = data?.statusCounts || {};

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
      <div
        className="p-4 border-b space-y-4"
        style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
      >
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.id;
            const Icon = tab.icon;
            return (
              <button
                type="button"
                key={tab.id || "all"}
                onClick={() => setFilter("status", tab.id)}
                className="px-4 py-1.5 text-xs font-bold rounded-full border transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-2"
                style={
                  isActive
                    ? TONES[tab.tone]
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
                  {(tab.id ? counts[tab.id] : counts.ALL) ?? 0}
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
              placeholder="Search memo no., purpose, employee or memo ID..."
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:flex lg:items-end">
            <Field label="Overtime from">
              <input
                type="date"
                value={from}
                onChange={(e) => setFilter("from", e.target.value)}
                className={inputClass}
                style={inputStyle(borderColor)}
              />
            </Field>
            <Field label="Overtime to">
              <input
                type="date"
                value={to}
                onChange={(e) => setFilter("to", e.target.value)}
                className={inputClass}
                style={inputStyle(borderColor)}
              />
            </Field>
            <Field label="Sort" className="col-span-2 sm:col-span-1">
              <select
                value={sort || "-createdAt"}
                onChange={(e) =>
                  setFilter(
                    "sort",
                    e.target.value === "-createdAt" ? "" : e.target.value,
                  )
                }
                className={`${inputClass} cursor-pointer`}
                style={inputStyle(borderColor)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
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
              onChange={(e) =>
                updateParams({
                  limit:
                    Number(e.target.value) === 20 ? undefined : e.target.value,
                  page: undefined,
                })
              }
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
              onChange={(v) =>
                updateParams({
                  limit: Number(v) === 20 ? undefined : v,
                  page: undefined,
                })
              }
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
                  Overtime {from ? formatDate(from) : "…"} –{" "}
                  {to ? formatDate(to) : "…"}
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

      <div
        className={`min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-auto cto-scrollbar transition-opacity ${isFetching && !isLoading ? "opacity-70" : ""}`}
        style={{ backgroundColor: "var(--app-bg)" }}
      >
        {isError ? (
          <div className="p-4">
            <Alert title="Couldn't load CTO credit memos">
              {error?.message}
            </Alert>
          </div>
        ) : !isLoading && items.length === 0 ? (
          <EmptyState title="No Credit Memos Found" borderColor={borderColor}>
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
                  : items.map((memo) => (
                      <div
                        key={memo._id}
                        className={`rounded-xl shadow-sm overflow-hidden border-y border-r border-l-4 ${memo.status === "ROLLEDBACK" ? "border-l-rose-500" : "border-l-emerald-500"}`}
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                        }}
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div
                                className="text-sm font-bold truncate"
                                style={{ color: "var(--app-text)" }}
                              >
                                {memo.memoNo || "No memo no."}
                              </div>
                              <div
                                className="text-[11px] truncate"
                                style={{ color: "var(--app-muted)" }}
                              >
                                {memo.purpose} ·{" "}
                                <span className="font-mono">
                                  #{shortId(memo._id)}
                                </span>
                              </div>
                            </div>
                            <StatusBadge status={memo.status} />
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <MiniStat
                              icon={CalendarDays}
                              label="Overtime"
                              value={formatRange(
                                memo.inclusiveDates?.startDate,
                                memo.inclusiveDates?.endDate,
                              )}
                              borderColor={borderColor}
                            />
                            <MiniStat
                              icon={Clock}
                              label="Memo"
                              value={formatHours(memo.memoHours)}
                              borderColor={borderColor}
                            />
                            <MiniStat
                              icon={Users}
                              label="Employees"
                              value={`${memo.summary?.activeEmployeeCount ?? 0} / ${memo.summary?.employeeCount ?? 0} active`}
                              borderColor={borderColor}
                            />
                            <MiniStat
                              icon={Hourglass}
                              label="Left"
                              value={`${fmtNum(memo.summary?.remainingHours)}h of ${fmtNum(memo.summary?.creditedHours)}h`}
                              borderColor={borderColor}
                            />
                          </div>
                          <div className="mt-3">
                            <EmployeesCell
                              employees={memo.employees}
                              borderColor={borderColor}
                            />
                          </div>
                        </div>
                        <div className="border-t p-3" style={{ borderColor }}>
                          <EditLink
                            full
                            canEdit={canEdit}
                            borderColor={borderColor}
                            creditId={memo._id}
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
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "21%" }} />
                  <col style={{ width: "14%" }} />
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
                    <th className="px-6 py-4">Memo</th>
                    <th className="px-4 py-4">Overtime</th>
                    <th className="px-2 py-4 text-center">Hours</th>
                    <th className="px-4 py-4">Employees</th>
                    <th
                      className="px-4 py-4"
                      title="Credited · used · reserved · remaining"
                    >
                      Cred · Used · Res · Left
                    </th>
                    <th className="px-2 py-4 text-center">Status</th>
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
                    : items.map((memo, i) => {
                        const bg =
                          i % 2 === 0
                            ? "var(--app-surface)"
                            : "var(--app-surface-2)";
                        return (
                          <tr
                            key={memo._id}
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
                              <div
                                className="text-sm font-semibold truncate"
                                style={{ color: "var(--app-text)" }}
                                title={memo.memoNo}
                              >
                                {memo.memoNo || "No memo no."}
                              </div>
                              <div
                                className="text-[11px] truncate"
                                style={{ color: "var(--app-muted)" }}
                                title={memo.purpose}
                              >
                                {memo.purpose}
                              </div>
                              <div
                                className="flex items-center gap-2 text-[11px] mt-0.5"
                                style={{ color: "var(--app-muted)" }}
                              >
                                <span className="font-mono">
                                  #{shortId(memo._id)}
                                </span>
                                <MemoFileLink
                                  path={memo.uploadedMemo}
                                  compact
                                />
                              </div>
                            </td>
                            <td
                              className="px-4 py-4 align-middle text-sm"
                              style={{ color: "var(--app-text)" }}
                            >
                              {formatRange(
                                memo.inclusiveDates?.startDate,
                                memo.inclusiveDates?.endDate,
                              )}
                              <div
                                className="text-[11px]"
                                style={{ color: "var(--app-muted)" }}
                              >
                                Approved {formatDate(memo.dateApproved)}
                              </div>
                            </td>
                            <td
                              className="px-2 py-4 align-middle text-center text-sm font-bold font-mono"
                              style={{ color: "var(--app-text)" }}
                            >
                              {fmtNum(memo.memoHours)}
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <EmployeesCell
                                employees={memo.employees}
                                borderColor={borderColor}
                              />
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <HoursLine s={memo.summary || {}} />
                            </td>
                            <td className="px-2 py-4 align-middle text-center">
                              <StatusBadge status={memo.status} />
                            </td>
                            <td className="px-4 py-4 align-middle text-right">
                              <EditLink
                                canEdit={canEdit}
                                borderColor={borderColor}
                                creditId={memo._id}
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

  const employeeId = params.get("employee") || null;
  const page = positiveInt(params.get("epage"), 1);
  const setPage = (value) =>
    updateParams({ epage: value > 1 ? value : undefined });
  const [confirmRecalc, setConfirmRecalc] = useState(false);
  const limit = 10;

  // The search matches an employee ID too — this gives their CSC room for this month.
  const personQ = useQuery({
    queryKey: ["ctoCreditAdminEmployeeSearch", employeeId, "lookup"],
    queryFn: () => searchCtoCreditAdminEmployees({ q: employeeId, limit: 1 }),
    enabled: !!employeeId,
  });
  const balanceQ = useQuery({
    queryKey: ["ctoCreditAdminEmployeeBalance", employeeId],
    queryFn: () => fetchCtoCreditAdminEmployeeBalance(employeeId),
    enabled: !!employeeId,
  });
  const memosQ = useQuery({
    queryKey: ["ctoCreditAdminCredits", { employeeId, page, limit }],
    queryFn: () => fetchCtoCreditAdminCredits({ employeeId, page, limit }),
    enabled: !!employeeId,
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey?.[1]?.employeeId === employeeId ? prev : undefined,
  });

  const recalcMutation = useMutation({
    mutationFn: () => recalculateCtoCreditAdminEmployeeBalance(employeeId),
    onSuccess: (res) => {
      toast.success(res?.message || "CTO balance recalculated.");
      if (res?.check)
        queryClient.setQueryData(
          ["ctoCreditAdminEmployeeBalance", employeeId],
          res.check,
        );
      queryClient.invalidateQueries({
        queryKey: ["ctoCreditAdminEmployeeSearch"],
      });
      setConfirmRecalc(false);
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to recalculate the CTO balance.");
      setConfirmRecalc(false);
    },
  });

  const pick = (emp) => {
    setConfirmRecalc(false);
    updateParams({
      employee: emp?._id ? String(emp._id) : undefined,
      epage: undefined,
    });
  };

  const person =
    personQ.data?.results?.find((e) => String(e._id) === employeeId) || null;
  const c = balanceQ.data;
  const who = person || c?.employee || null;
  const room = person?.room || null;
  const items = memosQ.data?.items || [];
  const total = memosQ.data?.total || 0;
  const totalPages = memosQ.data?.totalPages || 1;

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
          placeholder="Type a name, email, position or division..."
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
              See their CTO balance, how many hours they can still be credited
              this month under CSC rules, and every memo that credits them.
            </p>
          </EmptyState>
        ) : (
          <div className="p-4 md:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold flex-none"
                  style={TONES.accent}
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

            {balanceQ.isError && (
              <Alert title="Couldn't load the CTO balance">
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
                    value={formatHours(c.storedBalance)}
                    sub="On the employee record"
                    borderColor={borderColor}
                  />
                  <BalanceTile
                    label="From memos"
                    value={formatHours(c.computedBalance)}
                    sub="Remaining + reserved hours"
                    borderColor={borderColor}
                  />
                  <BalanceTile
                    label="Difference"
                    value={c.inSync ? "In sync" : `${signed(c.difference)}h`}
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
                    label="Creditable now"
                    value={room ? formatHours(room.creditableNow) : "-"}
                    sub={
                      room
                        ? `${fmtNum(room.creditedThisMonth)}/${room.maxMonthly}h in ${room.month} · ${fmtNum(room.balance)}/${room.maxBalance}h balance`
                        : "CSC room this month"
                    }
                    tone={room && room.creditableNow <= 0 ? "amber" : undefined}
                    borderColor={borderColor}
                  />
                </div>

                {confirmRecalc && (
                  <Alert
                    tone="amber"
                    icon={Scale}
                    title="Recalculate this CTO balance?"
                  >
                    <p>
                      This sets {fullName(who)}'s stored balance from{" "}
                      <b>{formatHours(c.storedBalance)}</b> to{" "}
                      <b>{formatHours(c.computedBalance)}</b> — their remaining
                      plus reserved memo hours.
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
                  {c.ledger?.memos || 0} memo(s): {fmtNum(c.ledger?.totalHours)}
                  h credited · {fmtNum(c.ledger?.remainingHours)}h remaining ·{" "}
                  {fmtNum(c.ledger?.reservedHours)}h reserved ·{" "}
                  {fmtNum(c.ledger?.usedHours)}h used
                </p>
              </>
            )}

            <div>
              <SectionTitle icon={FileText}>Credit memos</SectionTitle>
              {memosQ.isError && (
                <Alert title="Couldn't load memos">
                  {memosQ.error?.message}
                </Alert>
              )}
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor, backgroundColor: "var(--app-surface)" }}
              >
                {memosQ.isLoading ? (
                  <div className="p-4">
                    <Skeleton height={40} count={3} className="mb-2" />
                  </div>
                ) : items.length === 0 ? (
                  <p
                    className="p-6 text-center text-sm"
                    style={{ color: "var(--app-muted)" }}
                  >
                    No CTO memos credit this employee.
                  </p>
                ) : (
                  items.map((memo) => {
                    const row =
                      (memo.employees || []).find(
                        (r) =>
                          String(r.employee?._id ?? r.employee) === employeeId,
                      ) || {};
                    return (
                      <div
                        key={memo._id}
                        className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 border-b last:border-b-0"
                        style={{ borderColor }}
                      >
                        <div className="md:w-64 flex-none min-w-0">
                          <div
                            className="text-sm font-semibold truncate"
                            style={{ color: "var(--app-text)" }}
                          >
                            {memo.memoNo}
                          </div>
                          <div
                            className="text-[11px] truncate"
                            style={{ color: "var(--app-muted)" }}
                          >
                            {formatRange(
                              memo.inclusiveDates?.startDate,
                              memo.inclusiveDates?.endDate,
                            )}{" "}
                            · {memo.purpose}
                          </div>
                        </div>
                        <div className="flex-1 grid grid-cols-4 gap-2 text-center">
                          {[
                            ["Credited", row.creditedHours],
                            ["Used", row.usedHours],
                            ["Reserved", row.reservedHours],
                            ["Left", row.remainingHours],
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
                        <div className="flex items-center justify-between md:justify-end gap-2 md:w-60 flex-none">
                          <div className="flex items-center gap-1.5">
                            {row.status && row.status !== "ACTIVE" && (
                              <RowStatusPill status={row.status} />
                            )}
                            <StatusBadge status={memo.status} />
                          </div>
                          <EditLink
                            canEdit={canEdit}
                            borderColor={borderColor}
                            creditId={memo._id}
                          />
                        </div>
                      </div>
                    );
                  })
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
   EDITOR — review of the server's plan
===================================================================== */

const formatValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (DATE_FIELDS.has(field) || /^\d{4}-\d{2}-\d{2}T/.test(String(value)))
    return formatDate(value);
  if (field === "status") return STATUS_LABELS[value] || value;
  if (field === "uploadedMemo") return fileNameOf(value);
  return String(value);
};

const PlanReview = ({ plan, borderColor }) => {
  const rowChanges = (plan.rows || []).filter((r) => r.action !== "unchanged");
  const headerChanges = plan.header?.changes || [];

  return (
    <section
      className="rounded-xl border p-4 space-y-4"
      style={{ borderColor, backgroundColor: "var(--app-surface-2)" }}
      aria-live="polite"
      aria-label="Review of changes"
    >
      <h4
        className="flex items-center gap-2 text-sm font-bold flex-wrap"
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

      {headerChanges.length > 0 && (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor, backgroundColor: "var(--app-surface)" }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-wider mb-2"
            style={{ color: "var(--app-muted)" }}
          >
            Memo
          </p>
          <ul className="space-y-1">
            {headerChanges.map((c) => (
              <li
                key={c.field}
                className="grid grid-cols-[140px_1fr] gap-2 text-xs"
              >
                <span style={{ color: "var(--app-muted)" }}>{c.label}</span>
                <span
                  className="min-w-0 break-words"
                  style={{ color: "var(--app-text)" }}
                >
                  <span style={{ color: "var(--app-muted)" }}>
                    {formatValue(c.field, c.from)}
                  </span>
                  <span className="mx-1.5">→</span>
                  <span className="font-bold">
                    {formatValue(c.field, c.to)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rowChanges.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {rowChanges.map((r) => (
            <div
              key={`${r.action}-${r.rowId || r.employee._id}`}
              className="rounded-lg border p-3"
              style={{ borderColor, backgroundColor: "var(--app-surface)" }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
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
              {r.action === "added" && r.after && (
                <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                  {fmtNum(r.after.creditedHours)}h credited ·{" "}
                  {fmtNum(r.after.forfeitedHours)}h forfeited ·{" "}
                  {STATUS_LABELS[r.after.status]}
                </p>
              )}
              {r.action === "removed" && r.before && (
                <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                  Had {fmtNum(r.before.creditedHours)}h credited,{" "}
                  {fmtNum(r.before.remainingHours)}h left
                </p>
              )}
              {r.action === "updated" && (
                <ul className="space-y-0.5 text-xs">
                  {r.changes.map((c) => (
                    <li key={c.field} style={{ color: "var(--app-text)" }}>
                      <span style={{ color: "var(--app-muted)" }}>
                        {FIELD_LABELS[c.field] || c.field}:{" "}
                      </span>
                      {formatValue(c.field, c.from)} →{" "}
                      <b>{formatValue(c.field, c.to)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {plan.balances?.length > 0 && (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor, backgroundColor: "var(--app-surface)" }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
            style={{ color: "var(--app-muted)" }}
          >
            <Scale size={12} /> CTO balances{" "}
            {plan.options?.adjustBalances ? "" : "(not applied)"}
          </p>
          <ul className="space-y-1">
            {plan.balances.map((b) => (
              <li
                key={b.employee._id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="truncate" style={{ color: "var(--app-text)" }}>
                  {b.employee.name}
                </span>
                <span
                  className="font-mono whitespace-nowrap"
                  style={{ color: "var(--app-text)" }}
                >
                  {fmtNum(b.current)}h{" "}
                  <b style={{ color: b.delta < 0 ? "#ef4444" : "#16a34a" }}>
                    {signed(b.delta)}h
                  </b>{" "}
                  →{" "}
                  <b>
                    {fmtNum(
                      plan.options?.adjustBalances
                        ? b.current + b.delta
                        : b.current,
                    )}
                    h
                  </b>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

/* =====================================================================
   EDITOR — main
===================================================================== */

const MemoEditor = ({
  creditId,
  canEdit,
  canOpenApplications,
  onDirtyChange,
  onBusyChange,
  onBack,
}) => {
  const queryClient = useQueryClient();
  const { borderColor } = useThemeColors();
  const fileInputRef = useRef(null);

  const creditQ = useQuery({
    queryKey: ["ctoCreditAdminCredit", creditId],
    queryFn: () => fetchCtoCreditAdminCreditById(creditId),
    refetchOnWindowFocus: false,
    gcTime: 0,
    retry: (count, err) => ![400, 403, 404].includes(err?.status) && count < 2,
  });
  const credit = creditQ.data?.credit || null;

  const [form, setForm] = useState(null);
  const [initialForm, setInitialForm] = useState(null);
  const [memoFile, setMemoFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState(null);
  const [problem, setProblem] = useState(null);
  const [statusNote, setStatusNote] = useState("");

  const version = credit ? `${credit._id}:${credit.updatedAt}` : "";
  useEffect(() => {
    if (!credit) return;
    const f = toForm(credit);
    setForm(f);
    setInitialForm(f);
    setMemoFile(null);
    setFileError("");
    setOptions(DEFAULT_OPTIONS);
    setReason("");
    setPlan(null);
    setProblem(null);
    setStatusNote("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = !!form && (!sameJson(form, initialForm) || !!memoFile);
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  const previewMutation = useMutation({
    mutationFn: (payload) =>
      previewCtoCreditAdminUpdate(creditId, payload, { memoFile }),
    onSuccess: (res) => setPlan(res?.plan || null),
    onError: (err) =>
      setProblem({
        message: err?.message || "Review failed.",
        details: errDetails(err),
      }),
  });
  const saveMutation = useMutation({
    mutationFn: (payload) =>
      updateCtoCreditAdmin(creditId, payload, { memoFile }),
    retry: 0,
    onSuccess: (res) => {
      toast.success(
        res?.changed ? "CTO credit memo updated." : "No changes to save.",
      );
      if (res?.credit)
        queryClient.setQueryData(["ctoCreditAdminCredit", creditId], {
          credit: res.credit,
        });
      [
        "ctoCreditAdminCredits",
        "ctoCreditAdminEmployeeBalance",
        "ctoCreditAdminEmployeeSearch",
        "ctoAdminApplications",
        "ctoAdminEmployeeBalance",
        "ctoAdminEmployeeCredits",
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

  // every change makes the last review stale
  const edit = (updater) => {
    setForm(updater);
    setPlan(null);
    setProblem(null);
  };
  const setField = (key, value) => edit((f) => ({ ...f, [key]: value }));
  const setRow = (key, field, value) =>
    edit((f) => {
      const total = memoHoursOf(f.hours, f.minutes);
      return {
        ...f,
        rows: f.rows.map((r) => {
          if (r.key !== key) return r;
          const next = { ...r, [field]: value };
          // keep credited + forfeited = memo hours when they added up before (like addCredit)
          if (
            field === "creditedHours" &&
            value !== "" &&
            round2(num(r.creditedHours) + num(r.forfeitedHours)) === total
          ) {
            next.forfeitedHours = String(
              round2(Math.max(total - num(value), 0)),
            );
          }
          return next;
        }),
      };
    });
  const removeRow = (key) =>
    edit((f) => ({ ...f, rows: f.rows.filter((r) => r.key !== key) }));
  const setOption = (key, value) => {
    setOptions((o) => ({ ...o, [key]: value }));
    setPlan(null);
    setProblem(null);
  };

  const pickFile = (file) => {
    setPlan(null);
    setProblem(null);
    if (!file) {
      setMemoFile(null);
      setFileError("");
      return;
    }
    const ext = `.${String(file.name).split(".").pop()}`.toLowerCase();
    if (!MEMO_FILE_TYPES.includes(ext)) {
      setMemoFile(null);
      setFileError("Upload a PDF, JPG or PNG file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFileError("");
    setMemoFile(file);
  };
  const clearFile = () => {
    pickFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const memoHours = form ? memoHoursOf(form.hours, form.minutes) : 0;

  const changeMemoStatus = (value) => {
    let rows = form.rows;
    let note = "";
    if (form.status === "ROLLEDBACK" && value !== "ROLLEDBACK") {
      rows = rows.map((r) =>
        r.status === "ROLLEDBACK" ? { ...r, status: "ACTIVE" } : r,
      );
      note =
        "Rolled-back employees were switched back to Active, so their hours come back. Change any you want to keep rolled back.";
    }
    if (value === "ROLLEDBACK") {
      note =
        "Every employee will be rolled back and their remaining hours removed from their CTO balance.";
    }
    setStatusNote(note);
    edit((f) => ({ ...f, status: value, rows }));
  };

  const giveEveryoneFullHours = () =>
    edit((f) => ({
      ...f,
      rows: f.rows.map((r) => ({
        ...r,
        creditedHours: String(memoHours),
        forfeitedHours: "0",
      })),
    }));

  // New rows follow addCredit: credit what CSC rules allow, forfeit the rest.
  const addEmployee = (emp) =>
    edit((f) => {
      const total = memoHoursOf(f.hours, f.minutes);
      const room = emp.room?.creditableNow;
      const credited =
        room === undefined ? total : Math.max(Math.min(total, room), 0);
      return {
        ...f,
        rows: [
          ...f.rows,
          {
            key: `new-${emp._id}`,
            _id: null,
            employee: emp,
            creditedHours: String(round2(credited)),
            usedHours: "0",
            reservedHours: "0",
            forfeitedHours: String(round2(Math.max(total - credited, 0))),
            status: "ACTIVE",
            dateCredited: "",
            original: null,
            room: emp.room || null,
            applications: null,
          },
        ],
      };
    });

  const runReview = () => {
    setProblem(null);
    previewMutation.mutate(
      buildPayload(form, initialForm, credit, options, reason),
    );
  };
  const save = () => {
    if (!plan?.valid || !plan?.hasChanges) return;
    saveMutation.mutate(
      buildPayload(form, initialForm, credit, options, reason),
    );
  };

  if (creditQ.isLoading || (!form && !creditQ.isError)) {
    return (
      <div className="p-2 space-y-3">
        <Skeleton height={14} width="40%" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height={40} />
          ))}
        </div>
        <Skeleton height={44} count={4} className="mb-2" />
      </div>
    );
  }
  if (creditQ.isError) {
    return (
      <div className="p-2">
        <Alert title="Couldn't load this credit memo">
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

  const disabled = !canEdit;
  const rowEmployeeIds = form.rows.map((r) => String(r.employee._id));
  const history = credit.adminEditHistory || [];
  const apps = credit.applications || [];
  const sameMonth =
    monthKey(form.startDate) === monthKey(initialForm.startDate);
  const numberInputClass =
    "w-full lg:w-[4.5rem] px-2 py-1.5 rounded-lg text-sm text-right font-mono outline-none border focus:border-[color:var(--accent)] disabled:opacity-60";

  const rowView = (row) => {
    const resolved = resolveRow(form.status, row);
    const o = row.original;
    const counts = resolved.status !== "ROLLEDBACK";
    const monthTotal = row.room
      ? round2(
          num(row.room.creditedThisMonth) +
            (counts ? num(row.creditedHours) : 0),
        )
      : null;
    return {
      resolved,
      name: fullName(row.employee),
      over:
        round2(num(row.usedHours) + num(row.reservedHours)) >
        num(row.creditedHours),
      overMemo: num(row.creditedHours) > memoHours && memoHours > 0,
      locked: Boolean(
        row._id &&
        ((o && (o.usedHours > 0 || o.reservedHours > 0)) ||
          row.applications?.activeCount > 0),
      ),
      remainingChanged:
        o && round2(resolved.remaining) !== round2(o.remainingHours),
      monthTotal,
      monthOver:
        sameMonth &&
        monthTotal !== null &&
        row.room &&
        monthTotal > row.room.maxMonthly,
      forfeitMismatch:
        round2(num(row.creditedHours) + num(row.forfeitedHours)) !== memoHours,
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
            ? "Can't remove: hours were already used or reserved. Change the status instead."
            : `Remove ${v.name}`
        }
        className="p-1.5 rounded-md transition-colors duration-200 ease-out disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[rgba(239,68,68,0.10)]"
        style={{ color: "#ef4444" }}
      >
        <X size={16} />
      </button>
    ) : null;

  const AppsHint = ({ row }) =>
    row.applications &&
    (row.applications.activeCount > 0 || row.applications.otherCount > 0) ? (
      <div className="text-[11px]" style={{ color: "var(--app-muted)" }}>
        Applications: {fmtNum(row.applications.reserved)}h pending ·{" "}
        {fmtNum(row.applications.used)}h approved
      </div>
    ) : null;

  const MonthInfo = ({ row, v }) =>
    row.room && sameMonth ? (
      <span
        className="text-xs font-mono"
        style={{
          color: v.monthOver ? "#d97706" : "var(--app-muted)",
          fontWeight: v.monthOver ? 700 : 500,
        }}
        title={`Credited for ${row.room.month} across all memos, including this one. Re-checked on review.`}
      >
        {fmtNum(v.monthTotal)} / {row.room.maxMonthly}
        <span className="block text-[10px] font-sans">{row.room.month}</span>
      </span>
    ) : (
      <span
        className="text-[10px]"
        style={{ color: "var(--app-muted)" }}
        title="Checked when you review"
      >
        On review
      </span>
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
        <span className="font-semibold" style={{ color: "var(--app-text)" }}>
          {credit.memoNo}
        </span>
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
        <MemoFileLink path={credit.uploadedMemo} />
      </div>

      {!canEdit && (
        <Alert tone="blue" icon={ShieldAlert} className="mt-3">
          View only — you need the <b>cto.credits_admin_edit</b> permission to
          change CTO credit memos.
        </Alert>
      )}

      {/* Memo details */}
      <SectionTitle icon={FileText}>Memo details</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Memo no." className="col-span-2">
          <input
            type="text"
            maxLength={100}
            value={form.memoNo}
            disabled={disabled}
            onChange={(e) => setField("memoNo", e.target.value)}
            className={inputClass}
            style={inputStyle(borderColor)}
          />
        </Field>
        <Field label="Status" className="col-span-2 lg:col-span-1">
          <select
            value={form.status}
            disabled={disabled}
            onChange={(e) => changeMemoStatus(e.target.value)}
            className={`${inputClass} cursor-pointer`}
            style={inputStyle(borderColor)}
          >
            {MEMO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date approved" className="col-span-2 lg:col-span-1">
          <input
            type="date"
            value={form.dateApproved}
            disabled={disabled}
            onChange={(e) => setField("dateApproved", e.target.value)}
            className={inputClass}
            style={inputStyle(borderColor)}
          />
        </Field>
        <Field label="Purpose" className="col-span-2 lg:col-span-4">
          <textarea
            rows={2}
            maxLength={1000}
            value={form.purpose}
            disabled={disabled}
            onChange={(e) => setField("purpose", e.target.value)}
            className={`${inputClass} resize-y`}
            style={inputStyle(borderColor)}
          />
        </Field>
        <Field label="Overtime start">
          <input
            type="date"
            value={form.startDate}
            disabled={disabled}
            onChange={(e) => setField("startDate", e.target.value)}
            className={inputClass}
            style={inputStyle(borderColor)}
          />
        </Field>
        <Field label="Overtime end">
          <input
            type="date"
            value={form.endDate}
            disabled={disabled}
            onChange={(e) => setField("endDate", e.target.value)}
            className={inputClass}
            style={inputStyle(borderColor)}
          />
        </Field>
        <Field
          label="Duration — hours"
          hint={`Memo total: ${formatHours(memoHours)} (max 40)`}
        >
          <input
            type="number"
            min="0"
            max="40"
            step="1"
            inputMode="numeric"
            value={form.hours}
            disabled={disabled}
            onChange={(e) => setField("hours", e.target.value)}
            className={inputClass}
            style={inputStyle(borderColor)}
          />
        </Field>
        <Field label="Duration — minutes">
          <input
            type="number"
            min="0"
            max="59"
            step="1"
            inputMode="numeric"
            value={form.minutes}
            disabled={disabled}
            onChange={(e) => setField("minutes", e.target.value)}
            className={inputClass}
            style={inputStyle(borderColor)}
          />
        </Field>
        <Field label="Date credited" className="col-span-2 lg:col-span-1">
          <input
            type="date"
            value={form.dateCredited}
            disabled={disabled}
            onChange={(e) => setField("dateCredited", e.target.value)}
            className={inputClass}
            style={inputStyle(borderColor)}
          />
        </Field>
      </div>
      {statusNote && (
        <Alert tone="blue" icon={Info} className="mt-3">
          {statusNote}
        </Alert>
      )}
      {!sameMonth && (
        <Alert tone="amber" icon={Info} className="mt-3">
          The overtime now starts in a different month. Everyone's CSC monthly
          total is re-checked for the new month when you review.
        </Alert>
      )}

      {/* Memo file */}
      <SectionTitle icon={Paperclip}>Memo file</SectionTitle>
      <div
        className="rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
        style={{ borderColor, backgroundColor: "var(--app-surface)" }}
      >
        <div className="min-w-0 text-xs" style={{ color: "var(--app-muted)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <span>Current:</span>
            <MemoFileLink path={credit.uploadedMemo} />
          </div>
          {memoFile && (
            <div
              className="mt-1 flex items-center gap-2"
              style={{ color: "var(--app-text)" }}
            >
              <FileUp size={13} style={{ color: "#16a34a" }} />
              <span className="font-semibold truncate">
                Will be replaced with {memoFile.name}
              </span>
              <button
                type="button"
                onClick={clearFile}
                className="p-0.5 rounded"
                style={{ color: "#ef4444" }}
                aria-label="Don't replace the memo file"
              >
                <X size={13} />
              </button>
            </div>
          )}
          {fileError && (
            <div className="mt-1 font-semibold" style={{ color: "#ef4444" }}>
              {fileError}
            </div>
          )}
        </div>
        {canEdit && (
          <label
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer whitespace-nowrap"
            style={TONES.accent}
          >
            <FileUp size={14} />{" "}
            {memoFile ? "Choose another file" : "Replace memo file"}
            <input
              ref={fileInputRef}
              type="file"
              accept={MEMO_FILE_TYPES.join(",")}
              className="sr-only"
              aria-label="Replace memo file"
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />
          </label>
        )}
      </div>
      <p className="text-[11px] mt-1.5" style={{ color: "var(--app-muted)" }}>
        PDF, JPG or PNG. The old file stays on the server. CTO applications that
        use this memo will link to the new file.
      </p>

      {/* Employees */}
      <SectionTitle
        icon={Users}
        right={
          canEdit && (
            <button
              type="button"
              onClick={giveEveryoneFullHours}
              disabled={!form.rows.length || memoHours <= 0}
              className="text-[11px] font-bold disabled:opacity-40"
              style={{ color: "var(--accent)" }}
            >
              Give everyone {fmtNum(memoHours)}h
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
            refDate={form.startDate}
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
          <table className="w-full min-w-[980px] text-left">
            <thead style={{ backgroundColor: "var(--app-surface-2)" }}>
              <tr
                className="text-[10px] uppercase tracking-[0.12em] font-bold"
                style={{ color: "var(--app-muted)" }}
              >
                <th className="px-4 py-3">Employee</th>
                <th className="px-1.5 py-3 text-right">Credited</th>
                <th className="px-1.5 py-3 text-right">Used</th>
                <th className="px-1.5 py-3 text-right">Reserved</th>
                <th className="px-1.5 py-3 text-right">Forfeited</th>
                <th className="px-3 py-3 text-right">Left</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Date credited</th>
                <th className="px-3 py-3">CSC month</th>
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
                        {row.room &&
                          ` · Balance ${fmtNum(row.room.balance)}/${row.room.maxBalance}h`}
                      </div>
                      <AppsHint row={row} />
                      {v.over && (
                        <div
                          className="text-[11px] font-semibold"
                          style={{ color: "#ef4444" }}
                        >
                          Used + reserved is more than credited.
                        </div>
                      )}
                      {v.overMemo && (
                        <div
                          className="text-[11px] font-semibold"
                          style={{ color: "#d97706" }}
                        >
                          More than the memo's {fmtNum(memoHours)}h.
                        </div>
                      )}
                    </td>
                    {HOUR_FIELDS.map((field) => (
                      <td
                        key={field}
                        className="px-1.5 py-3 align-middle text-right"
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          inputMode="decimal"
                          aria-label={`${FIELD_LABELS[field]} hours for ${v.name}`}
                          value={row[field]}
                          disabled={disabled}
                          onChange={(e) =>
                            setRow(row.key, field, e.target.value)
                          }
                          className={numberInputClass}
                          style={{
                            ...inputStyle(borderColor),
                            ...(field === "forfeitedHours" && v.forfeitMismatch
                              ? { borderColor: "rgba(245,158,11,0.6)" }
                              : {}),
                          }}
                          title={
                            field === "forfeitedHours" && v.forfeitMismatch
                              ? `Credited + forfeited should be ${fmtNum(memoHours)}h`
                              : undefined
                          }
                        />
                      </td>
                    ))}
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
                          was {fmtNum(row.original.remainingHours)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <select
                        value={row.status}
                        aria-label={`Status for ${v.name}`}
                        disabled={disabled || form.status === "ROLLEDBACK"}
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
                        disabled={disabled}
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
                      <MonthInfo row={row} v={v} />
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
                    {[
                      row.employee.position,
                      row.room ? `Balance ${fmtNum(row.room.balance)}h` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <AppsHint row={row} />
                </div>
                <RemoveButton row={row} v={v} />
              </div>

              <div className="grid grid-cols-4 gap-2 mt-3">
                {HOUR_FIELDS.map((field) => (
                  <label key={field} className="block min-w-0">
                    <span
                      className="block text-[10px] font-bold uppercase tracking-wide mb-1 truncate"
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
                      disabled={disabled}
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
                    disabled={disabled || form.status === "ROLLEDBACK"}
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
                    disabled={disabled}
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
                  Left{" "}
                  <b
                    className="font-mono text-sm"
                    style={{ color: "var(--app-text)" }}
                  >
                    {fmtNum(v.resolved.remaining)}
                  </b>
                  {v.remainingChanged &&
                    ` (was ${fmtNum(row.original.remainingHours)})`}
                </span>
                <MonthInfo row={row} v={v} />
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
        Left is always credited − used − reserved (0 for rolled-back employees).
        Used and reserved hours normally come from CTO applications. CSC limits:{" "}
        {credit.limits?.maxMonthly ?? 40}h a month,{" "}
        {credit.limits?.maxBalance ?? 120}h balance,{" "}
        {credit.limits?.maxMemoHours ?? 40}h per memo.
      </p>

      {canEdit && (
        <>
          <SectionTitle icon={ShieldAlert}>Save options</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <OptionToggle
              checked={options.adjustBalances}
              onChange={(v) => setOption("adjustBalances", v)}
              label="Adjust CTO balances"
              hint="Recommended. Moves each balance by the change in that employee's remaining + reserved hours."
              borderColor={borderColor}
            />
            <OptionToggle
              checked={options.overrideLimit}
              onChange={(v) => setOption("overrideLimit", v)}
              label="Override CSC limits"
              hint="Allow more than 40 hours a month, a balance above 120, or more than the memo's hours."
              tone="amber"
              borderColor={borderColor}
            />
            <OptionToggle
              checked={options.force}
              onChange={(v) => setOption("force", v)}
              label="Force"
              hint="Allow rolling back used hours and balances going below zero."
              tone="red"
              borderColor={borderColor}
            />
          </div>
          <Field
            label="Reason for change (saved in the edit log)"
            className="mt-4"
          >
            <textarea
              rows={2}
              maxLength={500}
              value={reason}
              placeholder="e.g. Correction per HR memo 2026-114"
              onChange={(e) => setReason(e.target.value)}
              className={`${inputClass} resize-y`}
              style={inputStyle(borderColor)}
            />
          </Field>

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

      {/* Applications that use this memo */}
      {apps.length > 0 && (
        <details className="mt-6 rounded-xl border" style={{ borderColor }}>
          <summary
            className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            style={{ color: "var(--app-muted)" }}
          >
            <Layers size={14} /> CTO applications using this memo ({apps.length}
            )
          </summary>
          <ul className="px-4 pb-4 space-y-2">
            {apps.map((a) => (
              <li
                key={a._id}
                className="rounded-lg border p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                style={{ borderColor, backgroundColor: "var(--app-surface-2)" }}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="font-bold"
                      style={{ color: "var(--app-text)" }}
                    >
                      {fullName(a.employee)}
                    </span>
                    <StatusBadge status={a.overallStatus} />
                    <span
                      className="font-mono"
                      style={{ color: "var(--app-muted)" }}
                    >
                      #{shortId(a._id)}
                    </span>
                  </div>
                  <div className="mt-0.5" style={{ color: "var(--app-muted)" }}>
                    {fmtNum(a.appliedHours)}h from this memo
                    {a.creditBucket ? ` (${a.creditBucket})` : ""} ·{" "}
                    {(a.inclusiveDates || []).map(formatShortDate).join(", ") ||
                      "-"}{" "}
                    · Filed {formatDate(a.createdAt)}
                  </div>
                </div>
                {canOpenApplications && (
                  <Link
                    to={`../cto-applications/${a._id}`}
                    className="inline-flex items-center gap-1 font-bold whitespace-nowrap"
                    style={{ color: "var(--accent)" }}
                  >
                    Open application <ExternalLink size={11} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Edit history */}
      {history.length > 0 && (
        <details className="mt-3 rounded-xl border" style={{ borderColor }}>
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
                    `Memo: ${h.changes.header.map((c) => c.label || c.field).join(", ")}. `}
                  {(h.changes?.rows?.length || 0) > 0 &&
                    `Employees: ${h.changes.rows.map((r) => `${r.name} (${r.action})`).join(", ")}.`}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Footer */}
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
              onClick={() => {
                edit(() => initialForm);
                setStatusNote("");
                clearFile();
              }}
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
   PAGE — EDIT  (/<ADMIN_CONSOLE_PATH>/cto-credits/:creditId)
===================================================================== */

export const CtoCreditAdminEditPage = () => {
  const { creditId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();
  const canEdit = can("cto.credits_admin_edit");
  const { borderColor, skeleton } = useThemeColors();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

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
                  className="mt-1 p-2 rounded-lg border flex-none disabled:opacity-40"
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
                    {canEdit ? "Edit CTO Credit Memo" : "CTO Credit Memo"}
                  </h1>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Memo{" "}
                    <span className="font-mono font-semibold">
                      #{shortId(creditId)}
                    </span>
                    {canEdit &&
                      " · Change any detail, review the effect on CSC limits and CTO balances, then save."}
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
                <MemoEditor
                  key={creditId}
                  creditId={creditId}
                  canEdit={canEdit}
                  canOpenApplications={can("cto.admin_view")}
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
   PAGE — LIST  (/<ADMIN_CONSOLE_PATH>/cto-credits)
===================================================================== */

const VIEWS = [
  { id: "memos", label: "Credit Memos", icon: FileText },
  { id: "employees", label: "Employee Lookup", icon: UserSearch },
];

const CtoCreditAdmin = () => {
  const { can } = usePermissions();
  const canEdit = can("cto.credits_admin_edit");
  const { borderColor, skeleton } = useThemeColors();
  const [params, updateParams] = useUrlState();
  const view = params.get("view") === "employees" ? "employees" : "memos";
  const setView = (id) =>
    updateParams({ view: id === "memos" ? undefined : id });

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
                    CTO Credit Memos
                  </h1>
                  <p
                    className="text-sm mt-1 max-w-2xl"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Find any credit memo or employee and correct every detail —
                    memo, file and who got how many hours. Each change is
                    checked against CSC limits before it's saved.
                  </p>
                </div>
                <div
                  className="inline-flex p-1 rounded-xl border w-full md:w-auto"
                  style={{ backgroundColor: "var(--app-surface)", borderColor }}
                  role="tablist"
                  aria-label="Credit memo views"
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
            {view === "memos" ? (
              <CreditMemosView canEdit={canEdit} />
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

export default CtoCreditAdmin;
