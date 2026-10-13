// myCtoApplications.jsx
import {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "../../statusUtils";
import FullHeightCardContainer from "../../pageContainer";

import {
  fetchMyCtoApplications,
  fetchMyCreditRequests,
  cancelCtoApplicationRequest,
  followUpCtoApplicationRequest,
  requestRevocation,
  cancelRevocationCtoRequest,
} from "../../../api/cto";

import { fetchRevocationSettings } from "../../../api/revocationApprover";

import Modal from "../../modal";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import Breadcrumbs from "../../breadCrumbs";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  Filter,
  RotateCcw,
  Clock,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LayoutGrid,
  Layers,
  Ban,
  Info,
  FileDown,
  ArrowUp,
  FileBadge,
  ChevronDown,
  Bell,
  Undo,
  Clock4,
} from "lucide-react";
import FilterSelect from "../../filterSelect";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";
import MemoList from "../ctoMemoModal";
import { toast } from "react-toastify";
import CtoApplicationPdfModal from "./ctoApplicationPDFModal";
import OrganicApplicationPdfModal from "./organicApplicationPDFModal";

import { useAuth } from "../../../store/authStore";
import { usePermissions } from "../../../hooks/usePermissions";

import RevokeRequestModal from "../../revocationComponents/revokeRequestModal";

const pageSizeOptions = [20, 50, 100];

const fmtHours = (h) => {
  const n = Number(h ?? 0);
  return Number.isFinite(n)
    ? Number.isInteger(n)
      ? String(n)
      : n.toFixed(2)
    : "0";
};

function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

function useResolvedTheme(prefTheme) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined")
      return prefTheme === "dark" ? "dark" : "light";
    return resolveTheme(prefTheme);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (prefTheme !== "system") {
      setTheme(prefTheme === "dark" ? "dark" : "light");
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(mq.matches ? "dark" : "light");

    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, [prefTheme]);

  return theme;
}

function getIconChip(kind, borderColor) {
  const map = {
    accent: {
      bg: "var(--accent-soft)",
      fg: "var(--accent)",
      br: "var(--accent-soft2, rgba(37,99,235,0.18))",
    },
    green: {
      bg: "rgba(34,197,94,0.14)",
      fg: "#16a34a",
      br: "rgba(34,197,94,0.22)",
    },
    red: {
      bg: "rgba(239,68,68,0.14)",
      fg: "#ef4444",
      br: "rgba(239,68,68,0.22)",
    },
    amber: {
      bg: "rgba(245,158,11,0.16)",
      fg: "#d97706",
      br: "rgba(245,158,11,0.26)",
    },
    purple: {
      bg: "rgba(168,85,247,0.16)",
      fg: "#9333ea",
      br: "rgba(168,85,247,0.26)",
    },
    slate: {
      bg: "rgba(148,163,184,0.18)",
      fg: "var(--app-text)",
      br: "rgba(148,163,184,0.24)",
    },
    neutral: {
      bg: "var(--app-surface-2)",
      fg: "var(--app-muted)",
      br: borderColor || "var(--app-border)",
    },
  };
  return map[kind] || map.neutral;
}

/* =========================
   Data helpers
========================= */
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : DATE_FMT.format(d);
};

const memoNumbersOf = (app) =>
  Array.isArray(app?.memo)
    ? app.memo.map((m) => m?.memoId?.memoNo).filter(Boolean)
    : [];

const hasMemosOf = (app) => Array.isArray(app?.memo) && app.memo.length > 0;

const shortIdOf = (app) => (app?._id ? app._id.slice(-6).toUpperCase() : "-");

const sortedDatesOf = (dates = []) =>
  (Array.isArray(dates) ? dates : [])
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);

const STRIP_COLORS = {
  APPROVED: "#10b981",
  REJECTED: "#f43f5e",
  PENDING: "#f59e0b",
  CANCELLED: "#94a3b8",
  REVOCATION_REQUESTED: "#a855f7",
  REVOKED: "#64748b",
};

const stripColorOf = (status) =>
  STRIP_COLORS[String(status || "").toUpperCase()] || "#cbd5e1";

/* =========================
   Balance card
========================= */
const BalanceHoursCard = ({ hours, loading, borderColor }) => {
  const showValue =
    hours === null || hours === undefined ? "0h" : `${fmtHours(hours)}h`;

  const chip = getIconChip("accent", borderColor);

  return (
    <div
      className="w-full rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm border transition-colors duration-300 ease-out"
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border"
        style={{
          backgroundColor: chip.bg,
          color: chip.fg,
          borderColor: chip.br,
        }}
      >
        <Layers className="w-5 h-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="text-[10px] uppercase tracking-widest font-bold truncate"
          style={{ color: "var(--app-muted)" }}
        >
          Balance Hours
        </div>
        <div
          className="leading-tight text-[15px] sm:text-base font-extrabold truncate"
          style={{ color: "var(--accent)" }}
        >
          {loading ? <Skeleton width={70} /> : showValue}
        </div>
      </div>
    </div>
  );
};

