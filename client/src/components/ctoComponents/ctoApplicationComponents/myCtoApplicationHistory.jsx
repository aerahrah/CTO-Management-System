import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StatusBadge } from "../../statusUtils";
import FullHeightCardContainer from "../../pageContainer";

// Consolidated API Imports
import {
  fetchMyCtoApplications,
  fetchMyCreditRequests,
  cancelCtoApplicationRequest,
  followUpCtoApplicationRequest,
  requestRevocation,
  cancelRevocationCtoRequest,
} from "../../../api/cto";

// Import settings API
import { fetchRevocationSettings } from "../../../api/revocationApprover";

import Modal from "../../modal";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import Breadcrumbs from "../../breadCrumbs";
import "react-loading-skeleton/dist/skeleton.css";
import {
  Search,
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
  Clock4, // ✅ Imported Clock4 for Late Filing icon
} from "lucide-react";
import FilterSelect from "../../filterSelect";
import CtoApplicationDetails from "./myCtoApplicationFullDetails";
import MemoList from "../ctoMemoModal";
import { toast } from "react-toastify";
import CtoApplicationPdfModal from "./ctoApplicationPDFModal";
import OrganicApplicationPdfModal from "./organicApplicationPDFModal";

import { useAuth } from "../../../store/authStore";
import { usePermissions } from "../../../hooks/usePermissions";

// Import your RevokeRequestModal
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

