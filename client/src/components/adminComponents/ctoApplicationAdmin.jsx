// ctoApplicationAdmin.jsx
//
// Admin-only pages for CTO applications (hidden: no sidebar link).
//   • List  (/app/console/cto-applications)
//       – "Applications" tab: status chips, search, leave dates, employee type
//       – "Employee lookup" tab: stored vs. computed CTO balance (+ recalculate),
//         the employee's memos and applications
//   • Edit  (/app/console/cto-applications/:applicationId)
//       – status, hours, dates, reason, late filing, which memos the hours come from,
//         approval steps, notified employees, applicant snapshot, CSC Form 6 details
//       – review the effect on memo hours and the CTO balance, then save
//
// Uses adminCtoApplication.js. Admin edits send no emails or notifications.

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

import {
  searchCtoAdminEmployees,
  fetchCtoAdminEmployeeBalance,
  recalculateCtoAdminEmployeeBalance,
  fetchCtoAdminEmployeeCredits,
  fetchCtoAdminApplications,
  fetchCtoAdminApplicationById,
  previewCtoAdminApplicationUpdate,
  updateCtoAdminApplication,
} from "../../api/adminCtoApplication";

import { StatusBadge } from "../statusUtils";
import FilterSelect from "../filterSelect";
import FullHeightCardContainer from "../pageContainer";
import { useAuth } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";

import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Inbox,
  Layers,
  CheckCircle2,
  XCircle,
  Ban,
  Undo2,
  Hourglass,
  Users,
  UserSearch,
  CalendarDays,
  Clock,
  FileText,
  ListChecks,
  Bell,
  Wand2,
  ArrowUp,
  ArrowLeft,
  Pencil,
  Eye,
  X,
  Plus,
  Info,
  AlertTriangle,
  ShieldAlert,
  History,
  ClipboardCheck,
  Save,
  Loader2,
  RefreshCw,
  Scale,
  UserCog,
} from "lucide-react";

/* =====================================================================
   CONSTANTS & HELPERS
===================================================================== */

const pageSizeOptions = [20, 50, 100];

const APP_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "REVOCATION_REQUESTED",
  "REVOKED",
];
const STEP_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const STATUS_LABELS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  REVOCATION_REQUESTED: "Revocation Requested",
  REVOKED: "Revoked",
};
const STEP_TONE = {
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "slate",
};
const ACTION_META = {
  added: { label: "Added", tone: "green" },
  updated: { label: "Updated", tone: "blue" },
  removed: { label: "Removed", tone: "red" },
};
const DEFAULT_OPTIONS = {
  adjustCredits: true,
  adjustBalance: true,
  force: false,
};
const REJECT_REMARK =
  "Auto-cancelled: A previous approver rejected this request.";