/* =========================
   Cells (shared by table + cards)
========================= */
// Memo numbers as chips; "+N more" expands the rest (like the credit history names)
const MemoChips = ({ app, borderColor, maxVisible = 1, showId = true }) => {
  const [expanded, setExpanded] = useState(false);
  const memos = memoNumbersOf(app);

  if (memos.length === 0) {
    return (
      <div className="min-w-0">
        <span className="text-sm" style={{ color: "var(--app-muted)" }}>
          No memo attached
        </span>
        {showId && (
          <span
            className="block text-[10px] font-mono mt-0.5"
            style={{ color: "var(--app-muted)" }}
          >
            ID: {shortIdOf(app)}
          </span>
        )}
      </div>
    );
  }

  const hiddenCount = memos.length - maxVisible;
  const visible = expanded ? memos : memos.slice(0, maxVisible);

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        {visible.map((memo, idx) => (
          <span
            key={`${memo}-${idx}`}
            title={memo}
            className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full border text-xs font-semibold"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor,
              color: "var(--app-text)",
            }}
          >
            <FileText
              size={11}
              className="flex-none"
              style={{ color: "var(--accent)" }}
            />
            <span className="truncate">{memo}</span>
          </span>
        ))}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            title={expanded ? "Show less" : memos.slice(maxVisible).join(", ")}
            className="inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold whitespace-nowrap transition hover:brightness-95"
            style={{
              backgroundColor: "var(--accent-soft)",
              borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
              color: "var(--accent)",
            }}
          >
            {expanded ? "Show less" : `+${hiddenCount} more`}
          </button>
        )}
      </div>

      {showId && (
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--app-muted)" }}
        >
          ID: {shortIdOf(app)}
        </span>
      )}
    </div>
  );
};