const BalanceHoursCard = ({ hours, loading, borderColor }) => {
  const showValue =
    hours === null || hours === undefined ? "0h" : `${fmtHours(hours)}h`;

  const chip = getIconChip("accent", borderColor);

  return (
    <div
      className="w-full rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm border transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border transition-colors duration-300 ease-out"
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

        <div className="flex items-center gap-3">
          <div
            className="leading-tight text-[15px] sm:text-base font-extrabold truncate"
            style={{ color: "var(--accent)" }}
          >
            {loading ? <Skeleton width={70} /> : showValue}
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setIsOpen(false);
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handle = (cb) => {
    cb?.();
    setIsOpen(false);
  };

  const status = String(app?.overallStatus || "").toUpperCase();
  const isPending = status === "PENDING";
  const isApproved = status === "APPROVED";
  const isRevocationRequested = status === "REVOCATION_REQUESTED";
  const hasMemos = Array.isArray(app?.memo) && app.memo.length > 0;

  return (
    <div className="relative inline-flex justify-end" ref={menuRef}>
      <button
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((o) => !o);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border shadow-sm text-xs cursor-pointer font-bold transition-all duration-200 ease-out active:scale-95"
        style={{
          backgroundColor: isOpen
            ? "var(--app-surface-2)"
            : "var(--app-surface)",
          borderColor: borderColor,
          color: isOpen ? "var(--accent)" : "var(--app-text)",
        }}
        title="Actions"
        type="button"
      >
        <span>Actions</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-52 rounded-lg z-30 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: "var(--app-surface)",
            border: `1px solid ${borderColor}`,
            boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
          }}
        >
          <button
            onClick={() => handle(onViewDetails)}
            className="w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition-colors text-left"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--app-muted)";
            }}
            type="button"
          >
            <Eye size={14} /> View Details
          </button>

          <button
            onClick={() => handle(onViewPdf)}
            className="w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition-colors text-left"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--app-muted)";
            }}
            type="button"
          >
            <FileDown size={14} /> View General PDF
          </button>

          {isOrganicApp && (
            <button
              onClick={() => handle(onViewCscForm6)}
              className="w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition-colors text-left"
              style={{ color: "var(--app-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
                e.currentTarget.style.color = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--app-muted)";
              }}
              type="button"
            >
              <FileBadge size={14} /> View CSC Form 6
            </button>
          )}

          <button
            disabled={!hasMemos}
            onClick={() => handle(onViewMemos)}
            className="w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--app-muted)";
            }}
            type="button"
          >
            <FileText size={14} /> View Memos
          </button>

          {isPending && (
            <button
              disabled={followingUp}
              onClick={() => handle(onFollowUp)}
              className="w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
              style={{ color: "var(--app-muted)" }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
                e.currentTarget.style.color = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--app-muted)";
              }}
              type="button"
            >
              <Bell size={14} /> {followingUp ? "Sending..." : "Send Follow-up"}
            </button>
          )}

          {isApproved && canRequestRevocation && (
            <button
              onClick={() => handle(onRequestRevoke)}
              className="w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition-colors text-left"
              style={{ color: "var(--app-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
                e.currentTarget.style.color = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--app-muted)";
              }}
              type="button"
            >
              <Undo size={14} /> Request Revocation
            </button>
          )}

          {isRevocationRequested && canRequestRevocation && (
            <button
              disabled={cancellingRevoke}
              onClick={() => handle(onCancelRevoke)}
              className="w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
              style={{ color: "#ef4444" }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              type="button"
            >
              <Ban size={14} />{" "}
              {cancellingRevoke ? "Cancelling..." : "Cancel Revocation"}
            </button>
          )}

          {isPending && (
            <button
              disabled={!isPending || cancelling}
              onClick={() => handle(onCancel)}
              className="w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
              type="button"
              style={{ color: "#ef4444" }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <Ban size={14} />{" "}
              {cancelling ? "Cancelling..." : "Cancel Request"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const ApplicationCard = ({
  app,
  leftStripClassName,
  onViewDetails,
  onViewPdf,
  onViewCscForm6,
  onViewMemos,
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

  const memoLabel =
    Array.isArray(app?.memo) && app.memo.length
      ? app.memo
          .map((m) => m?.memoId?.memoNo)
          .filter(Boolean)
          .join(", ")
      : "No Memo Reference";

  const submittedLabel = app?.createdAt
    ? new Date(app.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

  const coveredCount = Array.isArray(app?.inclusiveDates)
    ? app.inclusiveDates.length
    : 0;

  return (
    <div
      className={`rounded-xl shadow-sm overflow-hidden border-y border-r transition-colors duration-300 ease-out ${leftStripClassName}`}
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      <div className="p-4 transition-colors duration-300 ease-out">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-bold truncate transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                {memoLabel || "No Memo Reference"}
              </span>
            </div>

            <div
              className="mt-2 flex items-center gap-2 text-xs transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <Calendar
                className="w-4 h-4"
                style={{ color: "var(--app-muted)" }}
              />
              <span className="truncate">{submittedLabel}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 flex-none">
            <StatusBadge status={app?.overallStatus} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div
            className="rounded-lg border p-2 transition-colors duration-300 ease-out flex flex-col justify-center"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor: borderColor,
            }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <Clock className="w-3.5 h-3.5" /> Hours
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-sm font-semibold transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                {typeof app?.requestedHours === "number"
                  ? `${app.requestedHours}h`
                  : `${Number(app?.requestedHours || 0)}h`}
              </span>
              {/* ✅ LATE FILING INDICATOR ON CARD */}
              {/* {app.lateFiling?.isLateFiling && (
                <div
                  className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: "rgba(245,158,11,0.1)",
                    borderColor: "rgba(245,158,11,0.25)",
                    color: "#d97706",
                  }}
                  title="Filed with short notice."
                >
                  <Clock4 className="h-3 w-3" />
                  Late
                </div>
              )} */}
            </div>
          </div>

          <div
            className="rounded-lg border p-2 transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor: borderColor,
            }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <Layers className="w-3.5 h-3.5" /> Covered
            </div>
            <div
              className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {coveredCount} day(s)
            </div>
          </div>
        </div>
      </div>

      <div
        className="border-t p-3 transition-colors duration-300 ease-out"
        style={{
          borderColor: borderColor,
          backgroundColor: "var(--app-surface)",
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onViewDetails}
            className="flex-1 min-w-[80px] inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border transition-colors duration-200 ease-out"
            type="button"
            title="View Details"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
              color: "var(--accent)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--accent-soft)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
          >
            <Eye className="w-4 h-4" />
            Details
          </button>

          <button
            onClick={onViewPdf}
            className="flex-1 min-w-[80px] inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border transition-colors duration-200 ease-out"
            type="button"
            title="View PDF"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
              color: "var(--app-text)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
          >
            <FileDown className="w-4 h-4" />
            Gen PDF
          </button>

          {isOrganicApp && (
            <button
              onClick={onViewCscForm6}
              className="flex-1 min-w-[80px] inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border transition-colors duration-200 ease-out"
              type="button"
              title="View CSC Form 6"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
                color: "var(--app-text)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--app-surface)";
              }}
            >
              <FileBadge className="w-4 h-4" />
              Form 6
            </button>
          )}

          {isPending && (
            <button
              onClick={onFollowUp}
              disabled={followingUp}
              className="flex-1 min-w-[80px] inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
              type="button"
              title="Follow Up"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
                color: "var(--app-text)",
              }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--app-surface)";
              }}
            >
              <Bell className="w-4 h-4" />
              {followingUp ? "..." : "Follow Up"}
            </button>
          )}

          {isApproved && canRequestRevocation && (
            <button
              onClick={onRequestRevoke}
              className="flex-1 min-w-[80px] inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border transition-colors duration-200 ease-out"
              type="button"
              title="Request Revocation"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: borderColor,
                color: "var(--app-text)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--app-surface)";
              }}
            >
              <Undo className="w-4 h-4" />
              Revoke Req.
            </button>
          )}

          {isRevocationRequested && canRequestRevocation && (
            <button
              onClick={onCancelRevoke}
              disabled={cancellingRevoke}
              className="flex-1 min-w-[80px] inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
              type="button"
              title="Cancel Revocation"
              style={{
                backgroundColor: "rgba(239,68,68,0.12)",
                borderColor: "rgba(239,68,68,0.20)",
                color: "#ef4444",
              }}
            >
              <Ban className="w-4 h-4" />
              {cancellingRevoke ? "..." : "Cancel Revoke"}
            </button>
          )}

          {isPending && (
            <button
              onClick={onCancel}
              disabled={cancelling}
              className="flex-1 min-w-[80px] inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold border disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
              type="button"
              title="Cancel"
              style={{
                backgroundColor: "rgba(239,68,68,0.12)",
                borderColor: "rgba(239,68,68,0.20)",
                color: "#ef4444",
              }}
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
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: borderColor,
    }}
  >
    <div className="flex md:hidden items-center justify-between gap-3">
      <button
        onClick={onPrev}
        disabled={page === 1 || total === 0}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
        type="button"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: borderColor,
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
        onClick={onNext}
        disabled={page >= totalPages || total === 0}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
        type="button"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: borderColor,
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
        className="flex items-center gap-1 p-1 rounded-lg border transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor: borderColor,
        }}
      >
        <button
          onClick={onPrev}
          disabled={page === 1 || total === 0}
          className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
          type="button"
          style={{ color: "var(--app-muted)" }}
          onMouseEnter={(e) => {
            if (e.currentTarget.disabled) return;
            e.currentTarget.style.backgroundColor = "var(--app-surface)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
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
          onClick={onNext}
          disabled={page >= totalPages || total === 0}
          className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
          type="button"
          style={{ color: "var(--app-muted)" }}
          onMouseEnter={(e) => {
            if (e.currentTarget.disabled) return;
            e.currentTarget.style.backgroundColor = "var(--app-surface)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
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

  // ✅ Updated Revoke Modal State
  const [revokeModal, setRevokeModal] = useState({
    isOpen: false,
    app: null,
  });
  const openRevokeModal = (app) => setRevokeModal({ isOpen: true, app });
  const closeRevokeModal = () => setRevokeModal({ isOpen: false, app: null });

  // ✅ Cancel Revoke Modal State
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

  const scrollToTop = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getStatusColor = useCallback((status) => {
    switch (String(status || "").toUpperCase()) {
      case "APPROVED":
        return "border-l-4 border-l-emerald-500";
      case "REJECTED":
        return "border-l-4 border-l-rose-500";
      case "PENDING":
        return "border-l-4 border-l-amber-500";
      case "CANCELLED":
        return "border-l-4 border-l-slate-400";
      case "REVOCATION_REQUESTED":
        return "border-l-4 border-l-purple-500";
      case "REVOKED":
        return "border-l-4 border-l-slate-500";
      default:
        return "border-l-4 border-l-slate-300";
    }
  }, []);

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
    queryFn: () => {
      const payload = {
        page,
        limit,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      };
      return fetchMyCtoApplications(payload);
    },
    placeholderData: (prev) => prev,
  });

  const {
    data: creditSummaryData,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useQuery({
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

  // ✅ Cancel Revocation Request Mutation
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
    onError: (err) => {
      toast.error(err?.message || "Failed to send follow-up.");
    },
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
    onError: (err) => {
      toast.error(err?.message || "Failed to request revocation.");
    },
  });

  // ✅ Strict boolean checks (Supports both React Query v4 & v5 loading states safely)
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
    if (file) {
      formData.append("file", file);
    }

    await revokeRequestMutation.mutateAsync({
      id: app._id,
      payload: formData,
    });
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

  const formatSubmitted = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "-";

  const formatCoveredDates = (dates = []) =>
    (dates || [])
      .map((d) =>
        new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      )
      .join(", ");

  const balanceHours =
    data?.balanceHours ??
    data?.totals?.totalRemainingHours ??
    data?.totals?.remainingHours ??
    creditSummaryData?.totals?.totalRemainingHours ??
    null;

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

                {/* ✅ LAYOUT FIX: Stack buttons cleanly below balance hours */}
                <div className="w-full md:w-72 flex flex-col gap-3 shrink-0">
                  <BalanceHoursCard
                    hours={balanceHours}
                    loading={isBalanceLoading}
                    borderColor={borderColor}
                  />

                  {canApplySelf && (
                    <div className="flex flex-row items-center gap-2 w-full">
                      {/* Late Filing Button */}
                      <button
                        onClick={() =>
                          navigate(
                            isUserOrganic
                              ? "/app/cto-apply/organic?late=true"
                              : "/app/cto-apply/add?late=true",
                          )
                        }
                        className="group relative inline-flex items-center gap-2 justify-center rounded-lg px-3 py-2.5 text-[11px] sm:text-xs font-semibold shadow-sm transition-all w-full flex-1"
                        type="button"
                        style={{
                          backgroundColor: "rgba(245,158,11,0.12)",
                          color: "#d97706",
                          border: "1px solid rgba(245,158,11,0.25)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "rgba(245,158,11,0.20)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "rgba(245,158,11,0.12)";
                        }}
                      >
                        <Clock4 className="w-3.5 h-3.5 shrink-0" />
                        Late Filing
                      </button>

                      {/* New Application Button */}
                      <button
                        onClick={() =>
                          navigate(
                            isUserOrganic
                              ? "/app/cto-apply/organic"
                              : "/app/cto-apply/add",
                          )
                        }
                        className="group relative inline-flex items-center gap-2 justify-center rounded-lg px-3 py-2.5 text-[11px] sm:text-xs font-semibold shadow-sm transition-all w-full flex-1"
                        type="button"
                        style={{
                          backgroundColor: "var(--accent)",
                          color: "#fff",
                          border: "1px solid var(--accent)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.filter = "brightness(0.95)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.filter = "none";
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
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                }}
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
                          className="px-4 py-1.5 text-xs font-bold rounded-full border transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-2"
                          aria-pressed={isActive}
                          style={{
                            backgroundColor: isActive
                              ? t.bg
                              : "var(--app-surface)",
                            color: isActive ? t.text : "var(--app-muted)",
                            borderColor: isActive ? t.br : borderColor,
                          }}
                          onMouseEnter={(e) => {
                            if (isActive) return;
                            e.currentTarget.style.backgroundColor =
                              "var(--app-surface-2)";
                          }}
                          onMouseLeave={(e) => {
                            if (isActive) return;
                            e.currentTarget.style.backgroundColor =
                              "var(--app-surface)";
                          }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                          <span
                            className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ease-out"
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
                          borderColor: borderColor,
                          color: "var(--app-text)",
                        }}
                      />
                      {searchInput && (
                        <button
                          type="button"
                          onClick={() => setSearchInput("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors duration-200 ease-out"
                          style={{ color: "var(--app-muted)" }}
                          aria-label="Clear search"
                          title="Clear"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>

                    <div
                      className="hidden lg:flex items-center gap-2 pl-3 border-l"
                      style={{ borderColor: borderColor }}
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
                        className="border text-xs rounded-lg block p-1.5 font-medium outline-none cursor-pointer transition-colors duration-200 ease-out"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor: borderColor,
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
                      style={{ borderColor: borderColor }}
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
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-[10px] font-bold uppercase"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Active:
                      </span>
                      {searchFilter && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium"
                          style={{
                            backgroundColor: "var(--accent-soft)",
                            color: "var(--accent)",
                            borderColor:
                              "var(--accent-soft2, rgba(37,99,235,0.18))",
                          }}
                        >
                          "{searchFilter}"
                        </span>
                      )}
                      {statusFilter && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium"
                          style={{
                            backgroundColor: "var(--accent-soft)",
                            color: "var(--accent)",
                            borderColor:
                              "var(--accent-soft2, rgba(37,99,235,0.18))",
                          }}
                        >
                          {statusFilter}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="flex items-center gap-1 text-[10px] font-bold uppercase"
                      style={{ color: "var(--accent)" }}
                    >
                      <RotateCcw size={10} /> Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Data region */}
              <div
                className="min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-y-auto overflow-x-hidden lg:overflow-x-auto transition-colors duration-300 ease-out cto-scrollbar"
                style={{ backgroundColor: "var(--app-bg)" }}
              >
                {!isLoading && applications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                    <div
                      className="p-6 rounded-full mb-4 ring-1"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor: borderColor,
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
                        onClick={handleResetFilters}
                        className="mt-6 flex items-center gap-2 px-4 py-2 text-xs font-bold border rounded-lg transition-colors duration-200 ease-out"
                        type="button"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor: borderColor,
                          color: "var(--app-text)",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "var(--app-surface-2)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "var(--app-surface)")
                        }
                      >
                        <RotateCcw size={12} /> Clear Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="block md:hidden p-4">
                      <div className="space-y-3">
                        {isLoading
                          ? [...Array(Math.min(limit, 6))].map((_, i) => (
                              <div
                                key={i}
                                className="rounded-xl shadow-sm p-4 border transition-colors duration-300 ease-out"
                                style={{
                                  backgroundColor: "var(--app-surface)",
                                  borderColor: borderColor,
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
                                <div className="mt-4">
                                  <Skeleton height={40} />
                                </div>
                              </div>
                            ))
                          : applications.map((app) => {
                              const cancelling =
                                isCancelLoading &&
                                cancelMutation.variables === app._id;
                              const followingUp =
                                isFollowUpLoading &&
                                followUpMutation.variables === app._id;
                              const cancellingRevoke =
                                isCancelRevokeLoading &&
                                cancelRevokeMutation.variables === app._id;

                              const isAppOrganic =
                                app?.employeeType === "Organic" ||
                                app?.category === "Organic" ||
                                isUserOrganic;

                              return (
                                <ApplicationCard
                                  key={app._id}
                                  app={app}
                                  borderColor={borderColor}
                                  leftStripClassName={getStatusColor(
                                    app.overallStatus,
                                  )}
                                  cancelling={cancelling}
                                  followingUp={followingUp}
                                  cancellingRevoke={cancellingRevoke}
                                  isOrganicApp={isAppOrganic}
                                  canRequestRevocation={canRequestRevocation}
                                  onViewDetails={() => setSelectedApp(app)}
                                  onViewPdf={() =>
                                    setPdfApp({ ...app, ledger: data?.ledger })
                                  }
                                  onViewCscForm6={() =>
                                    setOrganicPdfApp({
                                      ...app,
                                      ledger: data?.ledger,
                                    })
                                  }
                                  onViewMemos={() => openMemoModal(app.memo)}
                                  onCancel={() => openCancelModal(app)}
                                  onFollowUp={() => openFollowUpModal(app)}
                                  onRequestRevoke={() => openRevokeModal(app)}
                                  onCancelRevoke={() =>
                                    openCancelRevokeModal(app)
                                  }
                                />
                              );
                            })}
                      </div>
                    </div>

                    {/* Tablet */}
                    <div className="hidden md:block lg:hidden p-4">
                      <div className="grid grid-cols-2 gap-3">
                        {isLoading
                          ? [...Array(Math.min(limit, 6))].map((_, i) => (
                              <div
                                key={i}
                                className="rounded-xl shadow-sm p-4 border transition-colors duration-300 ease-out"
                                style={{
                                  backgroundColor: "var(--app-surface)",
                                  borderColor: borderColor,
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
                                <div className="mt-4">
                                  <Skeleton height={40} />
                                </div>
                              </div>
                            ))
                          : applications.map((app) => {
                              const cancelling =
                                isCancelLoading &&
                                cancelMutation.variables === app._id;
                              const followingUp =
                                isFollowUpLoading &&
                                followUpMutation.variables === app._id;
                              const cancellingRevoke =
                                isCancelRevokeLoading &&
                                cancelRevokeMutation.variables === app._id;

                              const isAppOrganic =
                                app?.employeeType === "Organic" ||
                                app?.category === "Organic" ||
                                isUserOrganic;

                              return (
                                <ApplicationCard
                                  key={app._id}
                                  app={app}
                                  borderColor={borderColor}
                                  leftStripClassName={getStatusColor(
                                    app.overallStatus,
                                  )}
                                  cancelling={cancelling}
                                  followingUp={followingUp}
                                  cancellingRevoke={cancellingRevoke}
                                  isOrganicApp={isAppOrganic}
                                  canRequestRevocation={canRequestRevocation}
                                  onViewDetails={() => setSelectedApp(app)}
                                  onViewPdf={() =>
                                    setPdfApp({ ...app, ledger: data?.ledger })
                                  }
                                  onViewCscForm6={() =>
                                    setOrganicPdfApp({
                                      ...app,
                                      ledger: data?.ledger,
                                    })
                                  }
                                  onViewMemos={() => openMemoModal(app.memo)}
                                  onCancel={() => openCancelModal(app)}
                                  onFollowUp={() => openFollowUpModal(app)}
                                  onRequestRevoke={() => openRevokeModal(app)}
                                  onCancelRevoke={() =>
                                    openCancelRevokeModal(app)
                                  }
                                />
                              );
                            })}
                      </div>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block w-full align-middle">
                      <table className="w-full text-left">
                        <thead
                          className="sticky top-0 z-10 border-b transition-colors duration-300 ease-out"
                          style={{
                            backgroundColor: "var(--app-surface)",
                            borderColor: borderColor,
                          }}
                        >
                          <tr
                            className="text-[10px] uppercase tracking-[0.12em] font-bold"
                            style={{ color: "var(--app-muted)" }}
                          >
                            <th className="px-6 py-4 font-bold">
                              Reference / Memo
                            </th>
                            <th className="px-6 py-4 text-center">Hours</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-center">Submitted</th>
                            <th className="px-6 py-4">Dates Covered</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>

                        <tbody>
                          {isLoading
                            ? [...Array(8)].map((_, i) => (
                                <tr key={i}>
                                  {[...Array(6)].map((__, j) => (
                                    <td key={j} className="px-6 py-4">
                                      <Skeleton />
                                    </td>
                                  ))}
                                </tr>
                              ))
                            : applications.map((app, i) => {
                                const memoLabel =
                                  Array.isArray(app.memo) && app.memo.length
                                    ? app.memo
                                        .map((m) => m?.memoId?.memoNo)
                                        .filter(Boolean)
                                        .join(", ")
                                    : "No Memo Attached";

                                const bg =
                                  i % 2 === 0
                                    ? "var(--app-surface)"
                                    : "var(--app-surface-2)";

                                const cancelling =
                                  isCancelLoading &&
                                  cancelMutation.variables === app._id;
                                const followingUp =
                                  isFollowUpLoading &&
                                  followUpMutation.variables === app._id;
                                const cancellingRevoke =
                                  isCancelRevokeLoading &&
                                  cancelRevokeMutation.variables === app._id;

                                const isAppOrganic =
                                  app?.employeeType === "Organic" ||
                                  app?.category === "Organic" ||
                                  isUserOrganic;

                                return (
                                  <tr
                                    key={app._id}
                                    className="transition-colors duration-200 ease-out"
                                    style={{ backgroundColor: bg }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        "var(--accent-soft)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        bg;
                                    }}
                                  >
                                    <td className="px-6 py-4">
                                      <div className="flex flex-col">
                                        <span
                                          className="font-semibold text-sm"
                                          style={{ color: "var(--app-text)" }}
                                        >
                                          {memoLabel}
                                        </span>
                                        <span
                                          className="text-[10px] font-mono mt-0.5"
                                          style={{ color: "var(--app-muted)" }}
                                        >
                                          ID:{" "}
                                          {app._id
                                            ? app._id.slice(-6).toUpperCase()
                                            : "-"}
                                        </span>
                                      </div>
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                      <div className="flex flex-col items-center gap-1.5">
                                        <span
                                          className="inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-bold"
                                          style={{
                                            backgroundColor:
                                              "var(--app-surface)",
                                            borderColor: borderColor,
                                            color: "var(--app-text)",
                                          }}
                                        >
                                          {app.requestedHours}h
                                        </span>
                                        {/* ✅ LATE FILING INDICATOR ON TABLE
                                        {app.lateFiling?.isLateFiling && (
                                          <div
                                            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border"
                                            style={{
                                              backgroundColor:
                                                "rgba(245,158,11,0.1)",
                                              borderColor:
                                                "rgba(245,158,11,0.25)",
                                              color: "#d97706",
                                            }}
                                            title="Filed with short notice."
                                          >
                                            <Clock4 className="h-3 w-3" />
                                            Late
                                          </div>
                                        )} */}
                                      </div>
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                      <StatusBadge status={app.overallStatus} />
                                    </td>

                                    <td
                                      className="px-6 py-4 text-center text-sm"
                                      style={{ color: "var(--app-muted)" }}
                                    >
                                      {formatSubmitted(app.createdAt)}
                                    </td>

                                    <td
                                      className="px-6 py-4 text-sm"
                                      style={{ color: "var(--app-muted)" }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Calendar
                                          size={14}
                                          style={{ color: "var(--app-muted)" }}
                                        />
                                        <span className="truncate">
                                          {formatCoveredDates(
                                            app.inclusiveDates,
                                          )}
                                        </span>
                                      </div>
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                      <ApplicationActionMenu
                                        app={app}
                                        borderColor={borderColor}
                                        isOrganicApp={isAppOrganic}
                                        canRequestRevocation={
                                          canRequestRevocation
                                        }
                                        onViewDetails={() =>
                                          setSelectedApp(app)
                                        }
                                        onViewPdf={() =>
                                          setPdfApp({
                                            ...app,
                                            ledger: data?.ledger,
                                          })
                                        }
                                        onViewCscForm6={() =>
                                          setOrganicPdfApp({
                                            ...app,
                                            ledger: data?.ledger,
                                          })
                                        }
                                        onViewMemos={() =>
                                          openMemoModal(app.memo)
                                        }
                                        onCancel={() => openCancelModal(app)}
                                        cancelling={cancelling}
                                        onFollowUp={() =>
                                          openFollowUpModal(app)
                                        }
                                        followingUp={followingUp}
                                        onRequestRevoke={() =>
                                          openRevokeModal(app)
                                        }
                                        onCancelRevoke={() =>
                                          openCancelRevokeModal(app)
                                        }
                                        cancellingRevoke={cancellingRevoke}
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
              className="md:hidden fixed bottom-5 z-[1] h-10 w-10 rounded-full shadow-lg active:scale-95 transition-colors duration-200 ease-out flex items-center justify-center"
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

          {/* ✅ General PDF Modal (controlled by !!pdfApp state) */}
          {pdfApp && (
            <CtoApplicationPdfModal
              app={pdfApp}
              isOpen={!!pdfApp}
              onClose={() => setPdfApp(null)}
            />
          )}

          {/* ✅ Organic PDF Modal (controlled by !!organicPdfApp state) */}
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

          {/* Follow Up Confirm Modal */}
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
              <div
                className="mb-5 flex items-start gap-3 p-3 rounded-xl border"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                }}
              >
                <div
                  className="mt-0.5 p-1.5 rounded-lg border shadow-sm"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: borderColor,
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
                    You are about to notify approvers
                  </p>
                  <p
                    className="text-sm font-bold break-words"
                    style={{ color: "var(--app-text)" }}
                  >
                    Ref:{" "}
                    {followUpModal.app?._id
                      ? `#${followUpModal.app._id.slice(-6).toUpperCase()}`
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="text-center py-2">
                <div
                  className="mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-4 border-4 shadow-inner"
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.12)",
                    color: "#f59e0b",
                    borderColor: "rgba(245, 158, 11, 0.25)",
                  }}
                >
                  <Bell size={40} strokeWidth={3} />
                </div>
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--app-text)" }}
                >
                  Are you sure you want to send a follow-up?
                </h2>
                <p
                  className="text-sm mt-2"
                  style={{ color: "var(--app-muted)" }}
                >
                  This will send a reminder to the pending approvers for this
                  CTO application.
                </p>
              </div>
            </div>
          </Modal>

          {/* ✅ Request Revocation Modal Implementation */}
          <RevokeRequestModal
            isOpen={revokeModal.isOpen}
            onClose={closeRevokeModal}
            app={revokeModal.app}
            isBusy={isRevokeLoading} // Passed properly as a strict boolean
            isAttachmentRequired={isAttachmentRequired}
            borderColor={borderColor}
            onSubmit={handleRevokeSubmit}
          />

          {/* ✅ Cancel Revocation Request Modal */}
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
              <div
                className="mb-5 flex items-start gap-3 p-3 rounded-xl border"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                }}
              >
                <div
                  className="mt-0.5 p-1.5 rounded-lg border shadow-sm"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: borderColor,
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
                    You are withdrawing your request
                  </p>
                  <p
                    className="text-sm font-bold break-words"
                    style={{ color: "var(--app-text)" }}
                  >
                    Ref:{" "}
                    {cancelRevokeModal.app?._id
                      ? `#${cancelRevokeModal.app._id.slice(-6).toUpperCase()}`
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="text-center py-2">
                <div
                  className="mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-4 border-4 shadow-inner"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.12)",
                    color: "#ef4444",
                    borderColor: "rgba(239,68,68,0.20)",
                  }}
                >
                  <Ban size={40} strokeWidth={3} />
                </div>
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--app-text)" }}
                >
                  Withdraw this revocation request?
                </h2>
                <p
                  className="text-sm mt-2"
                  style={{ color: "var(--app-muted)" }}
                >
                  This action will revert your CTO back to its APPROVED state.
                  You can request another revocation later if needed.
                </p>
              </div>
            </div>
          </Modal>

          {/* Cancel Confirm Modal */}
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
              <div
                className="mb-5 flex items-start gap-3 p-3 rounded-xl border"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                }}
              >
                <div
                  className="mt-0.5 p-1.5 rounded-lg border shadow-sm"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: borderColor,
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
                    You are about to cancel this request
                  </p>
                  <p
                    className="text-sm font-bold break-words"
                    style={{ color: "var(--app-text)" }}
                  >
                    Ref:{" "}
                    {cancelModal.app?._id
                      ? `#${cancelModal.app._id.slice(-6).toUpperCase()}`
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="text-center py-2">
                <div
                  className="mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-4 border-4 shadow-inner"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.12)",
                    color: "#ef4444",
                    borderColor: "rgba(239,68,68,0.20)",
                  }}
                >
                  <Ban size={40} strokeWidth={3} />
                </div>
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--app-text)" }}
                >
                  Are you sure you want to cancel this application?
                </h2>
                <p
                  className="text-sm mt-2"
                  style={{ color: "var(--app-muted)" }}
                >
                  This will stop the approval workflow and update your balances
                  accordingly.
                </p>
              </div>
            </div>
          </Modal>

          {/* Memo Modal */}
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
                description={"References used for this compensation request."}
              />
            </div>
          </Modal>
        </SkeletonTheme>
      </div>
    </FullHeightCardContainer>
  );
};

export default MyCtoApplications;