const SNAPSHOT_TEXT = [
  "prefixTitle",
  "firstName",
  "middleName",
  "lastName",
  "nameExtension",
  "postfixTitle",
  "division",
  "position",
];
const SNAPSHOT_NUM = ["salaryGrade", "salaryAmount"];
const SNAPSHOT_LABELS = {
  prefixTitle: "Prefix title",
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Last name",
  nameExtension: "Name ext.",
  postfixTitle: "Postfix title",
  division: "Division",
  position: "Position",
  salaryGrade: "Salary grade",
  salaryAmount: "Salary amount",
};
const ACTION_NUM = ["approvedDaysWithPay", "approvedDaysWithoutPay"];
const ACTION_TEXT = ["approvedOthersSpecify", "disapprovedDueTo"];
const ACTION_LABELS = {
  approvedDaysWithPay: "Days with pay",
  approvedDaysWithoutPay: "Days without pay",
  approvedOthersSpecify: "Others (specify)",
  disapprovedDueTo: "Disapproved due to",
};
const LEAVE_KEYS = ["totalEarned", "lessThisApplication", "balance"];
const LEAVE_LABELS = {
  totalEarned: "Total earned",
  lessThisApplication: "Less this application",
  balance: "Balance",
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
  violet: {
    backgroundColor: "rgba(139,92,246,0.10)",
    borderColor: "rgba(139,92,246,0.25)",
    color: "#7c3aed",
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
const prettyRole = (role) =>
  String(role || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

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
/** "Nov 3, 2026" or "Nov 3 – Nov 5, 2026 · 3 days" */
const formatDateList = (values = []) => {
  const keys = [...new Set(values.map(toInputDate).filter(Boolean))].sort();
  if (!keys.length) return "-";
  if (keys.length === 1) return formatDate(keys[0]);
  return `${formatShortDate(keys[0])} – ${formatDate(keys[keys.length - 1])} · ${keys.length} days`;
};
const formatAny = (field, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    if (!value.length) return "none";
    return value
      .map((v) =>
        /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? formatDate(v) : String(v),
      )
      .join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field === "overallStatus" || field === "status")
    return STATUS_LABELS[value] || value;
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(value))) return formatDate(value);
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
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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

/* =====================================================================
   EDIT FORM <-> PAYLOAD
===================================================================== */

const strOf = (v) => (v === null || v === undefined ? "" : String(v));

function toForm(app) {
  const cert = app.certificationOfLeaveCredits || {};
  return {
    overallStatus: app.overallStatus || "PENDING",
    requestedHours: strOf(app.requestedHours),
    employeeType: app.employeeType || "JO",
    commutation: app.commutation || "Not Requested",
    reason: app.reason || "",
    dates: (app.inclusiveDates || [])
      .map((d) => ({ key: toInputDate(d), iso: new Date(d).toISOString() }))
      .filter((d) => d.key)
      .sort((a, b) => a.key.localeCompare(b.key)),
    lateFiling: {
      isLateFiling: Boolean(app.lateFiling?.isLateFiling),
      justification: app.lateFiling?.justification || "",
    },
    memo: (app.memo || []).map((m) => ({
      key: String(m.memoId),
      memoId: String(m.memoId),
      appliedHours: strOf(m.appliedHours),
      credit: m.credit || null,
    })),
    approvals: (app.approvals || []).map((s) => ({
      key: String(s._id),
      _id: String(s._id),
      approver: s.approverInfo || {
        _id: String(s.approver),
        fullName: "Unknown approver",
      },
      role: s.role || "",
      status: s.status || "PENDING",
      remarks: s.remarks || "",
      reviewedAt: s.reviewedAt || null,
    })),
    notified: (app.notifiedInfo || []).map((p) => ({
      _id: String(p._id),
      fullName: fullName(p),
      position: p.position,
    })),
    snapshot: Object.fromEntries(
      [...SNAPSHOT_TEXT, ...SNAPSHOT_NUM].map((k) => [
        k,
        strOf(app.applicantSnapshot?.[k]),
      ]),
    ),
    actionDetails: Object.fromEntries(
      [...ACTION_NUM, ...ACTION_TEXT].map((k) => [
        k,
        strOf(app.actionDetails?.[k]),
      ]),
    ),
    certification: {
      asOfDate: toInputDate(cert.asOfDate),
      vacationLeave: Object.fromEntries(
        LEAVE_KEYS.map((k) => [k, strOf(cert.vacationLeave?.[k])]),
      ),
      sickLeave: Object.fromEntries(
        LEAVE_KEYS.map((k) => [k, strOf(cert.sickLeave?.[k])]),
      ),
    },
    revocation: {
      requestReason: app.revocationRequest?.reason || "",
      revokeReason: app.revokeReason || "",
    },
  };
}

const numOrNull = (v) => (v === "" ? null : Number(v));
const toNumber = (v) => (v === "" ? NaN : Number(v)); // NaN → null in JSON → server error
const dayIso = (key) => (key ? localMidnight(key).toISOString() : null);

/** Only what changed is sent; the server re-checks everything anyway. */
function buildPayload(form, initial, app, options, editReason) {
  const payload = { options, expectedUpdatedAt: app.updatedAt };
  if (editReason.trim()) payload.editReason = editReason.trim();

  ["overallStatus", "employeeType", "commutation", "reason"].forEach((k) => {
    if (form[k] !== initial[k]) payload[k] = form[k];
  });
  if (form.requestedHours !== initial.requestedHours)
    payload.requestedHours = toNumber(form.requestedHours);
  if (
    !sameJson(
      form.dates.map((d) => d.iso),
      initial.dates.map((d) => d.iso),
    )
  ) {
    payload.inclusiveDates = form.dates.map((d) => d.iso);
  }
  if (!sameJson(form.lateFiling, initial.lateFiling))
    payload.lateFiling = { ...form.lateFiling };

  const memoOf = (f) => f.memo.map((m) => [m.memoId, m.appliedHours]);
  if (!sameJson(memoOf(form), memoOf(initial))) {
    payload.memo = form.memo.map((m) => ({
      memoId: m.memoId,
      appliedHours: toNumber(m.appliedHours),
    }));
  }

  const stepsOf = (f) =>
    f.approvals.map((s) => [
      s._id,
      s.approver?._id,
      s.role,
      s.status,
      s.remarks,
    ]);
  if (!sameJson(stepsOf(form), stepsOf(initial))) {
    payload.approvals = form.approvals.map((s) => ({
      ...(s._id ? { _id: s._id } : {}),
      approver: String(s.approver._id),
      role: s.role,
      status: s.status,
      remarks: s.remarks,
    }));
  }

  if (
    !sameJson(
      form.notified.map((p) => p._id),
      initial.notified.map((p) => p._id),
    )
  ) {
    payload.notifiedEmployees = form.notified.map((p) => p._id);
  }

  const snapshot = {};
  SNAPSHOT_TEXT.forEach((k) => {
    if (form.snapshot[k] !== initial.snapshot[k])
      snapshot[k] = form.snapshot[k];
  });
  SNAPSHOT_NUM.forEach((k) => {
    if (form.snapshot[k] !== initial.snapshot[k])
      snapshot[k] = numOrNull(form.snapshot[k]);
  });
  if (Object.keys(snapshot).length) payload.applicantSnapshot = snapshot;

  const action = {};
  ACTION_NUM.forEach((k) => {
    if (form.actionDetails[k] !== initial.actionDetails[k])
      action[k] = numOrNull(form.actionDetails[k]);
  });
  ACTION_TEXT.forEach((k) => {
    if (form.actionDetails[k] !== initial.actionDetails[k])
      action[k] = form.actionDetails[k];
  });
  if (Object.keys(action).length) payload.actionDetails = action;

  const cert = {};
  if (form.certification.asOfDate !== initial.certification.asOfDate) {
    cert.asOfDate = dayIso(form.certification.asOfDate);
  }
  ["vacationLeave", "sickLeave"].forEach((group) => {
    const part = {};
    LEAVE_KEYS.forEach((k) => {
      if (form.certification[group][k] !== initial.certification[group][k]) {
        part[k] = numOrNull(form.certification[group][k]);
      }
    });
    if (Object.keys(part).length) cert[group] = part;
  });
  if (Object.keys(cert).length) payload.certificationOfLeaveCredits = cert;

  const revocation = {};
  if (
    form.overallStatus === "REVOCATION_REQUESTED" &&
    form.revocation.requestReason !== initial.revocation.requestReason
  ) {
    revocation.requestReason = form.revocation.requestReason;
  }
  if (
    form.overallStatus === "REVOKED" &&
    (form.revocation.revokeReason !== initial.revocation.revokeReason ||
      initial.overallStatus !== "REVOKED")
  ) {
    revocation.revokeReason = form.revocation.revokeReason;
  }
  if (Object.keys(revocation).length) payload.revocation = revocation;

  return payload;
}

/** Make approval steps agree with the overall status (the admin can still adjust them). */
function syncStepsToStatus(steps, status) {
  if (["APPROVED", "REVOCATION_REQUESTED", "REVOKED"].includes(status)) {
    return steps.map((s) => ({ ...s, status: "APPROVED" }));
  }
  if (status === "REJECTED") {
    let rejected = steps.some((s) => s.status === "REJECTED");
    return steps.map((s) => {
      if (s.status !== "PENDING") return s;
      if (!rejected) {
        rejected = true;
        return { ...s, status: "REJECTED" };
      }
      return { ...s, status: "CANCELLED", remarks: s.remarks || REJECT_REMARK };
    });
  }
  if (status === "CANCELLED") {
    return steps.map((s) =>
      s.status === "PENDING"
        ? {
            ...s,
            status: "CANCELLED",
            remarks: s.remarks || "Cancelled by admin.",
          }
        : s,
    );
  }
  if (status === "PENDING") {
    return steps.map((s) =>
      s.status === "APPROVED" ? s : { ...s, status: "PENDING" },
    );
  }
  return steps;
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
const Field = ({ label, children, className = "" }) => {
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
    className="rounded-lg border p-2"
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

const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  borderColor,
  noun = "applications",
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

/** Opens the application on its own page and remembers this list URL for "Back". */
const EditLink = ({ applicationId, canEdit, borderColor, full = false }) => {
  const location = useLocation();
  return (
    <Link
      to={String(applicationId)}
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
   EMPLOYEE SEARCH (combobox)
===================================================================== */

const EmployeeSearch = ({
  label,
  placeholder,
  excludeIds = [],
  onSelect,
  autoFocus = false,
  compact = false,
}) => {
  const { borderColor } = useThemeColors();
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 300);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const listId = useRef(
    `cta-emp-${Math.random().toString(36).slice(2)}`,
  ).current;
  const excluded = new Set(excludeIds.map(String));

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["ctoAdminEmployeeSearch", q],
    queryFn: () => searchCtoAdminEmployees(cleanParams({ q, limit: 10 })),
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
          autoFocus={autoFocus}
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
                      {[emp.position, emp.division, emp.employeeType]
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
                      Already added
                    </span>
                  ) : (
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: "var(--app-text)" }}
                    >
                      CTO {fmtNum(emp.ctoBalance)}h
                    </span>
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
   VIEW 1 — APPLICATIONS
===================================================================== */

const STATUS_TABS = [
  { id: "", label: "All", icon: Layers, tone: "accent" },
  { id: "PENDING", label: "Pending", icon: Hourglass, tone: "amber" },
  { id: "APPROVED", label: "Approved", icon: CheckCircle2, tone: "green" },
  { id: "REJECTED", label: "Rejected", icon: XCircle, tone: "red" },
  { id: "CANCELLED", label: "Cancelled", icon: Ban, tone: "slate" },
  {
    id: "REVOCATION_REQUESTED",
    label: "Revocation Requested",
    icon: Undo2,
    tone: "violet",
  },
  { id: "REVOKED", label: "Revoked", icon: RotateCcw, tone: "red" },
];

const STRIP_CLASS = {
  PENDING: "border-l-4 border-l-amber-500",
  APPROVED: "border-l-4 border-l-emerald-500",
  REJECTED: "border-l-4 border-l-rose-500",
  CANCELLED: "border-l-4 border-l-slate-400",
  REVOCATION_REQUESTED: "border-l-4 border-l-violet-500",
  REVOKED: "border-l-4 border-l-rose-400",
};

const ApprovalProgress = ({ progress }) => {
  if (!progress?.total)
    return <span style={{ color: "var(--app-muted)" }}>-</span>;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5" aria-hidden="true">
          {Array.from({ length: progress.total }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-4 rounded-full"
              style={{
                backgroundColor:
                  i < progress.approved ? "#16a34a" : "rgba(100,116,139,0.25)",
              }}
            />
          ))}
        </div>
        <span
          className="text-[11px] font-semibold"
          style={{ color: "var(--app-text)" }}
        >
          {progress.approved}/{progress.total}
        </span>
      </div>
      {progress.waitingOn && (
        <div
          className="text-[11px] truncate mt-0.5"
          style={{ color: "var(--app-muted)" }}
        >
          Waiting on{" "}
          {progress.waitingOn.name || `level ${progress.waitingOn.level}`}
        </div>
      )}
    </div>
  );
};

const ApplicationsView = ({ canEdit }) => {
  const { borderColor } = useThemeColors();
  const [params, updateParams] = useUrlState();

  const statusFilter = params.get("status") || "";
  const searchFilter = params.get("q") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const employeeType = params.get("type") || "";
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
        "ctoAdminApplications",
        { page, limit, statusFilter, searchFilter, from, to, employeeType },
      ],
      queryFn: () =>
        fetchCtoAdminApplications(
          cleanParams({
            page,
            limit,
            status: statusFilter,
            search: searchFilter,
            from,
            to,
            employeeType,
          }),
        ),
      placeholderData: (prev) => prev,
    });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(page * limit, total);

  useEffect(() => {
    if (data && !isPlaceholderData && page > totalPages) setPage(totalPages);
  }, [data, isPlaceholderData, page, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltered = Boolean(
    statusFilter || searchFilter || from || to || employeeType,
  );
  const resetFilters = () => {
    setSearchInput("");
    updateParams({
      status: undefined,
      q: undefined,
      from: undefined,
      to: undefined,
      type: undefined,
      page: undefined,
    });
  };
  const counts = data?.statusCounts || {};

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
              placeholder="Search employee, application ID or memo no..."
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
            <Field label="Leave from">
              <input
                type="date"
                value={from}
                onChange={(e) => setFilter("from", e.target.value)}
                className={inputClass}
                style={inputStyle(borderColor)}
              />
            </Field>
            <Field label="Leave to">
              <input
                type="date"
                value={to}
                onChange={(e) => setFilter("to", e.target.value)}
                className={inputClass}
                style={inputStyle(borderColor)}
              />
            </Field>
            <Field label="Type" className="col-span-2 sm:col-span-1">
              <select
                value={employeeType}
                onChange={(e) => setFilter("type", e.target.value)}
                className={`${inputClass} cursor-pointer`}
                style={inputStyle(borderColor)}
              >
                <option value="">All</option>
                <option value="Organic">Organic</option>
                <option value="JO">JO</option>
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
              {employeeType && <Pill>{employeeType}</Pill>}
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

      <div
        className={`min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-auto cto-scrollbar transition-opacity ${isFetching && !isLoading ? "opacity-70" : ""}`}
        style={{ backgroundColor: "var(--app-bg)" }}
      >
        {isError ? (
          <div className="p-4">
            <Alert title="Couldn't load CTO applications">
              {error?.message}
            </Alert>
          </div>
        ) : !isLoading && items.length === 0 ? (
          <EmptyState
            title="No CTO Applications Found"
            borderColor={borderColor}
          >
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
                  : items.map((app) => (
                      <div
                        key={app._id}
                        className={`rounded-xl shadow-sm overflow-hidden border-y border-r ${STRIP_CLASS[app.overallStatus] || ""}`}
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
                                {fullName(
                                  app.employee || app.applicantSnapshot,
                                )}
                              </div>
                              <div
                                className="text-[11px] truncate"
                                style={{ color: "var(--app-muted)" }}
                              >
                                {[app.employee?.position, app.employeeType]
                                  .filter(Boolean)
                                  .join(" · ")}{" "}
                                ·{" "}
                                <span className="font-mono">
                                  #{shortId(app._id)}
                                </span>
                              </div>
                            </div>
                            <StatusBadge status={app.overallStatus} />
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <MiniStat
                              icon={CalendarDays}
                              label="Dates"
                              value={formatDateList(app.inclusiveDates)}
                              borderColor={borderColor}
                            />
                            <MiniStat
                              icon={Clock}
                              label="Hours"
                              value={formatHours(app.requestedHours)}
                              borderColor={borderColor}
                            />
                            <MiniStat
                              icon={FileText}
                              label="Memos"
                              value={
                                app.memos
                                  .map((m) => m.memoNo || "?")
                                  .join(", ") || "-"
                              }
                              borderColor={borderColor}
                            />
                            <MiniStat
                              icon={ListChecks}
                              label="Approvals"
                              value={
                                <ApprovalProgress
                                  progress={app.approvalProgress}
                                />
                              }
                              borderColor={borderColor}
                            />
                          </div>
                        </div>
                        <div className="border-t p-3" style={{ borderColor }}>
                          <EditLink
                            full
                            canEdit={canEdit}
                            borderColor={borderColor}
                            applicationId={app._id}
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
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
                <thead
                  className="sticky top-0 z-10 border-b"
                  style={{ backgroundColor: "var(--app-surface)", borderColor }}
                >
                  <tr
                    className="text-[10px] uppercase tracking-[0.12em] font-bold"
                    style={{ color: "var(--app-muted)" }}
                  >
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-4 py-4">Leave dates</th>
                    <th className="px-4 py-4 text-center">Hours</th>
                    <th className="px-4 py-4">Memos</th>
                    <th className="px-4 py-4">Approvals</th>
                    <th className="px-2 py-4 text-center">Status</th>
                    <th className="px-4 py-4">Filed</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? [...Array(Math.min(limit, 8))].map((_, i) => (
                        <tr key={i}>
                          {[...Array(8)].map((__, j) => (
                            <td key={j} className="px-6 py-4">
                              <Skeleton />
                            </td>
                          ))}
                        </tr>
                      ))
                    : items.map((app, i) => {
                        const bg =
                          i % 2 === 0
                            ? "var(--app-surface)"
                            : "var(--app-surface-2)";
                        return (
                          <tr
                            key={app._id}
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
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-none"
                                  style={{
                                    backgroundColor: "var(--accent-soft)",
                                    color: "var(--accent)",
                                  }}
                                >
                                  {getInitials(
                                    fullName(
                                      app.employee || app.applicantSnapshot,
                                    ),
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <div
                                    className="text-sm font-semibold truncate"
                                    style={{ color: "var(--app-text)" }}
                                  >
                                    {fullName(
                                      app.employee || app.applicantSnapshot,
                                    )}
                                  </div>
                                  <div
                                    className="text-[11px] truncate"
                                    style={{ color: "var(--app-muted)" }}
                                  >
                                    {app.employeeType} ·{" "}
                                    <span className="font-mono">
                                      #{shortId(app._id)}
                                    </span>
                                    {app.isLateFiling && " · Late filing"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td
                              className="px-4 py-4 align-middle text-sm"
                              style={{ color: "var(--app-text)" }}
                            >
                              {formatDateList(app.inclusiveDates)}
                            </td>
                            <td
                              className="px-4 py-4 align-middle text-center text-sm font-bold font-mono"
                              style={{ color: "var(--app-text)" }}
                            >
                              {fmtNum(app.requestedHours)}
                            </td>
                            <td
                              className="px-4 py-4 align-middle text-xs truncate"
                              style={{ color: "var(--app-muted)" }}
                              title={app.memos
                                .map((m) => `${m.memoNo}: ${m.appliedHours}h`)
                                .join(", ")}
                            >
                              {app.memos
                                .map((m) => m.memoNo || "?")
                                .join(", ") || "-"}
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <ApprovalProgress
                                progress={app.approvalProgress}
                              />
                            </td>
                            <td className="px-2 py-4 align-middle text-center">
                              <StatusBadge status={app.overallStatus} />
                            </td>
                            <td
                              className="px-4 py-4 align-middle text-xs"
                              style={{ color: "var(--app-muted)" }}
                            >
                              {formatDate(app.createdAt)}
                            </td>
                            <td className="px-4 py-4 align-middle text-right">
                              <EditLink
                                canEdit={canEdit}
                                borderColor={borderColor}
                                applicationId={app._id}
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
  const [picked, setPicked] = useState(null);
  const [confirmRecalc, setConfirmRecalc] = useState(false);
  const limit = 10;

  const balanceQ = useQuery({
    queryKey: ["ctoAdminEmployeeBalance", employeeId],
    queryFn: () => fetchCtoAdminEmployeeBalance(employeeId),
    enabled: !!employeeId,
  });
  const appsQ = useQuery({
    queryKey: ["ctoAdminApplications", { employeeId, page, limit }],
    queryFn: () => fetchCtoAdminApplications({ employeeId, page, limit }),
    enabled: !!employeeId,
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey?.[1]?.employeeId === employeeId ? prev : undefined,
  });
  const creditsQ = useQuery({
    queryKey: ["ctoAdminEmployeeCredits", employeeId, null],
    queryFn: () => fetchCtoAdminEmployeeCredits(employeeId),
    enabled: !!employeeId,
  });

  const recalcMutation = useMutation({
    mutationFn: () => recalculateCtoAdminEmployeeBalance(employeeId),
    onSuccess: (res) => {
      toast.success(res?.message || "CTO balance recalculated.");
      if (res?.check)
        queryClient.setQueryData(
          ["ctoAdminEmployeeBalance", employeeId],
          res.check,
        );
      setConfirmRecalc(false);
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to recalculate the CTO balance.");
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
  const items = appsQ.data?.items || [];
  const total = appsQ.data?.total || 0;
  const totalPages = appsQ.data?.totalPages || 1;
  const memos = creditsQ.data?.credits || [];

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
              See their stored CTO balance next to what their memos add up to,
              fix it if they don't match, and open any of their applications.
            </p>
          </EmptyState>
        ) : (
          <div className="p-4 md:p-6 space-y-5">
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
                        {[
                          who.position,
                          who.division,
                          who.employeeType,
                          who.email,
                        ]
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
                    label="Applications"
                    value={`${c.applications?.PENDING?.count || 0} pending`}
                    sub={`${c.applications?.APPROVED?.count || 0} approved · ${formatHours(c.applications?.APPROVED?.hours)}`}
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
                  h earned · {fmtNum(c.ledger?.remainingHours)}h remaining ·{" "}
                  {fmtNum(c.ledger?.reservedHours)}h reserved ·{" "}
                  {fmtNum(c.ledger?.usedHours)}h used
                </p>
              </>
            )}

            {/* Applications */}
            <div>
              <SectionTitle icon={Layers}>CTO applications</SectionTitle>
              {appsQ.isError && (
                <Alert title="Couldn't load applications">
                  {appsQ.error?.message}
                </Alert>
              )}
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor, backgroundColor: "var(--app-surface)" }}
              >
                {appsQ.isLoading ? (
                  <div className="p-4">
                    <Skeleton height={40} count={3} className="mb-2" />
                  </div>
                ) : items.length === 0 ? (
                  <p
                    className="p-6 text-center text-sm"
                    style={{ color: "var(--app-muted)" }}
                  >
                    This employee has no CTO applications.
                  </p>
                ) : (
                  items.map((app) => (
                    <div
                      key={app._id}
                      className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 border-b last:border-b-0"
                      style={{ borderColor }}
                    >
                      <div className="md:w-64 flex-none min-w-0">
                        <div
                          className="text-sm font-semibold"
                          style={{ color: "var(--app-text)" }}
                        >
                          {formatDateList(app.inclusiveDates)}
                        </div>
                        <div
                          className="text-[11px]"
                          style={{ color: "var(--app-muted)" }}
                        >
                          <span className="font-mono">#{shortId(app._id)}</span>{" "}
                          · Filed {formatDate(app.createdAt)}
                        </div>
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div
                            className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Hours
                          </div>
                          <div
                            className="text-sm font-semibold font-mono"
                            style={{ color: "var(--app-text)" }}
                          >
                            {fmtNum(app.requestedHours)}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Memos
                          </div>
                          <div
                            className="text-xs truncate"
                            style={{ color: "var(--app-text)" }}
                          >
                            {app.memos.map((m) => m.memoNo).join(", ") || "-"}
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <ApprovalProgress progress={app.approvalProgress} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-3 md:w-56 flex-none">
                        <StatusBadge status={app.overallStatus} />
                        <EditLink
                          canEdit={canEdit}
                          borderColor={borderColor}
                          applicationId={app._id}
                        />
                      </div>
                    </div>
                  ))
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

            {/* Memos */}
            <div>
              <SectionTitle icon={FileText}>CTO memos</SectionTitle>
              {creditsQ.isError && (
                <Alert title="Couldn't load memos">
                  {creditsQ.error?.message}
                </Alert>
              )}
              <div
                className="rounded-xl border overflow-x-auto"
                style={{ borderColor, backgroundColor: "var(--app-surface)" }}
              >
                {creditsQ.isLoading ? (
                  <div className="p-4">
                    <Skeleton height={32} count={3} className="mb-2" />
                  </div>
                ) : memos.length === 0 ? (
                  <p
                    className="p-6 text-center text-sm"
                    style={{ color: "var(--app-muted)" }}
                  >
                    No CTO memos credit this employee.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm min-w-[560px]">
                    <thead style={{ backgroundColor: "var(--app-surface-2)" }}>
                      <tr
                        className="text-[10px] uppercase tracking-[0.12em] font-bold"
                        style={{ color: "var(--app-muted)" }}
                      >
                        <th className="px-4 py-3">Memo</th>
                        <th className="px-3 py-3">Approved</th>
                        <th className="px-3 py-3 text-right">Earned</th>
                        <th className="px-3 py-3 text-right">Remaining</th>
                        <th className="px-3 py-3 text-right">Reserved</th>
                        <th className="px-3 py-3 text-right">Used</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memos.map((m) => (
                        <tr
                          key={m._id}
                          className="border-t"
                          style={{ borderColor }}
                        >
                          <td
                            className="px-4 py-2.5 font-semibold"
                            style={{ color: "var(--app-text)" }}
                          >
                            {m.memoNo || "-"}
                          </td>
                          <td
                            className="px-3 py-2.5 text-xs"
                            style={{ color: "var(--app-muted)" }}
                          >
                            {formatDate(m.dateApproved)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {fmtNum(m.row?.total)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold">
                            {fmtNum(m.row?.remaining)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {fmtNum(m.row?.reserved)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {fmtNum(m.row?.used)}
                          </td>
                          <td className="px-4 py-2.5">
                            <Pill tone={m.usable ? "green" : "slate"}>
                              {m.status || "-"}
                            </Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
   EDITOR — sub-editors
===================================================================== */

const DatesEditor = ({ dates, onChange, disabled, borderColor }) => {
  const [newDay, setNewDay] = useState("");
  const add = () => {
    if (!newDay || dates.some((d) => d.key === newDay)) return;
    // Store new days with the same time-of-day as the existing ones (browser time zone).
    const template = dates[0] ? new Date(dates[0].iso) : null;
    const offset = template
      ? template.getTime() - localMidnight(toInputDate(template)).getTime()
      : 0;
    const iso = new Date(
      localMidnight(newDay).getTime() + offset,
    ).toISOString();
    onChange(
      [...dates, { key: newDay, iso }].sort((a, b) =>
        a.key.localeCompare(b.key),
      ),
    );
    setNewDay("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {dates.map((d) => (
          <span
            key={d.key}
            className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full border text-xs font-semibold"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
              color: "var(--app-text)",
            }}
          >
            <CalendarDays size={12} style={{ color: "var(--app-muted)" }} />
            {formatDate(d.key)}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(dates.filter((x) => x.key !== d.key))}
                className="p-0.5 rounded-full hover:bg-[rgba(239,68,68,0.10)]"
                style={{ color: "#ef4444" }}
                aria-label={`Remove ${formatDate(d.key)}`}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {!dates.length && (
          <span className="text-xs" style={{ color: "#ef4444" }}>
            Add at least one date.
          </span>
        )}
      </div>
      {!disabled && (
        <div className="flex gap-2 mt-3 max-w-sm">
          <input
            type="date"
            value={newDay}
            onChange={(e) => setNewDay(e.target.value)}
            aria-label="Date to add"
            className={inputClass}
            style={inputStyle(borderColor)}
          />
          <button
            type="button"
            onClick={add}
            disabled={!newDay || dates.some((d) => d.key === newDay)}
            className="inline-flex items-center gap-1 px-3 rounded-lg border text-xs font-bold whitespace-nowrap disabled:opacity-40"
            style={TONES.accent}
          >
            <Plus size={14} /> Add date
          </button>
        </div>
      )}
    </div>
  );
};

const MemoEditor = ({
  memo,
  onChange,
  requestedHours,
  employeeId,
  applicationId,
  disabled,
  borderColor,
}) => {
  const creditsQ = useQuery({
    queryKey: ["ctoAdminEmployeeCredits", employeeId, applicationId],
    queryFn: () => fetchCtoAdminEmployeeCredits(employeeId, { applicationId }),
    enabled: !!employeeId && !disabled,
  });
  const [pickId, setPickId] = useState("");
  const allocated = round2(memo.reduce((s, m) => s + num(m.appliedHours), 0));
  const requested = num(requestedHours);
  const balanced = allocated === requested;
  const options = (creditsQ.data?.credits || []).filter(
    (c) => !memo.some((m) => m.memoId === String(c._id)),
  );

  const setHours = (memoId, value) =>
    onChange(
      memo.map((m) =>
        m.memoId === memoId ? { ...m, appliedHours: value } : m,
      ),
    );
  const add = () => {
    const credit = options.find((c) => String(c._id) === pickId);
    if (!credit) return;
    const left = round2(requested - allocated);
    const suggestion = Math.max(
      Math.min(left, credit.row?.remaining ?? left),
      0,
    );
    onChange([
      ...memo,
      {
        key: String(credit._id),
        memoId: String(credit._id),
        appliedHours: suggestion > 0 ? String(suggestion) : "",
        credit: {
          memoNo: credit.memoNo,
          status: credit.status,
          dateApproved: credit.dateApproved,
          row: credit.row,
        },
      },
    ]);
    setPickId("");
  };

  return (
    <div>
      <div
        className="rounded-xl border overflow-x-auto"
        style={{ borderColor }}
      >
        <table className="w-full text-left text-sm min-w-[560px]">
          <thead style={{ backgroundColor: "var(--app-surface-2)" }}>
            <tr
              className="text-[10px] uppercase tracking-[0.12em] font-bold"
              style={{ color: "var(--app-muted)" }}
            >
              <th className="px-4 py-3">Memo</th>
              <th className="px-3 py-3 text-right">Remaining</th>
              <th className="px-3 py-3 text-right">Reserved</th>
              <th className="px-3 py-3 text-right">Used</th>
              <th className="px-3 py-3 text-right">Hours from this memo</th>
              <th className="px-2 py-3" aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {memo.map((m) => (
              <tr
                key={m.key}
                className="border-t"
                style={{ borderColor, backgroundColor: "var(--app-surface)" }}
              >
                <td className="px-4 py-2.5">
                  <div
                    className="font-semibold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {m.credit?.memoNo || `#${shortId(m.memoId)}`}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {m.credit?.dateApproved
                      ? `Approved ${formatDate(m.credit.dateApproved)}`
                      : "Memo details unavailable"}
                    {m.credit?.status &&
                      m.credit.status !== "CREDITED" &&
                      ` · ${m.credit.status}`}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {m.credit?.row ? fmtNum(m.credit.row.remaining) : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {m.credit?.row ? fmtNum(m.credit.row.reserved) : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {m.credit?.row ? fmtNum(m.credit.row.used) : "-"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    inputMode="decimal"
                    value={m.appliedHours}
                    disabled={disabled}
                    aria-label={`Hours from memo ${m.credit?.memoNo || m.memoId}`}
                    onChange={(e) => setHours(m.memoId, e.target.value)}
                    className="w-24 px-2 py-1.5 rounded-lg text-sm text-right font-mono outline-none border focus:border-[color:var(--accent)] disabled:opacity-60"
                    style={inputStyle(borderColor)}
                  />
                </td>
                <td className="px-2 py-2.5 text-right">
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(memo.filter((x) => x.memoId !== m.memoId))
                      }
                      className="p-1.5 rounded-md hover:bg-[rgba(239,68,68,0.10)]"
                      style={{ color: "#ef4444" }}
                      aria-label={`Remove memo ${m.credit?.memoNo || m.memoId}`}
                    >
                      <X size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!memo.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-4 text-center text-xs"
                  style={{ color: "#ef4444" }}
                >
                  Add at least one memo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
        <span
          className="text-xs font-semibold"
          style={{ color: balanced ? "#16a34a" : "#d97706" }}
        >
          {balanced ? (
            <CheckCircle2 size={13} className="inline mr-1 -mt-0.5" />
          ) : (
            <AlertTriangle size={13} className="inline mr-1 -mt-0.5" />
          )}
          {fmtNum(allocated)} of {fmtNum(requested)} requested hours assigned to
          memos
        </span>
        {!disabled && (
          <div className="flex gap-2 sm:w-[26rem]">
            <select
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
              aria-label="Memo to add"
              className={`${inputClass} cursor-pointer`}
              style={inputStyle(borderColor)}
              disabled={creditsQ.isLoading}
            >
              <option value="">
                {creditsQ.isLoading
                  ? "Loading memos…"
                  : options.length
                    ? "Add hours from another memo…"
                    : "No other memos"}
              </option>
              {options.map((c) => (
                <option key={c._id} value={c._id} disabled={!c.usable}>
                  {c.memoNo || shortId(c._id)} · {fmtNum(c.row?.remaining)}h
                  left · {formatDate(c.dateApproved)}
                  {!c.usable ? ` · ${c.status}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={add}
              disabled={!pickId}
              className="inline-flex items-center gap-1 px-3 rounded-lg border text-xs font-bold whitespace-nowrap disabled:opacity-40"
              style={TONES.accent}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const StepsEditor = ({
  steps,
  onChange,
  roles,
  applicantId,
  disabled,
  borderColor,
}) => {
  const [replacing, setReplacing] = useState(null);
  const update = (key, patch) =>
    onChange(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const move = (index, dir) => {
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    onChange(next);
  };
  const usedIds = steps.map((s) => String(s.approver?._id));

  return (
    <div className="space-y-2">
      {steps.map((s, index) => (
        <div
          key={s.key}
          className="rounded-xl border p-3"
          style={{
            borderColor,
            backgroundColor: "var(--app-surface)",
            boxShadow: !s._id ? "inset 3px 0 0 var(--accent)" : undefined,
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-3 lg:w-64 flex-none min-w-0">
              <span
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-none"
                style={TONES.accent}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--app-text)" }}
                  >
                    {fullName(s.approver)}
                  </span>
                  {!s._id && <Pill tone="green">New</Pill>}
                </div>
                <div
                  className="text-[11px] truncate"
                  style={{ color: "var(--app-muted)" }}
                >
                  {[
                    s.approver?.position,
                    s.reviewedAt && s.status !== "PENDING"
                      ? `Reviewed ${formatDateTime(s.reviewedAt)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {String(s.approver?._id) === String(applicantId) && (
                  <div
                    className="text-[11px] font-semibold"
                    style={{ color: "#d97706" }}
                  >
                    This is the applicant.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] gap-2 flex-1">
              <select
                value={s.role}
                disabled={disabled}
                aria-label={`Role for approver ${index + 1}`}
                onChange={(e) => update(s.key, { role: e.target.value })}
                className="px-2 py-1.5 rounded-lg text-xs font-semibold border outline-none cursor-pointer disabled:opacity-60"
                style={inputStyle(borderColor)}
              >
                {!roles.includes(s.role) && (
                  <option value={s.role}>
                    {s.role ? prettyRole(s.role) : "Pick a role"}
                  </option>
                )}
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {prettyRole(r)}
                  </option>
                ))}
              </select>
              <select
                value={s.status}
                disabled={disabled}
                aria-label={`Status for approver ${index + 1}`}
                onChange={(e) => update(s.key, { status: e.target.value })}
                className="px-2 py-1.5 rounded-lg text-xs font-semibold border outline-none cursor-pointer disabled:opacity-60"
                style={{
                  ...inputStyle(borderColor),
                  ...(TONES[STEP_TONE[s.status]]
                    ? { color: TONES[STEP_TONE[s.status]].color }
                    : {}),
                }}
              >
                {STEP_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={s.remarks}
                disabled={disabled}
                maxLength={1000}
                placeholder="Remarks"
                aria-label={`Remarks for approver ${index + 1}`}
                onChange={(e) => update(s.key, { remarks: e.target.value })}
                className="col-span-2 lg:col-span-1 px-2 py-1.5 rounded-lg text-xs border outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
                style={inputStyle(borderColor)}
              />
            </div>

            {!disabled && (
              <div className="flex items-center gap-1 flex-none self-end lg:self-auto">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="p-1.5 rounded-md disabled:opacity-25"
                  style={{ color: "var(--app-muted)" }}
                  aria-label={`Move approver ${index + 1} up`}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === steps.length - 1}
                  className="p-1.5 rounded-md disabled:opacity-25"
                  style={{ color: "var(--app-muted)" }}
                  aria-label={`Move approver ${index + 1} down`}
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReplacing(replacing === s.key ? null : s.key)
                  }
                  className="p-1.5 rounded-md"
                  style={{ color: "var(--app-muted)" }}
                  aria-label={`Change approver ${index + 1}`}
                  title="Change approver"
                >
                  <UserCog size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(steps.filter((x) => x.key !== s.key))}
                  disabled={steps.length === 1}
                  className="p-1.5 rounded-md hover:bg-[rgba(239,68,68,0.10)] disabled:opacity-25"
                  style={{ color: "#ef4444" }}
                  aria-label={`Remove approver ${index + 1}`}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          {replacing === s.key && (
            <div className="mt-3">
              <EmployeeSearch
                autoFocus
                compact
                placeholder={`Replace ${fullName(s.approver)} with…`}
                excludeIds={usedIds}
                onSelect={(emp) => {
                  update(s.key, { approver: emp });
                  setReplacing(null);
                }}
              />
            </div>
          )}
        </div>
      ))}

      {!disabled && (
        <EmployeeSearch
          placeholder="Add an approver — search by name, position or division..."
          excludeIds={usedIds}
          onSelect={(emp) =>
            onChange([
              ...steps,
              {
                key: `new-${emp._id}-${Date.now()}`,
                _id: null,
                approver: emp,
                role: roles[Math.min(steps.length, roles.length - 1)] || "",
                status: "PENDING",
                remarks: "",
                reviewedAt: null,
              },
            ])
          }
        />
      )}
    </div>
  );
};

const NotifiedEditor = ({
  notified,
  onChange,
  excludeIds,
  disabled,
  borderColor,
}) => (
  <div>
    <div className="flex flex-wrap gap-2">
      {notified.map((p) => (
        <span
          key={p._id}
          className="inline-flex items-center gap-1.5 pl-0.5 pr-1.5 py-0.5 rounded-full border text-xs font-medium"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor,
            color: "var(--app-text)",
          }}
        >
          <span
            className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{
              backgroundColor: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            {getInitials(p.fullName)}
          </span>
          {p.fullName}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(notified.filter((x) => x._id !== p._id))}
              className="p-0.5 rounded-full"
              style={{ color: "#ef4444" }}
              aria-label={`Remove ${p.fullName}`}
            >
              <X size={12} />
            </button>
          )}
        </span>
      ))}
      {!notified.length && (
        <span className="text-xs" style={{ color: "var(--app-muted)" }}>
          Nobody else is notified.
        </span>
      )}
    </div>
    {!disabled && (
      <div className="mt-3">
        <EmployeeSearch
          placeholder="Notify someone else…"
          excludeIds={[...excludeIds, ...notified.map((p) => p._id)]}
          onSelect={(emp) =>
            onChange([
              ...notified,
              {
                _id: String(emp._id),
                fullName: fullName(emp),
                position: emp.position,
              },
            ])
          }
        />
      </div>
    )}
  </div>
);

/* =====================================================================
   EDITOR — review of the server's plan
===================================================================== */

const PlanReview = ({ plan, borderColor }) => {
  const memoMoves = (plan.memo || []).filter(
    (m) =>
      m.action !== "unchanged" ||
      (m.credit &&
        ["remaining", "reserved", "used"].some(
          (k) => m.credit.before[k] !== m.credit.after[k],
        )),
  );
  const stepChanges = (plan.steps || []).filter(
    (s) => s.action !== "unchanged",
  );
  const fields = (plan.fields || []).filter((f) => f.field !== "memo");

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

      {fields.length > 0 && (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor, backgroundColor: "var(--app-surface)" }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-wider mb-2"
            style={{ color: "var(--app-muted)" }}
          >
            Application
          </p>
          <ul className="space-y-1">
            {fields.map((f) => (
              <li
                key={f.field}
                className="grid grid-cols-[150px_1fr] gap-2 text-xs"
              >
                <span style={{ color: "var(--app-muted)" }}>{f.label}</span>
                <span style={{ color: "var(--app-text)" }}>
                  <span style={{ color: "var(--app-muted)" }}>
                    {formatAny(f.field, f.from)}
                  </span>
                  <span className="mx-1.5">→</span>
                  <span className="font-bold">{formatAny(f.field, f.to)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {memoMoves.length > 0 && (
        <div
          className="rounded-lg border overflow-x-auto"
          style={{ borderColor, backgroundColor: "var(--app-surface)" }}
        >
          <p
            className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5"
            style={{ color: "var(--app-muted)", borderColor }}
          >
            <FileText size={12} /> Memo hours{" "}
            {plan.options?.adjustCredits ? "" : "(not applied)"}
          </p>
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr style={{ color: "var(--app-muted)" }}>
                <th className="text-left px-3 py-2 font-semibold">Memo</th>
                <th className="text-right px-3 py-2 font-semibold">
                  This application
                </th>
                <th className="text-right px-3 py-2 font-semibold">
                  Remaining
                </th>
                <th className="text-right px-3 py-2 font-semibold">Reserved</th>
                <th className="text-right px-3 py-2 font-semibold">Used</th>
              </tr>
            </thead>
            <tbody>
              {memoMoves.map((m) => {
                const cell = (k) =>
                  m.credit ? (
                    m.credit.before[k] === m.credit.after[k] ? (
                      <span style={{ color: "var(--app-muted)" }}>
                        {fmtNum(m.credit.after[k])}
                      </span>
                    ) : (
                      <>
                        <span style={{ color: "var(--app-muted)" }}>
                          {fmtNum(m.credit.before[k])}
                        </span>{" "}
                        →{" "}
                        <b style={{ color: "var(--app-text)" }}>
                          {fmtNum(m.credit.after[k])}
                        </b>
                      </>
                    )
                  ) : (
                    "-"
                  );
                return (
                  <tr
                    key={m.memoId}
                    className="border-t"
                    style={{ borderColor }}
                  >
                    <td
                      className="px-3 py-2"
                      style={{ color: "var(--app-text)" }}
                    >
                      <span className="font-semibold">{m.memoNo}</span>{" "}
                      {m.action !== "unchanged" && (
                        <Pill tone={ACTION_META[m.action]?.tone}>
                          {ACTION_META[m.action]?.label}
                        </Pill>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {m.fromHours === m.toHours
                        ? fmtNum(m.toHours)
                        : `${fmtNum(m.fromHours)} → ${fmtNum(m.toHours)}`}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {cell("remaining")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {cell("reserved")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {cell("used")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {stepChanges.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {stepChanges.map((s) => (
            <div
              key={`${s.action}-${s.stepId || s.approver._id}-${s.level}`}
              className="rounded-lg border p-3"
              style={{ borderColor, backgroundColor: "var(--app-surface)" }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--app-text)" }}
                >
                  Level {s.level} · {s.approver.name}
                </span>
                <Pill tone={ACTION_META[s.action]?.tone}>
                  {ACTION_META[s.action]?.label}
                </Pill>
              </div>
              {s.action === "added" && (
                <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                  {prettyRole(s.role)} · {STATUS_LABELS[s.status]}
                </p>
              )}
              {s.action === "updated" && (
                <ul className="space-y-0.5 text-xs">
                  {s.changes.map((c) => (
                    <li key={c.field} style={{ color: "var(--app-text)" }}>
                      <span style={{ color: "var(--app-muted)" }}>
                        {c.field}:{" "}
                      </span>
                      {formatAny(
                        c.field,
                        c.field === "role" ? prettyRole(c.from) : c.from,
                      )}{" "}
                      →{" "}
                      <b>
                        {formatAny(
                          c.field,
                          c.field === "role" ? prettyRole(c.to) : c.to,
                        )}
                      </b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {plan.balance && (
        <div
          className="rounded-lg border p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs"
          style={{ borderColor, backgroundColor: "var(--app-surface)" }}
        >
          <span
            className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]"
            style={{ color: "var(--app-muted)" }}
          >
            <Scale size={12} /> CTO balance{" "}
            {plan.balance.applied ? "" : "(not applied)"}
          </span>
          <span style={{ color: "var(--app-text)" }}>
            {fmtNum(plan.balance.current)}h{" "}
            <b
              style={{ color: plan.balance.delta < 0 ? "#ef4444" : "#16a34a" }}
            >
              {signed(plan.balance.delta)}h
            </b>{" "}
            → <b>{fmtNum(plan.balance.after)}h</b>
          </span>
        </div>
      )}
    </section>
  );
};

/* =====================================================================
   EDITOR — main
===================================================================== */

const ApplicationEditor = ({
  applicationId,
  canEdit,
  onDirtyChange,
  onBusyChange,
  onBack,
}) => {
  const queryClient = useQueryClient();
  const { borderColor } = useThemeColors();

  const appQ = useQuery({
    queryKey: ["ctoAdminApplication", applicationId],
    queryFn: () => fetchCtoAdminApplicationById(applicationId),
    refetchOnWindowFocus: false,
    gcTime: 0,
    retry: (count, err) => ![400, 403, 404].includes(err?.status) && count < 2,
  });
  const app = appQ.data?.application || null;

  const [form, setForm] = useState(null);
  const [initialForm, setInitialForm] = useState(null);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [editReason, setEditReason] = useState("");
  const [plan, setPlan] = useState(null);
  const [problem, setProblem] = useState(null);

  const version = app ? `${app._id}:${app.updatedAt}` : "";
  useEffect(() => {
    if (!app) return;
    const f = toForm(app);
    setForm(f);
    setInitialForm(f);
    setOptions(DEFAULT_OPTIONS);
    setEditReason("");
    setPlan(null);
    setProblem(null);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = !!form && !sameJson(form, initialForm);
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  const previewMutation = useMutation({
    mutationFn: (payload) =>
      previewCtoAdminApplicationUpdate(applicationId, payload),
    onSuccess: (res) => setPlan(res?.plan || null),
    onError: (err) =>
      setProblem({
        message: err?.message || "Review failed.",
        details: errDetails(err),
      }),
  });
  const saveMutation = useMutation({
    mutationFn: (payload) => updateCtoAdminApplication(applicationId, payload),
    retry: 0,
    onSuccess: (res) => {
      toast.success(
        res?.changed ? "CTO application updated." : "No changes to save.",
      );
      if (res?.application)
        queryClient.setQueryData(["ctoAdminApplication", applicationId], {
          application: res.application,
        });
      [
        "ctoAdminApplications",
        "ctoAdminEmployeeBalance",
        "ctoAdminEmployeeCredits",
        "allCtoApplications",
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
  const setNested = (group, key, value) =>
    edit((f) => ({ ...f, [group]: { ...f[group], [key]: value } }));
  const setOption = (key, value) => {
    setOptions((o) => ({ ...o, [key]: value }));
    setPlan(null);
    setProblem(null);
  };

  const runReview = () => {
    setProblem(null);
    previewMutation.mutate(
      buildPayload(form, initialForm, app, options, editReason),
    );
  };
  const save = () => {
    if (!plan?.valid || !plan?.hasChanges) return;
    saveMutation.mutate(
      buildPayload(form, initialForm, app, options, editReason),
    );
  };

  if (appQ.isLoading || (!form && !appQ.isError)) {
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
  if (appQ.isError) {
    return (
      <div className="p-2">
        <Alert title="Couldn't load this CTO application">
          <p>{appQ.error?.message}</p>
          <div className="mt-2 flex gap-4">
            <button
              type="button"
              className="underline font-bold"
              onClick={() => appQ.refetch()}
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
  const rule = app.hoursRule || {};
  const bucket = rule.byStatus?.[form.overallStatus] ?? null;
  const deducts = (rule.deductingStatuses || []).includes(form.overallStatus);
  const statusChanged = form.overallStatus !== initialForm.overallStatus;
  const approverIds = form.approvals.map((s) => String(s.approver?._id));
  const isOrganic = form.employeeType === "Organic";
  const history = app.adminEditHistory || [];
  const roles = app.approvalRoles || [];

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
          #{shortId(app._id)}
        </span>
        <StatusBadge status={app.overallStatus} />
        <span className="font-semibold" style={{ color: "var(--app-text)" }}>
          {fullName(app.employeeInfo || app.applicantSnapshot)}
        </span>
        {app.employeeInfo && (
          <span>CTO balance {formatHours(app.employeeInfo.ctoBalance)}</span>
        )}
        <span>Filed {formatDateTime(app.createdAt)}</span>
        <span>Updated {formatDateTime(app.updatedAt)}</span>
        {app.revokedAt && (
          <span>
            Revoked {formatDateTime(app.revokedAt)}
            {app.revokedByInfo && ` by ${fullName(app.revokedByInfo)}`}
          </span>
        )}
      </div>

      {!canEdit && (
        <Alert tone="blue" icon={ShieldAlert} className="mt-3">
          View only — you need the <b>cto.admin_edit</b> permission to change
          CTO applications.
        </Alert>
      )}
      {app.overlaps?.length > 0 && (
        <Alert
          tone="amber"
          className="mt-3"
          title="Same dates as another CTO application"
        >
          {app.overlaps.map((o) => (
            <div key={o._id}>
              #{shortId(o._id)} ({STATUS_LABELS[o.overallStatus]},{" "}
              {formatHours(o.requestedHours)}) on{" "}
              {o.sharedDates.map(formatDate).join(", ")}
            </div>
          ))}
        </Alert>
      )}

      {/* Status & hours */}
      <SectionTitle icon={Clock}>Status &amp; hours</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Status" className="col-span-2 lg:col-span-1">
          <select
            value={form.overallStatus}
            disabled={disabled}
            onChange={(e) => setField("overallStatus", e.target.value)}
            className={`${inputClass} cursor-pointer`}
            style={inputStyle(borderColor)}
          >
            {APP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Requested hours">
          <input
            type="number"
            min="1"
            step="1"
            inputMode="decimal"
            value={form.requestedHours}
            disabled={disabled}
            onChange={(e) => setField("requestedHours", e.target.value)}
            className={inputClass}
            style={inputStyle(borderColor)}
          />
        </Field>
        <Field label="Employee type">
          <select
            value={form.employeeType}
            disabled={disabled}
            onChange={(e) => setField("employeeType", e.target.value)}
            className={`${inputClass} cursor-pointer`}
            style={inputStyle(borderColor)}
          >
            <option value="JO">JO</option>
            <option value="Organic">Organic</option>
          </select>
        </Field>
        <Field label="Commutation" className="col-span-2 lg:col-span-1">
          <select
            value={form.commutation}
            disabled={disabled}
            onChange={(e) => setField("commutation", e.target.value)}
            className={`${inputClass} cursor-pointer`}
            style={inputStyle(borderColor)}
          >
            <option value="Not Requested">Not Requested</option>
            <option value="Requested">Requested</option>
          </select>
        </Field>
      </div>
      <Alert
        tone={statusChanged ? "blue" : "slate"}
        icon={Info}
        className="mt-3"
      >
        {STATUS_LABELS[form.overallStatus]}: this application's hours are{" "}
        <b>
          {bucket === "reserved"
            ? "reserved on its memos"
            : bucket === "used"
              ? "used on its memos"
              : "given back to its memos"}
        </b>
        {deducts
          ? " and deducted from the CTO balance."
          : " and not deducted from the CTO balance."}
        {statusChanged && canEdit && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span>Approval steps don't change on their own.</span>
            <button
              type="button"
              onClick={() =>
                setField(
                  "approvals",
                  syncStepsToStatus(form.approvals, form.overallStatus),
                )
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border font-bold"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "currentColor",
              }}
            >
              <Wand2 size={12} /> Make steps match
            </button>
          </div>
        )}
      </Alert>
      {form.overallStatus === "REVOCATION_REQUESTED" && (
        <Field label="Revocation request reason" className="mt-3">
          <textarea
            rows={2}
            maxLength={1000}
            value={form.revocation.requestReason}
            disabled={disabled}
            onChange={(e) =>
              setNested("revocation", "requestReason", e.target.value)
            }
            placeholder="Why the employee asked to revoke it"
            className={`${inputClass} resize-y`}
            style={inputStyle(borderColor)}
          />
        </Field>
      )}
      {form.overallStatus === "REVOKED" && (
        <Field label="Revoke reason" className="mt-3">
          <textarea
            rows={2}
            maxLength={1000}
            value={form.revocation.revokeReason}
            disabled={disabled}
            onChange={(e) =>
              setNested("revocation", "revokeReason", e.target.value)
            }
            placeholder="Revoked by admin."
            className={`${inputClass} resize-y`}
            style={inputStyle(borderColor)}
          />
        </Field>
      )}

      {/* Dates & reason */}
      <SectionTitle icon={CalendarDays}>Leave dates &amp; reason</SectionTitle>
      <DatesEditor
        dates={form.dates}
        disabled={disabled}
        borderColor={borderColor}
        onChange={(dates) => setField("dates", dates)}
      />
      <Field label="Reason" className="mt-4">
        <textarea
          rows={2}
          maxLength={1000}
          value={form.reason}
          disabled={disabled}
          onChange={(e) => setField("reason", e.target.value)}
          className={`${inputClass} resize-y`}
          style={inputStyle(borderColor)}
        />
      </Field>
      <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr]">
        <OptionToggle
          checked={form.lateFiling.isLateFiling}
          onChange={(v) =>
            !disabled && setNested("lateFiling", "isLateFiling", v)
          }
          label="Late filing"
          hint="Filed with less lead time than required."
          tone="amber"
          borderColor={borderColor}
        />
        {form.lateFiling.isLateFiling && (
          <Field label="Late filing justification">
            <textarea
              rows={2}
              maxLength={1000}
              value={form.lateFiling.justification}
              disabled={disabled}
              onChange={(e) =>
                setNested("lateFiling", "justification", e.target.value)
              }
              className={`${inputClass} resize-y`}
              style={inputStyle(borderColor)}
            />
          </Field>
        )}
      </div>

      {/* Memos */}
      <SectionTitle icon={FileText}>Where the hours come from</SectionTitle>
      <MemoEditor
        memo={form.memo}
        onChange={(memo) => setField("memo", memo)}
        requestedHours={form.requestedHours}
        employeeId={app.employee}
        applicationId={app._id}
        disabled={disabled}
        borderColor={borderColor}
      />

      {/* Approvals */}
      <SectionTitle
        icon={ListChecks}
        right={
          canEdit && (
            <button
              type="button"
              onClick={() =>
                setField(
                  "approvals",
                  syncStepsToStatus(form.approvals, form.overallStatus),
                )
              }
              className="inline-flex items-center gap-1 text-[11px] font-bold"
              style={{ color: "var(--accent)" }}
            >
              <Wand2 size={12} /> Match status
            </button>
          )
        }
      >
        Approval steps ({form.approvals.length})
      </SectionTitle>
      <StepsEditor
        steps={form.approvals}
        onChange={(approvals) => setField("approvals", approvals)}
        roles={roles}
        applicantId={app.employee}
        disabled={disabled}
        borderColor={borderColor}
      />

      {/* Notified */}
      <SectionTitle icon={Bell}>Also notified</SectionTitle>
      <NotifiedEditor
        notified={form.notified}
        onChange={(notified) => setField("notified", notified)}
        excludeIds={[String(app.employee), ...approverIds]}
        disabled={disabled}
        borderColor={borderColor}
      />

      {/* Snapshot */}
      <details
        className="mt-7 rounded-xl border group"
        style={{ borderColor }}
        open={
          isOrganic &&
          (!form.snapshot.salaryGrade || !form.snapshot.salaryAmount)
        }
      >
        <summary
          className="cursor-pointer px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] flex items-center gap-2"
          style={{ color: "var(--app-muted)" }}
        >
          <Users size={14} /> Applicant details on this application
        </summary>
        <div className="px-4 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {SNAPSHOT_TEXT.map((k) => (
            <Field
              key={k}
              label={SNAPSHOT_LABELS[k]}
              className={
                ["division", "position"].includes(k) ? "col-span-2" : ""
              }
            >
              <input
                type="text"
                value={form.snapshot[k]}
                disabled={disabled}
                onChange={(e) => setNested("snapshot", k, e.target.value)}
                className={inputClass}
                style={inputStyle(borderColor)}
              />
            </Field>
          ))}
          {SNAPSHOT_NUM.map((k) => (
            <Field
              key={k}
              label={`${SNAPSHOT_LABELS[k]}${isOrganic ? " *" : ""}`}
            >
              <input
                type="number"
                min="0"
                value={form.snapshot[k]}
                disabled={disabled}
                onChange={(e) => setNested("snapshot", k, e.target.value)}
                className={inputClass}
                style={inputStyle(borderColor)}
              />
            </Field>
          ))}
        </div>
      </details>

      {/* CSC Form 6 (Organic) */}
      {(isOrganic || app.certificationOfLeaveCredits || app.actionDetails) && (
        <details className="mt-3 rounded-xl border" style={{ borderColor }}>
          <summary
            className="cursor-pointer px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] flex items-center gap-2"
            style={{ color: "var(--app-muted)" }}
          >
            <FileText size={14} /> CSC Form 6 details
          </summary>
          <div className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Leave credits as of">
                <input
                  type="date"
                  value={form.certification.asOfDate}
                  disabled={disabled}
                  onChange={(e) =>
                    setNested("certification", "asOfDate", e.target.value)
                  }
                  className={inputClass}
                  style={inputStyle(borderColor)}
                />
              </Field>
            </div>
            {[
              ["vacationLeave", "Vacation leave"],
              ["sickLeave", "Sick leave"],
            ].map(([group, title]) => (
              <div key={group}>
                <p
                  className={fieldLabelClass}
                  style={{ color: "var(--app-text)" }}
                >
                  {title}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {LEAVE_KEYS.map((k) => (
                    <Field key={k} label={LEAVE_LABELS[k]}>
                      <input
                        type="number"
                        step="0.001"
                        value={form.certification[group][k]}
                        disabled={disabled}
                        onChange={(e) =>
                          edit((f) => ({
                            ...f,
                            certification: {
                              ...f.certification,
                              [group]: {
                                ...f.certification[group],
                                [k]: e.target.value,
                              },
                            },
                          }))
                        }
                        className={inputClass}
                        style={inputStyle(borderColor)}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              {[...ACTION_NUM, ...ACTION_TEXT].map((k) => (
                <Field key={k} label={ACTION_LABELS[k]}>
                  <input
                    type={ACTION_NUM.includes(k) ? "number" : "text"}
                    min={ACTION_NUM.includes(k) ? "0" : undefined}
                    value={form.actionDetails[k]}
                    disabled={disabled}
                    onChange={(e) =>
                      setNested("actionDetails", k, e.target.value)
                    }
                    className={inputClass}
                    style={inputStyle(borderColor)}
                  />
                </Field>
              ))}
            </div>
          </div>
        </details>
      )}

      {canEdit && (
        <>
          <SectionTitle icon={ShieldAlert}>Save options</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <OptionToggle
              checked={options.adjustCredits}
              onChange={(v) => setOption("adjustCredits", v)}
              label="Move memo hours"
              hint="Recommended. Reserves, uses or gives back hours on the memos to match the changes."
              borderColor={borderColor}
            />
            <OptionToggle
              checked={options.adjustBalance}
              onChange={(v) => setOption("adjustBalance", v)}
              label="Adjust CTO balance"
              hint="Recommended. Deducts or restores hours on the employee's CTO balance."
              borderColor={borderColor}
            />
            <OptionToggle
              checked={options.force}
              onChange={(v) => setOption("force", v)}
              label="Force"
              hint="Allow breaking CSC hour rules, overlapping dates, a negative balance or fixing broken memo data."
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
              value={editReason}
              placeholder="e.g. Correction per HR memo 2026-114"
              onChange={(e) => setEditReason(e.target.value)}
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
                  onClick={() => appQ.refetch()}
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

      {/* History */}
      {(history.length > 0 || app.revocationHistory?.length > 0) && (
        <details className="mt-6 rounded-xl border" style={{ borderColor }}>
          <summary
            className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            style={{ color: "var(--app-muted)" }}
          >
            <History size={14} /> History (
            {history.length + (app.revocationHistory?.length || 0)})
          </summary>
          <ul className="px-4 pb-4 space-y-2">
            {history.map((h) => (
              <li
                key={h._id || h.editedAt}
                className="rounded-lg border p-3 text-xs"
                style={{ borderColor, backgroundColor: "var(--app-surface-2)" }}
              >
                <div className="flex flex-wrap items-center gap-x-2">
                  <Pill tone="blue">Admin edit</Pill>
                  <span
                    className="font-bold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {fullName(h.editedBy)}
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
                  {(h.changes?.fields || [])
                    .map((f) => f.label || f.field)
                    .join(", ")}
                  {h.changes?.steps?.length
                    ? ` · ${h.changes.steps.length} approval step change(s)`
                    : ""}
                  {h.changes?.balance
                    ? ` · balance ${signed(h.changes.balance.delta)}h`
                    : ""}
                </p>
              </li>
            ))}
            {(app.revocationHistory || []).map((h, i) => (
              <li
                key={`rev-${i}`}
                className="rounded-lg border p-3 text-xs"
                style={{ borderColor, backgroundColor: "var(--app-surface-2)" }}
              >
                <div className="flex flex-wrap items-center gap-x-2">
                  <Pill tone="violet">
                    Revocation {String(h.status || "").toLowerCase()}
                  </Pill>
                  <span style={{ color: "var(--app-muted)" }}>
                    {formatDateTime(h.processedAt)}
                  </span>
                  {h.processedByInfo && (
                    <span style={{ color: "var(--app-text)" }}>
                      by {fullName(h.processedByInfo)}
                    </span>
                  )}
                </div>
                {h.reason && (
                  <p className="mt-1" style={{ color: "var(--app-text)" }}>
                    Request: “{h.reason}”
                  </p>
                )}
                {h.remarks && (
                  <p className="mt-0.5" style={{ color: "var(--app-muted)" }}>
                    {h.remarks}
                  </p>
                )}
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
              onClick={() => edit(() => initialForm)}
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
   PAGE — EDIT  (/app/console/cto-applications/:applicationId)
===================================================================== */

export const CtoApplicationAdminEditPage = () => {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();
  const canEdit = can("cto.admin_edit");
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
                    {canEdit ? "Edit CTO Application" : "CTO Application"}
                  </h1>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Application{" "}
                    <span className="font-mono font-semibold">
                      #{shortId(applicationId)}
                    </span>
                    {canEdit &&
                      " · Change any detail, review the effect on memos and the CTO balance, then save."}
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
                <ApplicationEditor
                  key={applicationId}
                  applicationId={applicationId}
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
   PAGE — LIST  (/app/console/cto-applications)
===================================================================== */

const VIEWS = [
  { id: "applications", label: "Applications", icon: Layers },
  { id: "employees", label: "Employee Lookup", icon: UserSearch },
];

const CtoApplicationAdmin = () => {
  const { can } = usePermissions();
  const canEdit = can("cto.admin_edit");
  const { borderColor, skeleton } = useThemeColors();
  const [params, updateParams] = useUrlState();
  const view =
    params.get("view") === "employees" ? "employees" : "applications";
  const setView = (id) =>
    updateParams({ view: id === "applications" ? undefined : id });

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
                    CTO Application Admin
                  </h1>
                  <p
                    className="text-sm mt-1 max-w-2xl"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Find any CTO application or employee and correct every
                    detail. Each change is reviewed before it's saved.
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
            {view === "applications" ? (
              <ApplicationsView canEdit={canEdit} />
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

export default CtoApplicationAdmin;