const DatesCell = ({ dates, maxVisible = 1 }) => {
  const sorted = sortedDatesOf(dates);
  if (!sorted.length) {
    return (
      <span className="text-sm" style={{ color: "var(--app-muted)" }}>
        -
      </span>
    );
  }

  const visible = sorted.slice(0, maxVisible).map((d) => DATE_FMT.format(d));
  const rest = sorted.length - visible.length;
  const all = sorted.map((d) => DATE_FMT.format(d)).join(", ");

  return (
    <div className="flex items-center gap-1.5 min-w-0" title={all}>
      <Calendar
        size={14}
        className="flex-none"
        style={{ color: "var(--app-muted)" }}
      />
      <span className="text-sm truncate" style={{ color: "var(--app-muted)" }}>
        {visible.join(", ")}
      </span>
      {rest > 0 && (
        <span
          className="flex-none inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-bold"
          style={{
            backgroundColor: "var(--app-surface-2)",
            borderColor: "var(--app-border)",
            color: "var(--app-muted)",
          }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
};

/* =========================
   Per-row action menu (portal, so the table can't clip it)
========================= */
const MENU_WIDTH = 210;

const ApplicationActionMenu = ({
  app,
  onViewDetails,
  onViewMemos,
  onViewPdf,
  onViewCscForm6,
  onCancel,
  cancelling,
  onFollowUp,
  followingUp,
  onRequestRevoke,
  onCancelRevoke,
  cancellingRevoke,
  isOrganicApp,
  canRequestRevocation,
  borderColor,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, visible: false });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const status = String(app?.overallStatus || "").toUpperCase();
  const isPending = status === "PENDING";
  const isApproved = status === "APPROVED";
  const isRevocationRequested = status === "REVOCATION_REQUESTED";
  const hasMemos = hasMemosOf(app);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const btn = btnRef.current?.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 200;
    if (!btn) return;

    const gap = 6;
    const spaceBelow = window.innerHeight - btn.bottom;
    const openUp = spaceBelow < menuH + gap + 8 && btn.top > menuH + gap;

    setPos({
      top: openUp ? btn.top - menuH - gap : btn.bottom + gap,
      left: Math.min(
        Math.max(8, btn.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8,
      ),
      visible: true,
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const close = () => setIsOpen(false);
    const onDown = (e) => {
      if (
        btnRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      )
        return;
      close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  const run = (cb) => {
    setIsOpen(false);
    cb?.();
  };

  const itemClass =
    "w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 text-left transition-colors " +
    "text-[color:var(--app-muted)] hover:bg-[color:var(--app-surface-2)] hover:text-[color:var(--accent)] " +
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[color:var(--app-muted)]";

  const dangerClass =
    "w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 text-left transition-colors " +
    "text-[#ef4444] hover:bg-[rgba(239,68,68,0.12)] " +
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setPos((p) => ({ ...p, visible: false }));
          setIsOpen((o) => !o);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border shadow-sm text-xs font-bold transition-all duration-200 ease-out active:scale-95"
        style={{
          backgroundColor: isOpen
            ? "var(--app-surface-2)"
            : "var(--app-surface)",
          borderColor,
          color: isOpen ? "var(--accent)" : "var(--app-text)",
        }}
        title="Actions"
      >
        <span>Actions</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="rounded-lg py-1 overflow-hidden"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              zIndex: 1000,
              visibility: pos.visible ? "visible" : "hidden",
              backgroundColor: "var(--app-surface)",
              border: `1px solid ${borderColor}`,
              boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onViewDetails)}
              className={itemClass}
            >
              <Eye size={14} /> View Details
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => run(onViewPdf)}
              className={itemClass}
            >
              <FileDown size={14} /> View General PDF
            </button>

            {isOrganicApp && (
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onViewCscForm6)}
                className={itemClass}
              >
                <FileBadge size={14} /> View CSC Form 6
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              disabled={!hasMemos}
              onClick={() => run(onViewMemos)}
              className={itemClass}
            >
              <FileText size={14} /> View Memos
            </button>

            {isPending && (
              <button
                type="button"
                role="menuitem"
                disabled={followingUp}
                onClick={() => run(onFollowUp)}
                className={itemClass}
              >
                <Bell size={14} />{" "}
                {followingUp ? "Sending..." : "Send Follow-up"}
              </button>
            )}

            {isApproved && canRequestRevocation && (
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onRequestRevoke)}
                className={itemClass}
              >
                <Undo size={14} /> Request Revocation
              </button>
            )}

            {(isRevocationRequested && canRequestRevocation) || isPending ? (
              <div
                className="h-px my-1"
                style={{ backgroundColor: "var(--app-border)" }}
              />
            ) : null}

            {isRevocationRequested && canRequestRevocation && (
              <button
                type="button"
                role="menuitem"
                disabled={cancellingRevoke}
                onClick={() => run(onCancelRevoke)}
                className={dangerClass}
              >
                <Ban size={14} />
                {cancellingRevoke ? "Cancelling..." : "Cancel Revocation"}
              </button>
            )}

            {isPending && (
              <button
                type="button"
                role="menuitem"
                disabled={cancelling}
                onClick={() => run(onCancel)}
                className={dangerClass}
              >
                <Ban size={14} />
                {cancelling ? "Cancelling..." : "Cancel Request"}
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
};

/* =========================
   Mobile / Tablet Card
========================= */
const ApplicationCard = ({
  app,
  onViewDetails,
  onViewPdf,
  onViewCscForm6,
  onCancel,
  cancelling,
  onFollowUp,
  followingUp,
  onRequestRevoke,
  onCancelRevoke,
  cancellingRevoke,
  isOrganicApp,
  canRequestRevocation,
  borderColor,
}) => {
  const status = String(app?.overallStatus || "").toUpperCase();
  const isPending = status === "PENDING";
  const isApproved = status === "APPROVED";
  const isRevocationRequested = status === "REVOCATION_REQUESTED";

  const coveredCount = Array.isArray(app?.inclusiveDates)
    ? app.inclusiveDates.length
    : 0;

  const btn =
    "flex-1 min-w-[80px] inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border transition-colors duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed";
  const neutralBtn = `${btn} bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)]`;
  const dangerStyle = {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: "rgba(239,68,68,0.20)",
    color: "#ef4444",
  };

  return (
    <div
      className="rounded-xl shadow-sm overflow-hidden transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${stripColorOf(app?.overallStatus)}`,
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <MemoChips app={app} borderColor={borderColor} showId={false} />
            <div
              className="mt-2 flex items-center gap-2 text-xs"
              style={{ color: "var(--app-muted)" }}
            >
              <Calendar className="w-4 h-4 flex-none" />
              <span className="truncate">{fmtDate(app?.createdAt)}</span>
              <span className="flex-none font-mono text-[10px]">
                · #{shortIdOf(app)}
              </span>
            </div>
          </div>

          <div className="flex-none">
            <StatusBadge status={app?.overallStatus} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div
            className="rounded-lg border p-2"
            style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--app-muted)" }}
            >
              <Clock className="w-3.5 h-3.5" /> Hours
            </div>
            <div
              className="mt-1 text-sm font-semibold"
              style={{ color: "var(--app-text)" }}
            >
              {fmtHours(app?.requestedHours)}h
            </div>
          </div>

          <div
            className="rounded-lg border p-2 min-w-0"
            style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--app-muted)" }}
            >
              <Layers className="w-3.5 h-3.5" /> Covered
            </div>
            <div
              className="mt-1 text-sm font-semibold"
              style={{ color: "var(--app-text)" }}
            >
              {coveredCount} day{coveredCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="mt-3 min-w-0">
          <DatesCell dates={app?.inclusiveDates} maxVisible={2} />
        </div>
      </div>

      <div className="border-t p-3" style={{ borderColor }}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onViewDetails}
            title="View Details"
            className={`${btn} bg-[color:var(--app-surface)] hover:bg-[color:var(--accent-soft)]`}
            style={{ borderColor, color: "var(--accent)" }}
          >
            <Eye className="w-4 h-4" />
            Details
          </button>

          <button
            type="button"
            onClick={onViewPdf}
            title="View PDF"
            className={neutralBtn}
            style={{ borderColor, color: "var(--app-text)" }}
          >
            <FileDown className="w-4 h-4" />
            Gen PDF
          </button>

          {isOrganicApp && (
            <button
              type="button"
              onClick={onViewCscForm6}
              title="View CSC Form 6"
              className={neutralBtn}
              style={{ borderColor, color: "var(--app-text)" }}
            >
              <FileBadge className="w-4 h-4" />
              Form 6
            </button>
          )}

          {isPending && (
            <button
              type="button"
              onClick={onFollowUp}
              disabled={followingUp}
              title="Follow Up"
              className={neutralBtn}
              style={{ borderColor, color: "var(--app-text)" }}
            >
              <Bell className="w-4 h-4" />
              {followingUp ? "..." : "Follow Up"}
            </button>
          )}

          {isApproved && canRequestRevocation && (
            <button
              type="button"
              onClick={onRequestRevoke}
              title="Request Revocation"
              className={neutralBtn}
              style={{ borderColor, color: "var(--app-text)" }}
            >
              <Undo className="w-4 h-4" />
              Revoke Req.
            </button>
          )}

          {isRevocationRequested && canRequestRevocation && (
            <button
              type="button"
              onClick={onCancelRevoke}
              disabled={cancellingRevoke}
              title="Cancel Revocation"
              className={btn}
              style={dangerStyle}
            >
              <Ban className="w-4 h-4" />
              {cancellingRevoke ? "..." : "Cancel Revoke"}
            </button>
          )}

          {isPending && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              title="Cancel"
              className={btn}
              style={dangerStyle}
            >
              <Ban className="w-4 h-4" />
              {cancelling ? "..." : "Cancel"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* =========================
   Compact Pagination
========================= */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  label = "items",
  borderColor,
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
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor,
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
          {total === 0 ? `0 ${label}` : `${startItem}-${endItem} of ${total}`}
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages || total === 0}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor,
          color: "var(--app-text)",
        }}
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>

    <div className="hidden md:flex flex-col md:flex-row items-center justify-between gap-4">
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
        {label}
      </div>

      <div
        className="flex items-center gap-1 p-1 rounded-lg border"
        style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out hover:bg-[color:var(--app-surface)]"
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
          className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out hover:bg-[color:var(--app-surface)]"
          style={{ color: "var(--app-muted)" }}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

const tabTone = {
  accent: {
    bg: "var(--accent-soft)",
    text: "var(--accent)",
    br: "var(--accent-soft2, rgba(37,99,235,0.18))",
  },
  amber: {
    bg: "rgba(245,158,11,0.16)",
    text: "#d97706",
    br: "rgba(245,158,11,0.26)",
  },
  green: {
    bg: "rgba(34,197,94,0.14)",
    text: "#16a34a",
    br: "rgba(34,197,94,0.22)",
  },
  red: {
    bg: "rgba(239,68,68,0.14)",
    text: "#ef4444",
    br: "rgba(239,68,68,0.22)",
  },
  purple: {
    bg: "rgba(168,85,247,0.16)",
    text: "#9333ea",
    br: "rgba(168,85,247,0.26)",
  },
  slate: {
    bg: "rgba(148,163,184,0.18)",
    text: "var(--app-text)",
    br: "rgba(148,163,184,0.24)",
  },
};

/* =========================
   Confirm modal header (shared)
========================= */
const RefHeader = ({ label, app, borderColor }) => (
  <div
    className="mb-5 flex items-start gap-3 p-3 rounded-xl border"
    style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
  >
    <div
      className="mt-0.5 p-1.5 rounded-lg border shadow-sm"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor,
        color: "var(--app-muted)",
      }}
    >
      <Info size={16} />
    </div>
    <div className="min-w-0">
      <p
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: "var(--app-muted)" }}
      >
        {label}
      </p>
      <p
        className="text-sm font-bold break-words"
        style={{ color: "var(--app-text)" }}
      >
        Ref: {app?._id ? `#${shortIdOf(app)}` : "-"}
      </p>
    </div>
  </div>
);

const ConfirmBody = ({ icon: Icon, tone, title, message }) => {
  const tones = {
    red: {
      bg: "rgba(239,68,68,0.12)",
      fg: "#ef4444",
      br: "rgba(239,68,68,0.20)",
    },
    amber: {
      bg: "rgba(245,158,11,0.12)",
      fg: "#f59e0b",
      br: "rgba(245,158,11,0.25)",
    },
  };
  const t = tones[tone] || tones.red;

  return (
    <div className="text-center py-2">
      <div
        className="mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-4 border-4 shadow-inner"
        style={{ backgroundColor: t.bg, color: t.fg, borderColor: t.br }}
      >
        <Icon size={40} strokeWidth={3} />
      </div>
      <h2
        className="text-lg font-semibold"
        style={{ color: "var(--app-text)" }}
      >
        {title}
      </h2>
      <p className="text-sm mt-2" style={{ color: "var(--app-muted)" }}>
        {message}
      </p>
    </div>
  );
};

/* =========================
   Page
========================= */
const MyCtoApplications = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const user = useAuth((s) => s.admin);
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);
  const { can } = usePermissions();

  const isUserOrganic = user?.employeeType === "Organic";

  const canRevokeSelf = can("revocation.manage_self");
  const canApplySelf = can("cto.manage_self");
  const { data: settingsData } = useQuery({
    queryKey: ["revocationSettings"],
    queryFn: fetchRevocationSettings,
    staleTime: 1000 * 60 * 5,
  });
  const isRevocationEnabled = settingsData?.isEnabled ?? true;
  const canRequestRevocation = canRevokeSelf && isRevocationEnabled;
  const isAttachmentRequired = settingsData?.isAttachmentRequired ?? false;

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const skeletonColors = useMemo(() => {
    const base =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(15,23,42,0.06)";
    const highlight =
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(15,23,42,0.10)";
    return {
      baseColor: `var(--skeleton-base, ${base})`,
      highlightColor: `var(--skeleton-highlight, ${highlight})`,
    };
  }, [resolvedTheme]);

  const [selectedApp, setSelectedApp] = useState(null);
  const [memoModal, setMemoModal] = useState({ isOpen: false, memos: [] });
  const [pdfApp, setPdfApp] = useState(null);
  const [organicPdfApp, setOrganicPdfApp] = useState(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [cancelModal, setCancelModal] = useState({ isOpen: false, app: null });
  const openCancelModal = (app) => setCancelModal({ isOpen: true, app });
  const closeCancelModal = () => setCancelModal({ isOpen: false, app: null });

  const [followUpModal, setFollowUpModal] = useState({
    isOpen: false,
    app: null,
  });
  const openFollowUpModal = (app) => setFollowUpModal({ isOpen: true, app });
  const closeFollowUpModal = () =>
    setFollowUpModal({ isOpen: false, app: null });

  const [revokeModal, setRevokeModal] = useState({ isOpen: false, app: null });
  const openRevokeModal = (app) => setRevokeModal({ isOpen: true, app });
  const closeRevokeModal = () => setRevokeModal({ isOpen: false, app: null });

  const [cancelRevokeModal, setCancelRevokeModal] = useState({
    isOpen: false,
    app: null,
  });
  const openCancelRevokeModal = (app) =>
    setCancelRevokeModal({ isOpen: true, app });
  const closeCancelRevokeModal = () =>
    setCancelRevokeModal({ isOpen: false, app: null });

  const scrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => setShowScrollTop(el.scrollTop > 240);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () =>
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  const searchTimeout = useRef(null);
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchFilter(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(searchTimeout.current);
  }, [searchInput]);

  const appQueryKey = "myCtoApplications";
  const balanceQueryKey = "myCtoBalanceHours";

  const { data, isLoading, refetch } = useQuery({
    queryKey: [appQueryKey, page, limit, statusFilter, searchFilter],
    queryFn: () =>
      fetchMyCtoApplications({
        page,
        limit,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: creditSummaryData, isLoading: isBalanceLoading } = useQuery({
    queryKey: [balanceQueryKey],
    queryFn: () => fetchMyCreditRequests({ page: 1, limit: 1 }),
    staleTime: 1000 * 60,
  });

  const cancelMutation = useMutation({
    mutationFn: (applicationId) => cancelCtoApplicationRequest(applicationId),
    onSuccess: (payload) => {
      toast.success("Application cancelled.");

      const updatedApp = payload?.application ?? payload?.data ?? payload;
      if (updatedApp?._id && selectedApp?._id === updatedApp._id) {
        setSelectedApp(updatedApp);
      }

      closeCancelModal();
      queryClient.invalidateQueries({ queryKey: [appQueryKey] });
      queryClient.invalidateQueries({ queryKey: [balanceQueryKey] });
    },
    onError: (err) => toast.error(err?.message || "Failed to cancel request."),
  });

  const cancelRevokeMutation = useMutation({
    mutationFn: (applicationId) => cancelRevocationCtoRequest(applicationId),
    onSuccess: () => {
      toast.success("Revocation request withdrawn successfully.");
      closeCancelRevokeModal();
      queryClient.invalidateQueries({ queryKey: [appQueryKey] });
      refetch();
    },
    onError: (err) =>
      toast.error(err?.message || "Failed to cancel revocation."),
  });

  const followUpMutation = useMutation({
    mutationFn: (applicationId) => followUpCtoApplicationRequest(applicationId),
    onSuccess: (payload) => {
      toast.success(
        payload?.message || "Follow-up notification sent successfully.",
      );
      closeFollowUpModal();
    },
    onError: (err) => toast.error(err?.message || "Failed to send follow-up."),
  });

  const revokeRequestMutation = useMutation({
    mutationFn: ({ id, payload }) => requestRevocation(id, payload),
    onSuccess: (payload) => {
      toast.success(
        payload?.message || "Revocation request submitted successfully.",
      );

      const updatedApp = payload?.application ?? payload?.data ?? payload;
      if (updatedApp?._id && selectedApp?._id === updatedApp._id) {
        setSelectedApp(updatedApp);
      }

      closeRevokeModal();
      queryClient.invalidateQueries({ queryKey: [appQueryKey] });
    },
    onError: (err) =>
      toast.error(err?.message || "Failed to request revocation."),
  });

  // Strict booleans (safe across React Query v4 & v5)
  const isCancelLoading = !!(
    cancelMutation.isPending || cancelMutation.isLoading
  );
  const isCancelRevokeLoading = !!(
    cancelRevokeMutation.isPending || cancelRevokeMutation.isLoading
  );
  const isFollowUpLoading = !!(
    followUpMutation.isPending || followUpMutation.isLoading
  );
  const isRevokeLoading = !!(
    revokeRequestMutation.isPending || revokeRequestMutation.isLoading
  );

  const handleRevokeSubmit = async ({ reason, file }) => {
    const app = revokeModal.app;
    if (!app?._id) return;

    const formData = new FormData();
    formData.append("reason", reason);
    if (file) formData.append("file", file);

    await revokeRequestMutation.mutateAsync({ id: app._id, payload: formData });
  };

  const applications = useMemo(() => data?.data || [], [data]);

  const pagination = useMemo(
    () => ({
      page: data?.pagination?.page || 1,
      totalPages: Math.max(data?.pagination?.totalPages || 1, 1),
      total: data?.pagination?.total || 0,
    }),
    [data],
  );

  useEffect(() => {
    setPage((p) => {
      if (p > pagination.totalPages) return pagination.totalPages;
      if (p < 1) return 1;
      return p;
    });
  }, [pagination.totalPages]);

  const startItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * limit + 1;
  const endItem =
    pagination.total === 0
      ? 0
      : Math.min(pagination.page * limit, pagination.total);

  const openMemoModal = (memos) => setMemoModal({ isOpen: true, memos });
  const closeMemoModal = () => setMemoModal({ isOpen: false, memos: [] });

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const isFiltered = statusFilter !== "" || searchFilter !== "";

  const statusCounts = data?.statusCounts || {};
  const totalCount =
    typeof statusCounts.total === "number"
      ? statusCounts.total
      : (statusCounts.PENDING || 0) +
        (statusCounts.APPROVED || 0) +
        (statusCounts.REJECTED || 0) +
        (statusCounts.CANCELLED || 0) +
        (statusCounts.REVOCATION_REQUESTED || 0) +
        (statusCounts.REVOKED || 0);

  const tabs = [
    {
      id: "",
      label: "All Status",
      icon: LayoutGrid,
      count: totalCount,
      tone: "accent",
    },
    {
      id: "PENDING",
      label: "Pending",
      icon: AlertCircle,
      count: statusCounts.PENDING || 0,
      tone: "amber",
    },
    {
      id: "APPROVED",
      label: "Approved",
      icon: CheckCircle2,
      count: statusCounts.APPROVED || 0,
      tone: "green",
    },
    {
      id: "REVOCATION_REQUESTED",
      label: "Revoke Req.",
      icon: Undo,
      count: statusCounts.REVOCATION_REQUESTED || 0,
      tone: "purple",
    },
    {
      id: "REJECTED",
      label: "Rejected",
      icon: XCircle,
      count: statusCounts.REJECTED || 0,
      tone: "red",
    },
    {
      id: "CANCELLED",
      label: "Cancelled",
      icon: Ban,
      count: statusCounts.CANCELLED || 0,
      tone: "slate",
    },
    {
      id: "REVOKED",
      label: "Revoked",
      icon: RotateCcw,
      count: statusCounts.REVOKED || 0,
      tone: "slate",
    },
  ];

  const balanceHours =
    data?.balanceHours ??
    data?.totals?.totalRemainingHours ??
    data?.totals?.remainingHours ??
    creditSummaryData?.totals?.totalRemainingHours ??
    null;

  // Everything a row/card needs, computed in one place
  const rowProps = (app) => ({
    app,
    borderColor,
    cancelling: isCancelLoading && cancelMutation.variables === app._id,
    followingUp: isFollowUpLoading && followUpMutation.variables === app._id,
    cancellingRevoke:
      isCancelRevokeLoading && cancelRevokeMutation.variables === app._id,
    isOrganicApp:
      app?.employeeType === "Organic" ||
      app?.category === "Organic" ||
      isUserOrganic,
    canRequestRevocation,
    onViewDetails: () => setSelectedApp(app),
    onViewPdf: () => setPdfApp({ ...app, ledger: data?.ledger }),
    onViewCscForm6: () => setOrganicPdfApp({ ...app, ledger: data?.ledger }),
    onViewMemos: () => openMemoModal(app.memo),
    onCancel: () => openCancelModal(app),
    onFollowUp: () => openFollowUpModal(app),
    onRequestRevoke: () => openRevokeModal(app),
    onCancelRevoke: () => openCancelRevokeModal(app),
  });

  const cardSkeleton = (key) => (
    <div
      key={key}
      className="rounded-xl shadow-sm p-4 border"
      style={{ backgroundColor: "var(--app-surface)", borderColor }}
    >
      <Skeleton height={20} width="55%" borderRadius={999} />
      <div className="mt-2">
        <Skeleton height={12} width="40%" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Skeleton height={52} />
        <Skeleton height={52} />
      </div>
      <div className="mt-4">
        <Skeleton height={36} />
      </div>
    </div>
  );

  const chipStyle = {
    backgroundColor: "var(--accent-soft)",
    color: "var(--accent)",
    borderColor: "var(--accent-soft2, rgba(37,99,235,0.18))",
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
          baseColor={skeletonColors.baseColor}
          highlightColor={skeletonColors.highlightColor}
        >
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain md:contents cto-scrollbar"
          >
            {/* HEADER */}
            <div className="pt-2 pb-3 md:pb-6 px-1">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <Breadcrumbs rootLabel="home" rootTo="/app" />
                  <h1
                    className="text-2xl md:text-3xl font-bold tracking-tight font-sans"
                    style={{ color: "var(--app-text)" }}
                  >
                    My Applications
                  </h1>
                  <p
                    className="block text-sm mt-1 max-w-2xl"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Browse your Compensatory Time-Off history, track status
                    updates, and file new requests.
                  </p>
                </div>

                <div className="w-full md:w-72 flex flex-col gap-3 shrink-0">
                  <BalanceHoursCard
                    hours={balanceHours}
                    loading={isBalanceLoading}
                    borderColor={borderColor}
                  />

                  {canApplySelf && (
                    <div className="flex flex-row items-center gap-2 w-full">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            isUserOrganic
                              ? "/app/cto-apply/organic?late=true"
                              : "/app/cto-apply/add?late=true",
                          )
                        }
                        className="inline-flex items-center gap-2 justify-center rounded-lg px-3 py-2.5 text-[11px] sm:text-xs font-semibold shadow-sm transition-all w-full flex-1 bg-[rgba(245,158,11,0.12)] hover:bg-[rgba(245,158,11,0.20)]"
                        style={{
                          color: "#d97706",
                          border: "1px solid rgba(245,158,11,0.25)",
                        }}
                      >
                        <Clock4 className="w-3.5 h-3.5 shrink-0" />
                        Late Filing
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            isUserOrganic
                              ? "/app/cto-apply/organic"
                              : "/app/cto-apply/add",
                          )
                        }
                        className="group inline-flex items-center gap-2 justify-center rounded-lg px-3 py-2.5 text-[11px] sm:text-xs font-semibold shadow-sm transition-all w-full flex-1 hover:brightness-95"
                        style={{
                          backgroundColor: "var(--accent)",
                          color: "#fff",
                          border: "1px solid var(--accent)",
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:rotate-90" />
                        File Leave
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* MAIN */}
            <div
              className="flex flex-col rounded-xl shadow-sm overflow-visible md:flex-1 md:min-h-0 md:overflow-hidden transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                border: `1px solid ${borderColor}`,
              }}
            >
              {/* Toolbar */}
              <div
                className="p-4 border-b space-y-4 sticky top-0 z-[1] backdrop-blur md:static md:z-auto transition-colors duration-300 ease-out"
                style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => {
                      const isActive = statusFilter === tab.id;
                      const Icon = tab.icon;
                      const t = tabTone[tab.tone] || tabTone.accent;

                      return (
                        <button
                          type="button"
                          key={tab.id || "all-status"}
                          onClick={() => {
                            setStatusFilter(tab.id);
                            setPage(1);
                          }}
                          className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-2 ${
                            isActive
                              ? ""
                              : "hover:bg-[color:var(--app-surface-2)]"
                          }`}
                          aria-pressed={isActive}
                          style={{
                            backgroundColor: isActive ? t.bg : undefined,
                            color: isActive ? t.text : "var(--app-muted)",
                            borderColor: isActive ? t.br : borderColor,
                          }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                          <span
                            className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              backgroundColor: isActive
                                ? "rgba(255,255,255,0.35)"
                                : "var(--app-surface-2)",
                              color: isActive
                                ? "var(--app-text)"
                                : "var(--app-muted)",
                            }}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: "var(--app-muted)" }}
                      />
                      <input
                        type="text"
                        placeholder="Search memo..."
                        value={searchInput}
                        maxLength={100}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 rounded-lg text-sm outline-none transition-colors duration-200 ease-out border"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                          color: "var(--app-text)",
                        }}
                      />
                      {searchInput && (
                        <button
                          type="button"
                          onClick={() => setSearchInput("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition hover:bg-[color:var(--app-surface-2)]"
                          style={{ color: "var(--app-muted)" }}
                          aria-label="Clear search"
                          title="Clear"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div
                      className="hidden lg:flex items-center gap-2 pl-3 border-l"
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
                        onChange={(e) => {
                          setLimit(Number(e.target.value));
                          setPage(1);
                        }}
                        className="border text-xs rounded-lg block p-1.5 font-medium outline-none cursor-pointer"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                          color: "var(--app-text)",
                        }}
                      >
                        {pageSizeOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div
                      className="lg:hidden flex items-center gap-1.5 px-2 border-l ml-1"
                      style={{ borderColor }}
                    >
                      <span
                        className="text-xs font-medium uppercase tracking-wider"
                        style={{ color: "var(--app-muted)" }}
                      >
                        shows
                      </span>
                      <FilterSelect
                        label=""
                        value={limit}
                        onChange={(v) => {
                          setLimit(v);
                          setPage(1);
                        }}
                        options={pageSizeOptions}
                        className="!mb-0 w-20 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {isFiltered && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span
                        className="text-[10px] font-bold uppercase"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Active:
                      </span>
                      {searchFilter && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium max-w-[200px] truncate"
                          style={chipStyle}
                          title={searchFilter}
                        >
                          "{searchFilter}"
                        </span>
                      )}
                      {statusFilter && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium"
                          style={chipStyle}
                        >
                          {statusFilter}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="flex-none flex items-center gap-1 text-[10px] font-bold uppercase"
                      style={{ color: "var(--accent)" }}
                    >
                      <RotateCcw size={10} /> Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Data region */}
              <div
                className="min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-y-auto overflow-x-hidden transition-colors duration-300 ease-out cto-scrollbar"
                style={{ backgroundColor: "var(--app-bg)" }}
              >
                {!isLoading && applications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                    <div
                      className="p-6 rounded-full mb-4 border"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor,
                      }}
                    >
                      <Filter
                        className="w-10 h-10"
                        style={{ color: "var(--app-muted)", opacity: 0.6 }}
                      />
                    </div>
                    <h3
                      className="text-lg font-bold"
                      style={{ color: "var(--app-text)" }}
                    >
                      No Results Found
                    </h3>
                    <p
                      className="text-sm max-w-xs mt-1"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Try adjusting your search or filters to find what you're
                      looking for.
                    </p>
                    {isFiltered && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-6 flex items-center gap-2 px-4 py-2 text-xs font-bold border rounded-lg transition-colors duration-200 ease-out bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)]"
                        style={{ borderColor, color: "var(--app-text)" }}
                      >
                        <RotateCcw size={12} /> Clear Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Mobile (1 col) / Tablet (2 cols): cards */}
                    <div className="block lg:hidden p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                        {isLoading
                          ? [...Array(Math.min(limit, 6))].map((_, i) =>
                              cardSkeleton(`sk-${i}`),
                            )
                          : applications.map((app) => (
                              <ApplicationCard
                                key={app._id}
                                {...rowProps(app)}
                              />
                            ))}
                      </div>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block w-full align-middle">
                      <table className="w-full text-left table-fixed">
                        <colgroup>
                          <col style={{ width: "30%" }} />
                          <col style={{ width: "8%" }} />
                          <col style={{ width: "17%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "20%" }} />
                          <col style={{ width: "12%" }} />
                        </colgroup>

                        <thead
                          className="sticky top-0 z-10 border-b"
                          style={{
                            backgroundColor: "var(--app-surface)",
                            borderColor,
                          }}
                        >
                          <tr
                            className="text-[10px] uppercase tracking-[0.12em] font-bold"
                            style={{ color: "var(--app-muted)" }}
                          >
                            <th className="px-6 py-4">Reference / Memo</th>
                            <th className="px-2 py-4 text-center">Hours</th>
                            <th className="px-2 py-4 text-center">Status</th>
                            <th className="px-2 py-4 text-center">Submitted</th>
                            <th className="px-4 py-4">Dates Covered</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>

                        <tbody>
                          {isLoading
                            ? [...Array(8)].map((_, i) => (
                                <tr key={i}>
                                  {[...Array(6)].map((__, j) => (
                                    <td key={j} className="px-4 py-4">
                                      <Skeleton />
                                    </td>
                                  ))}
                                </tr>
                              ))
                            : applications.map((app, i) => {
                                const bg =
                                  i % 2 === 0
                                    ? "var(--app-surface)"
                                    : "var(--app-surface-2)";
                                const props = rowProps(app);

                                return (
                                  <tr
                                    key={app._id}
                                    className="border-b transition-colors duration-200 ease-out"
                                    style={{ backgroundColor: bg, borderColor }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        "var(--accent-soft)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        bg;
                                    }}
                                  >
                                    <td className="px-6 py-3.5 align-middle">
                                      <MemoChips
                                        app={app}
                                        borderColor={borderColor}
                                      />
                                    </td>

                                    <td className="px-2 py-3.5 text-center align-middle whitespace-nowrap">
                                      <span
                                        className="inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold"
                                        style={{
                                          backgroundColor: "var(--app-surface)",
                                          borderColor,
                                          color: "var(--app-text)",
                                        }}
                                      >
                                        {fmtHours(app.requestedHours)}h
                                      </span>
                                    </td>

                                    <td className="px-2 py-3.5 text-center align-middle whitespace-nowrap">
                                      <StatusBadge status={app.overallStatus} />
                                    </td>

                                    <td
                                      className="px-2 py-3.5 text-center align-middle whitespace-nowrap text-sm"
                                      style={{ color: "var(--app-muted)" }}
                                    >
                                      {fmtDate(app.createdAt)}
                                    </td>

                                    <td className="px-4 py-3.5 align-middle">
                                      <DatesCell
                                        dates={app.inclusiveDates}
                                        maxVisible={1}
                                      />
                                    </td>

                                    <td className="px-6 py-3.5 text-right align-middle whitespace-nowrap">
                                      <ApplicationActionMenu {...props} />
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

              {/* Pagination */}
              <CompactPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                startItem={startItem}
                endItem={endItem}
                label="applications"
                onPrev={() => setPage((p) => Math.max(p - 1, 1))}
                onNext={() =>
                  setPage((p) => Math.min(p + 1, pagination.totalPages))
                }
                borderColor={borderColor}
              />
            </div>
          </div>

          {/* Back-to-top */}
          {showScrollTop && (
            <button
              type="button"
              onClick={scrollToTop}
              className="md:hidden fixed bottom-5 right-5 z-[1] h-10 w-10 rounded-full shadow-lg active:scale-95 transition flex items-center justify-center"
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

          {/* General PDF Modal */}
          {pdfApp && (
            <CtoApplicationPdfModal
              app={pdfApp}
              isOpen={!!pdfApp}
              onClose={() => setPdfApp(null)}
            />
          )}

          {/* Organic PDF Modal */}
          {organicPdfApp && (
            <OrganicApplicationPdfModal
              app={organicPdfApp}
              isOpen={!!organicPdfApp}
              onClose={() => setOrganicPdfApp(null)}
            />
          )}

          {/* Details modal */}
          {selectedApp && (
            <Modal
              isOpen={!!selectedApp}
              onClose={() => setSelectedApp(null)}
              title="Application Details"
              maxWidth="max-w-5xl"
            >
              <CtoApplicationDetails app={selectedApp} loading={!selectedApp} />
            </Modal>
          )}

          {/* Follow-up confirm */}
          <Modal
            isOpen={followUpModal.isOpen}
            onClose={closeFollowUpModal}
            title="Send Follow-up"
            maxWidth="max-w-lg"
            preventCloseWhenBusy={true}
            isBusy={isFollowUpLoading}
            action={{
              show: true,
              variant: "warning",
              label: isFollowUpLoading ? "Sending..." : "Yes, Send Follow-up",
              onClick: async () => {
                const app = followUpModal.app;
                if (!app?._id) return;
                await followUpMutation.mutateAsync(app._id);
              },
              disabled: isFollowUpLoading,
            }}
          >
            <div className="p-2" style={{ color: "var(--app-text)" }}>
              <RefHeader
                label="You are about to notify approvers"
                app={followUpModal.app}
                borderColor={borderColor}
              />
              <ConfirmBody
                icon={Bell}
                tone="amber"
                title="Are you sure you want to send a follow-up?"
                message="This will send a reminder to the pending approvers for this CTO application."
              />
            </div>
          </Modal>

          {/* Request revocation */}
          <RevokeRequestModal
            isOpen={revokeModal.isOpen}
            onClose={closeRevokeModal}
            app={revokeModal.app}
            isBusy={isRevokeLoading}
            isAttachmentRequired={isAttachmentRequired}
            borderColor={borderColor}
            onSubmit={handleRevokeSubmit}
          />

          {/* Cancel revocation confirm */}
          <Modal
            isOpen={cancelRevokeModal.isOpen}
            onClose={closeCancelRevokeModal}
            title="Cancel Revocation Request"
            maxWidth="max-w-lg"
            preventCloseWhenBusy={true}
            isBusy={isCancelRevokeLoading}
            action={{
              show: true,
              variant: "delete",
              label: isCancelRevokeLoading
                ? "Withdrawing..."
                : "Withdraw Revocation",
              onClick: async () => {
                const app = cancelRevokeModal.app;
                if (!app?._id) return;
                await cancelRevokeMutation.mutateAsync(app._id);
              },
              disabled: isCancelRevokeLoading,
            }}
          >
            <div className="p-2" style={{ color: "var(--app-text)" }}>
              <RefHeader
                label="You are withdrawing your request"
                app={cancelRevokeModal.app}
                borderColor={borderColor}
              />
              <ConfirmBody
                icon={Ban}
                tone="red"
                title="Withdraw this revocation request?"
                message="This action will revert your CTO back to its APPROVED state. You can request another revocation later if needed."
              />
            </div>
          </Modal>

          {/* Cancel application confirm */}
          <Modal
            isOpen={cancelModal.isOpen}
            onClose={closeCancelModal}
            title="Cancel Application"
            maxWidth="max-w-lg"
            preventCloseWhenBusy={true}
            isBusy={isCancelLoading}
            action={{
              show: true,
              variant: "cancel",
              label: isCancelLoading ? "Cancelling..." : "Yes, Cancel",
              onClick: async () => {
                const app = cancelModal.app;
                if (!app?._id) return;

                const status = String(app?.overallStatus || "").toUpperCase();
                if (status !== "PENDING") {
                  toast.error("Only PENDING applications can be cancelled.");
                  closeCancelModal();
                  return;
                }

                await cancelMutation.mutateAsync(app._id);
              },
              disabled: isCancelLoading,
            }}
          >
            <div className="p-2" style={{ color: "var(--app-text)" }}>
              <RefHeader
                label="You are about to cancel this request"
                app={cancelModal.app}
                borderColor={borderColor}
              />
              <ConfirmBody
                icon={Ban}
                tone="red"
                title="Are you sure you want to cancel this application?"
                message="This will stop the approval workflow and update your balances accordingly."
              />
            </div>
          </Modal>

          {/* Memo modal */}
          <Modal
            isOpen={memoModal.isOpen}
            onClose={closeMemoModal}
            title="Attached Memos"
            closeLabel="Close"
            maxWidth="max-w-5xl"
          >
            <div className="w-full">
              <MemoList
                memos={memoModal.memos}
                description="References used for this compensation request."
              />
            </div>
          </Modal>
        </SkeletonTheme>
      </div>
    </FullHeightCardContainer>
  );
};

export default MyCtoApplications;
