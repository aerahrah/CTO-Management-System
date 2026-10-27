import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import { fetchAllCreditRequests, rollbackCreditCto } from "../../../api/cto";
import { StatusBadge } from "../../statusUtils";
import Modal from "../../modal";
import { toast } from "react-toastify";
import Breadcrumbs from "../../breadCrumbs";

import FilterSelect from "../../filterSelect";
import CtoCreditDetails from "./ctoCreditFullDetails";
import { buildApiUrl } from "../../../config/env";
import { useAuth } from "../../../store/authStore";
import { usePermissions } from "../../../hooks/usePermissions";
import useUrlDetails from "../../../hooks/useUrlDetails";
import FullHeightCardContainer from "../../pageContainer";
import {
  Clipboard,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Inbox,
  Layers,
  CheckCircle2,
  Eye,
  Users,
  Calendar,
  Clock,
  FileText,
  ArrowUp,
  ChevronDown,
} from "lucide-react";

const pageSizeOptions = [20, 50, 100];

/* ------------------ Resolve theme ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* ------------------ Interaction tints ------------------ */
// Solid hover / pressed shades derived from the surface color. They darken in
// light mode and lighten in dark mode (darkening an already-dark surface is
// almost invisible), so the "this is clickable" cue shows in both themes.
const interactionVarsFor = (theme) => {
  const isDark = theme === "dark";
  const ink = isDark ? "#ffffff" : "#0f172a";
  return {
    "--wl-hover": `color-mix(in srgb, var(--app-surface) ${isDark ? 88 : 91}%, ${ink})`,
    "--wl-press": `color-mix(in srgb, var(--app-surface) ${isDark ? 80 : 84}%, ${ink})`,
  };
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]";

/* ------------------ Row / card click helpers ------------------ */
// A click on a control inside a row or card must not also open the details
// modal. This includes the action menu: it is portaled to <body>, but React
// still bubbles its events up to the row.
const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, label, [role='menu'], [role='menuitem'], [data-no-row-click]";

const shouldOpenFromClick = (e) => {
  if (e.defaultPrevented) return false;
  const target = e.target;
  if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) {
    return false;
  }
  // Let people highlight/copy text (e.g. a memo number) without opening the modal
  const selection =
    typeof window !== "undefined" ? window.getSelection?.() : null;
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    return false;
  }
  return true;
};

const isActivationKey = (e) => e.key === "Enter" || e.key === " ";

const getStatusTabs = (counts = {}) => [
  {
    id: "",
    label: "All Credits",
    icon: Layers,
    count: counts.total || 0,
    activeStyle: {
      backgroundColor: "var(--accent-soft)",
      color: "var(--accent)",
      borderColor: "var(--accent-soft2)",
    },
  },
  {
    id: "CREDITED",
    label: "Credited",
    icon: CheckCircle2,
    count: counts.credited || 0,
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
    count: counts.rolledBack || 0,
    activeStyle: {
      backgroundColor: "rgba(239,68,68,0.14)",
      color: "#ef4444",
      borderColor: "rgba(239,68,68,0.25)",
    },
  },
];

/* ------------------ Action menu (portal, never clipped) ------------------ */
const MENU_WIDTH = 192;

// "Actions" trigger: solid accent like the File Leave / apply buttons so it's
// easy to spot in every row; darker on hover, darker still while its menu is open.
const ACTIONS_BTN =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none shadow-sm " +
  "bg-[color:var(--accent)] text-white border-[color:var(--accent)] " +
  "transition-all duration-150 ease-out hover:shadow-md active:scale-95 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface)] " +
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:shadow-sm";

const ACTIONS_BTN_IDLE =
  "hover:brightness-90 active:brightness-[0.82] disabled:hover:brightness-100";

const ACTIONS_BTN_OPEN = "brightness-[0.85]";

// Shared menu-item styles: pointer cursor, darker hover, darker still on press
const MENU_ITEM_BASE =
  "w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 text-left cursor-pointer " +
  "transition-colors duration-150 ease-out focus-visible:outline-none " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

const MENU_ITEM_NEUTRAL =
  `${MENU_ITEM_BASE} text-[color:var(--app-text)] ` +
  "hover:bg-[color:var(--wl-hover)] hover:text-[color:var(--accent)] " +
  "active:bg-[color:var(--wl-press)] focus-visible:bg-[color:var(--wl-hover)] " +
  "disabled:hover:bg-transparent disabled:hover:text-[color:var(--app-text)]";

const MENU_ITEM_DANGER =
  `${MENU_ITEM_BASE} text-[#ef4444] ` +
  "hover:bg-[rgba(239,68,68,0.16)] active:bg-[rgba(239,68,68,0.24)] " +
  "focus-visible:bg-[rgba(239,68,68,0.16)] disabled:hover:bg-transparent";

const ActionMenu = ({
  credit,
  onViewMemo,
  onViewDetails,
  onRollback,
  isRollbackPending,
  borderColor,
  canManageCredits,
  interactionVars,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, visible: false });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const canRollback = credit?.status === "CREDITED" && !isRollbackPending;

  // Close the menu if a rollback starts while it is open
  useEffect(() => {
    if (isRollbackPending) setIsOpen(false);
  }, [isRollbackPending]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    // Global theme CSS may put a `transition` on every element. Without this
    // the menu visibly slides in from the top-left corner when top/left are set.
    menuRef.current?.style.setProperty("transition", "none", "important");
    const btn = btnRef.current?.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 160;
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

  const handle = (cb) => {
    setIsOpen(false);
    cb?.();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation(); // don't open the row's details
          if (isRollbackPending) return;
          setPos((p) => ({ ...p, visible: false }));
          setIsOpen((o) => !o);
        }}
        disabled={isRollbackPending}
        className={`${ACTIONS_BTN} ${
          isOpen ? ACTIONS_BTN_OPEN : ACTIONS_BTN_IDLE
        }`}
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
            aria-label="Credit actions"
            // Portaled, but React still bubbles clicks to the row: stop them here
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{
              ...interactionVars,
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              zIndex: 1000,
              visibility: pos.visible ? "visible" : "hidden",
              backgroundColor: "var(--app-surface)",
              border: `1px solid ${borderColor}`,
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            }}
          >
            <button
              type="button"
              role="menuitem"
              disabled={isRollbackPending}
              onClick={() => handle(onViewMemo)}
              className={MENU_ITEM_NEUTRAL}
            >
              <Eye size={14} /> View Memo
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={isRollbackPending}
              onClick={() => handle(onViewDetails)}
              className={MENU_ITEM_NEUTRAL}
            >
              <Clipboard size={14} /> View Details
            </button>

            {canManageCredits && (
              <>
                <div
                  className="h-px my-1"
                  style={{ backgroundColor: "var(--app-border)" }}
                />
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canRollback}
                  onClick={() => handle(onRollback)}
                  className={MENU_ITEM_DANGER}
                >
                  <RotateCcw size={14} />{" "}
                  {isRollbackPending ? "Rolling back..." : "Rollback"}
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
};

/* ------------------ Employees cell (desktop table) ------------------ */
const MAX_VISIBLE_EMPLOYEES = 3;

const getInitials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

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
            className="inline-flex items-center gap-1.5 max-w-[190px] pl-0.5 pr-2.5 py-0.5 rounded-full border text-xs font-medium transition-colors duration-200 ease-out"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: borderColor,
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
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation(); // expand the names, not open the row's details
              setExpanded((v) => !v);
            }}
            title={
              expanded
                ? "Show less"
                : names.slice(MAX_VISIBLE_EMPLOYEES).join(", ")
            }
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-bold cursor-pointer select-none transition-all duration-150 ease-out hover:brightness-90 hover:shadow-sm active:scale-95 ${FOCUS_RING}`}
            style={{
              backgroundColor: "var(--accent-soft)",
              borderColor: "var(--accent-soft2)",
              color: "var(--accent)",
            }}
          >
            {expanded ? "Show less" : `+${hiddenCount} more`}
          </button>
        )}
      </div>
    </div>
  );
};

/* ------------------ Mobile/Tablet Card ------------------ */
const CreditCard = ({
  credit,
  isRollbackPending,
  onViewMemo,
  onViewDetails,
  onRollback,
  formatDuration,
  formatDate,
  leftStripClassName,
  borderColor,
  canManageCredits,
  interactionVars,
}) => {
  const employeesLabel = useMemo(() => {
    const names =
      credit?.employees?.map((e) =>
        `${e.employee?.firstName || ""} ${e.employee?.lastName || ""}`.trim(),
      ) || [];
    return names.filter(Boolean).join(", ") || "-";
  }, [credit]);

  const shortId = credit?._id ? credit._id.slice(-6).toUpperCase() : "-";
  const canRollback = credit.status === "CREDITED" && !isRollbackPending;

  const btn = `inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border cursor-pointer transition-colors duration-150 ease-out active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${FOCUS_RING}`;
  const neutralBtn = `${btn} flex-1 bg-[color:var(--app-surface)] hover:bg-[color:var(--wl-hover)] active:bg-[color:var(--wl-press)] disabled:hover:bg-[color:var(--app-surface)]`;
  const dangerBtn = `${btn} bg-[rgba(239,68,68,0.10)] hover:bg-[rgba(239,68,68,0.20)] active:bg-[rgba(239,68,68,0.28)] disabled:opacity-30 disabled:hover:bg-[rgba(239,68,68,0.10)]`;

  return (
    <div
      tabIndex={0}
      // Tapping anywhere on the card (except its buttons) opens the details
      onClick={(e) => {
        if (!isRollbackPending && shouldOpenFromClick(e)) onViewDetails();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || !isActivationKey(e)) return;
        e.preventDefault();
        if (!isRollbackPending) onViewDetails();
      }}
      className={`rounded-xl shadow-sm overflow-hidden border-y border-r cursor-pointer transition-[box-shadow,background-color] duration-200 ease-out hover:shadow-md ${FOCUS_RING} ${leftStripClassName}`}
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
                {credit.memoNo || "-"}
              </span>
              <span
                className="text-[10px] font-mono transition-colors duration-300 ease-out"
                style={{ color: "var(--app-muted)" }}
              >
                #{shortId}
              </span>
            </div>

            <div className="mt-2 flex items-start gap-2">
              <Users
                className="w-4 h-4 mt-[2px] flex-none"
                style={{ color: "var(--app-muted)" }}
              />
              <div
                className="text-xs leading-snug line-clamp-2 transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                {employeesLabel}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 flex-none">
            <StatusBadge status={credit.status} />
            <ActionMenu
              credit={credit}
              borderColor={borderColor}
              interactionVars={interactionVars}
              isRollbackPending={isRollbackPending}
              onViewMemo={onViewMemo}
              onViewDetails={onViewDetails}
              onRollback={onRollback}
              canManageCredits={canManageCredits}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
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
              <Clock className="w-3.5 h-3.5" /> Duration
            </div>
            <div
              className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {formatDuration(credit.duration)}
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
              <Calendar className="w-3.5 h-3.5" /> Approved
            </div>
            <div
              className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {formatDate(credit.dateApproved)}
            </div>
          </div>
        </div>
      </div>

      {/* Button bar: taps in the gaps between buttons don't open details */}
      <div
        data-no-row-click
        className="border-t p-3 cursor-default transition-colors duration-300 ease-out"
        style={{
          borderColor: borderColor,
          backgroundColor: "var(--app-surface)",
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isRollbackPending}
            onClick={onViewMemo}
            className={neutralBtn}
            style={{ borderColor: borderColor, color: "var(--accent)" }}
          >
            <FileText className="w-4 h-4" />
            Memo
          </button>

          <button
            type="button"
            disabled={isRollbackPending}
            onClick={onViewDetails}
            className={neutralBtn}
            style={{ borderColor: borderColor, color: "var(--accent)" }}
          >
            <Clipboard className="w-4 h-4" />
            Details
          </button>

          {canManageCredits && (
            <button
              type="button"
              disabled={!canRollback}
              onClick={onRollback}
              className={dangerBtn}
              style={{
                borderColor: "rgba(239,68,68,0.25)",
                color: "#ef4444",
              }}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isRollbackPending ? "Rolling..." : "Rollback"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------ Compact Pagination ------------------ */
const CompactPagination = ({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPrev,
  onNext,
  borderColor,
}) => {
  const prevDisabled = page === 1 || total === 0;
  const nextDisabled = page >= totalPages || total === 0;

  const mobileBtn = `inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold cursor-pointer transition-colors duration-150 ease-out bg-[color:var(--app-surface)] text-[color:var(--app-text)] enabled:hover:bg-[color:var(--wl-hover)] enabled:active:bg-[color:var(--wl-press)] disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS_RING}`;

  const iconBtn = `p-1.5 rounded-md cursor-pointer transition-colors duration-150 ease-out enabled:hover:bg-[color:var(--wl-hover)] enabled:active:bg-[color:var(--wl-press)] disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS_RING}`;

  return (
    <div
      className="px-4 md:px-6 py-3 border-t transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: borderColor,
      }}
    >
      {/* Mobile/tablet */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={prevDisabled}
          className={mobileBtn}
          style={{ borderColor: borderColor }}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="text-center min-w-0">
          <div
            className="text-xs font-mono font-semibold transition-colors duration-300 ease-out"
            style={{ color: "var(--app-text)" }}
          >
            {page} / {totalPages}
          </div>
          <div
            className="text-[11px] truncate transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {total === 0 ? "0 results" : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className={mobileBtn}
          style={{ borderColor: borderColor }}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop */}
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
          credits
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-lg border transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface-2)",
            borderColor: borderColor,
          }}
        >
          <button
            type="button"
            onClick={onPrev}
            disabled={prevDisabled}
            className={iconBtn}
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
            disabled={nextDisabled}
            className={iconBtn}
            style={{ color: "var(--app-muted)" }}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* Shown in the details modal while a linked record is being loaded */
const DetailsLoading = () => (
  <div
    role="status"
    className="flex flex-col items-center justify-center gap-3 py-20 text-sm"
    style={{ color: "var(--app-muted)" }}
  >
    <span className="h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin" />
    Loading details…
  </div>
);

const CtoCreditHistory = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { can } = usePermissions();
  const canManageCredits = can("cto.credits_manage");

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  // CSS vars for hover / pressed shades (also passed to the portaled menu)
  const interactionVars = useMemo(
    () => interactionVarsFor(resolvedTheme),
    [resolvedTheme],
  );

  const skeletonColors = useMemo(() => {
    if (resolvedTheme === "dark") {
      return {
        baseColor: "rgba(255,255,255,0.06)",
        highlightColor: "rgba(255,255,255,0.10)",
      };
    }
    return {
      baseColor: "rgba(15,23,42,0.06)",
      highlightColor: "rgba(15,23,42,0.10)",
    };
  }, [resolvedTheme]);

  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [memoModal, setMemoModal] = useState({ isOpen: false, memo: null });

  const [isConfirmRollback, setIsConfirmRollback] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState(null);

  const rollbackInFlightRef = useRef(false);
  const rollbackSuccessLatchRef = useRef(false);
  const [rollbackLockUI, setRollbackLockUI] = useState(false);
  const [rollbackSuccessLatchUI, setRollbackSuccessLatchUI] = useState(false);

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

  const getStatusStripClass = useCallback((status) => {
    switch (status) {
      case "CREDITED":
        return "border-l-4 border-l-emerald-500";
      case "ROLLEDBACK":
        return "border-l-4 border-l-rose-500";
      default:
        return "border-l-4 border-l-slate-300";
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchFilter(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["allCredits", page, limit, statusFilter, searchFilter],
    queryFn: () =>
      fetchAllCreditRequests({
        page,
        limit,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const credits = useMemo(() => data?.credits || [], [data]);

  // Details modal state lives in the URL (?credit=<id>): Back closes it,
  // refresh keeps it, and the link can be shared with another admin.
  const details = useUrlDetails({
    param: "credit",
    items: credits,
    ready: !isLoading,
    onMissing: () => toast.info("That credit entry couldn't be found."),
  });

  const pagination = useMemo(
    () => ({
      page: data?.page || 1,
      totalPages: Math.max(Math.ceil((data?.total || 0) / limit), 1),
      total: data?.total || 0,
    }),
    [data, limit],
  );

  useEffect(() => {
    setPage((p) => {
      if (p > pagination.totalPages) return pagination.totalPages;
      if (p < 1) return 1;
      return p;
    });
  }, [pagination.totalPages]);

  const rollbackMutation = useMutation({
    mutationFn: rollbackCreditCto,
    retry: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allCredits"] });

      rollbackSuccessLatchRef.current = true;
      setRollbackSuccessLatchUI(true);

      toast.success("CTO credit successfully rolled back!");

      setIsConfirmRollback(false);
      setSelectedCreditId(null);

      setTimeout(() => {
        rollbackInFlightRef.current = false;
        rollbackSuccessLatchRef.current = false;
        setRollbackLockUI(false);
        setRollbackSuccessLatchUI(false);
      }, 0);
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message || error?.message || "Rollback failed.",
      );

      rollbackInFlightRef.current = false;
      rollbackSuccessLatchRef.current = false;
      setRollbackLockUI(false);
      setRollbackSuccessLatchUI(false);
      setIsConfirmRollback(false);
    },
  });

  const isRollbackPending =
    rollbackMutation.isPending || rollbackLockUI || rollbackSuccessLatchUI;

  const formatDuration = useCallback(
    (d) => (d ? `${d.hours || 0}h ${d.minutes || 0}m` : "-"),
    [],
  );

  const formatDate = useCallback(
    (iso) =>
      iso
        ? new Date(iso).toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "-",
    [],
  );

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const isFiltered = statusFilter !== "" || searchFilter !== "";

  const startItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * limit + 1;
  const endItem =
    pagination.total === 0
      ? 0
      : Math.min(pagination.page * limit, pagination.total);

  const grandTotals = useMemo(() => {
    const credited = data?.grandTotals?.credited || 0;
    const rolledBack = data?.grandTotals?.rolledBack || 0;
    return { credited, rolledBack, total: credited + rolledBack };
  }, [data]);

  const memoPdfUrl = useMemo(() => {
    const p = memoModal?.memo?.uploadedMemo;
    if (!p) return "";
    return buildApiUrl(String(p).replace(/\\/g, "/"));
  }, [memoModal?.memo?.uploadedMemo]);

  const startRollback = useCallback(
    (creditId) => {
      if (!creditId) return;
      if (rollbackSuccessLatchRef.current) return;
      if (rollbackInFlightRef.current) return;
      if (rollbackMutation.isPending) return;

      rollbackInFlightRef.current = true;
      setRollbackLockUI(true);

      rollbackMutation.mutate(creditId);
    },
    [rollbackMutation],
  );

  const openDetails = (credit) => details.open(credit);
  const openMemo = (credit) => setMemoModal({ isOpen: true, memo: credit });
  const askRollback = (credit) => {
    if (isRollbackPending) return;
    setSelectedCreditId(credit._id);
    setIsConfirmRollback(true);
  };

  return (
    <FullHeightCardContainer>
      <div
        className="w-full  h-full min-h-0 flex flex-col md:p-0 transition-colors duration-300 ease-out"
        style={{
          ...interactionVars,
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
            <div className="pt-2 pb-3 md:pb-6 px-1">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <Breadcrumbs rootLabel="home" rootTo="/app" />
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-sans">
                    CTO Credit History
                  </h1>
                  <p
                    className="text-sm mt-1 max-w-2xl transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Manage and monitor CTO credits issued to employees
                  </p>
                </div>

                {canManageCredits && (
                  <button
                    type="button"
                    onClick={() => {
                      queryClient.invalidateQueries({
                        queryKey: ["ctoCreditEmployees"],
                      });
                      navigate("/app/cto-credit/add");
                    }}
                    className={`group relative inline-flex items-center gap-2 justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md cursor-pointer transition-all duration-200 ease-out hover:brightness-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto ${FOCUS_RING}`}
                    style={{ backgroundColor: "var(--accent, #2563EB)" }}
                  >
                    <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                    Credit CTO
                  </button>
                )}
              </div>
            </div>

            <div
              className="flex flex-col rounded-xl shadow-sm overflow-visible md:flex-1 md:min-h-0 md:overflow-hidden transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                border: `1px solid ${borderColor}`,
              }}
            >
              <div
                className="p-4 border-b space-y-4 sticky top-0 z-[1] backdrop-blur md:static md:z-auto transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {getStatusTabs(grandTotals).map((tab) => {
                      const isActive = statusFilter === tab.id;
                      const Icon = tab.icon;

                      return (
                        <button
                          type="button"
                          key={tab.id || "all"}
                          onClick={() => {
                            setStatusFilter(tab.id);
                            setPage(1);
                          }}
                          className={`px-4 py-1.5 text-xs font-bold rounded-full border cursor-pointer transition-colors duration-200 ease-out whitespace-nowrap flex items-center gap-2 ${FOCUS_RING} ${
                            isActive
                              ? ""
                              : "bg-[color:var(--app-surface)] text-[color:var(--app-muted)] hover:bg-[color:var(--wl-hover)] hover:text-[color:var(--app-text)] active:bg-[color:var(--wl-press)]"
                          }`}
                          style={
                            isActive
                              ? tab.activeStyle
                              : { borderColor: borderColor }
                          }
                          aria-pressed={isActive}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                          <span
                            className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ease-out"
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
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full cursor-pointer transition-colors duration-200 ease-out hover:bg-[color:var(--wl-hover)] hover:text-[color:var(--app-text)] ${FOCUS_RING}`}
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
                            borderColor: "var(--accent-soft2)",
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
                            borderColor: "var(--accent-soft2)",
                          }}
                        >
                          {statusFilter}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className={`flex items-center gap-1 text-[10px] font-bold uppercase rounded cursor-pointer hover:underline hover:brightness-90 ${FOCUS_RING}`}
                      style={{ color: "var(--accent)" }}
                    >
                      <RotateCcw size={10} /> Reset
                    </button>
                  </div>
                )}
              </div>

              <div
                className="min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-y-auto transition-colors duration-300 ease-out cto-scrollbar"
                style={{ backgroundColor: "var(--app-bg)" }}
              >
                {!isLoading && credits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
                    <div
                      className="p-6 rounded-full mb-4 ring-1 transition-colors duration-300 ease-out"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor: borderColor,
                      }}
                    >
                      <Inbox
                        className="w-10 h-10"
                        style={{ color: "var(--app-muted)" }}
                      />
                    </div>
                    <h3
                      className="text-lg font-bold"
                      style={{ color: "var(--app-text)" }}
                    >
                      No Credit History Found
                    </h3>
                    {isFiltered && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className={`mt-6 text-sm font-bold underline rounded cursor-pointer hover:brightness-90 ${FOCUS_RING}`}
                        style={{ color: "var(--accent)" }}
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Mobile/Tablet cards */}
                    <div className="block lg:hidden p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(isLoading || isRollbackPending
                          ? [...Array(Math.min(limit, 6))]
                          : credits
                        ).map((credit, idx) => {
                          if (isLoading || isRollbackPending) {
                            return (
                              <div
                                key={`sk-${idx}`}
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
                                <div className="mt-4 flex gap-2">
                                  <Skeleton height={40} width={"100%"} />
                                </div>
                              </div>
                            );
                          }

                          return (
                            <CreditCard
                              key={credit._id}
                              credit={credit}
                              isRollbackPending={isRollbackPending}
                              formatDuration={formatDuration}
                              formatDate={formatDate}
                              leftStripClassName={getStatusStripClass(
                                credit.status,
                              )}
                              borderColor={borderColor}
                              interactionVars={interactionVars}
                              canManageCredits={canManageCredits}
                              onViewMemo={() => openMemo(credit)}
                              onViewDetails={() => openDetails(credit)}
                              onRollback={() => askRollback(credit)}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block w-full align-middle">
                      <table className="w-full text-left table-fixed">
                        <colgroup>
                          <col style={{ width: "36%" }} />
                          <col style={{ width: "20%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "11%" }} />
                        </colgroup>

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
                            <th className="px-6 py-4 font-bold">Employees</th>
                            <th className="px-6 py-4 font-bold">
                              Reference / Memo
                            </th>
                            <th className="px-4 py-4 text-center">Duration</th>
                            <th className="px-4 py-4 text-center">
                              Date Approved
                            </th>
                            <th className="px-4 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>

                        <tbody>
                          {isLoading
                            ? [...Array(limit)].map((_, i) => (
                                <tr key={i}>
                                  {[...Array(6)].map((__, j) => (
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
                                    tabIndex={0}
                                    // Clicking anywhere on the row (except its buttons) opens the details
                                    onClick={(e) => {
                                      if (
                                        !isRollbackPending &&
                                        shouldOpenFromClick(e)
                                      )
                                        openDetails(credit);
                                    }}
                                    onKeyDown={(e) => {
                                      if (
                                        e.target !== e.currentTarget ||
                                        !isActivationKey(e)
                                      )
                                        return;
                                      e.preventDefault();
                                      if (!isRollbackPending)
                                        openDetails(credit);
                                    }}
                                    className={`border-b transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)] ${
                                      isRollbackPending
                                        ? "cursor-progress"
                                        : "cursor-pointer"
                                    }`}
                                    style={{
                                      backgroundColor: bg,
                                      borderColor: borderColor,
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        "var(--accent-soft)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        bg;
                                    }}
                                  >
                                    <td className="px-6 py-4 align-middle">
                                      <EmployeesCell
                                        employees={credit.employees}
                                        borderColor={borderColor}
                                      />
                                    </td>

                                    <td className="px-6 py-4 align-middle">
                                      <div className="flex flex-col min-w-0">
                                        <span
                                          className="font-semibold text-sm truncate"
                                          style={{ color: "var(--app-text)" }}
                                          title={credit.memoNo || "-"}
                                        >
                                          {credit.memoNo || "-"}
                                        </span>
                                        <span
                                          className="text-[10px] font-mono mt-0.5"
                                          style={{ color: "var(--app-muted)" }}
                                        >
                                          ID:{" "}
                                          {credit._id
                                            ? credit._id.slice(-6).toUpperCase()
                                            : "-"}
                                        </span>
                                      </div>
                                    </td>

                                    <td className="px-4 py-4 text-center align-middle whitespace-nowrap">
                                      <span
                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-xs font-bold"
                                        style={{
                                          backgroundColor: "var(--app-surface)",
                                          borderColor: borderColor,
                                          color: "var(--app-text)",
                                        }}
                                      >
                                        <Clock
                                          size={12}
                                          style={{ color: "var(--app-muted)" }}
                                        />
                                        {formatDuration(credit.duration)}
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

                                    {/* Clicks around the Actions button shouldn't open details */}
                                    <td
                                      data-no-row-click
                                      className="px-6 py-4 text-right align-middle whitespace-nowrap cursor-default"
                                    >
                                      <ActionMenu
                                        credit={credit}
                                        borderColor={borderColor}
                                        interactionVars={interactionVars}
                                        isRollbackPending={isRollbackPending}
                                        canManageCredits={canManageCredits}
                                        onViewMemo={() => openMemo(credit)}
                                        onViewDetails={() =>
                                          openDetails(credit)
                                        }
                                        onRollback={() => askRollback(credit)}
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
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                startItem={startItem}
                endItem={endItem}
                onPrev={() => setPage((p) => Math.max(p - 1, 1))}
                onNext={() =>
                  setPage((p) => Math.min(p + 1, pagination.totalPages))
                }
                borderColor={borderColor}
              />
            </div>
          </div>

          {showScrollTop && (
            <button
              type="button"
              onClick={scrollToTop}
              className={`md:hidden fixed bottom-5 right-5 z-[1] h-10 w-10 rounded-full shadow-lg cursor-pointer hover:brightness-90 active:scale-95 transition-colors duration-200 ease-out flex items-center justify-center ${FOCUS_RING}`}
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

          <Modal
            isOpen={isConfirmRollback}
            onClose={() => {
              if (isRollbackPending) return;
              setIsConfirmRollback(false);
            }}
            title="Rollback CTO Credit"
            maxWidth="max-w-lg"
            preventCloseWhenBusy={true}
            isBusy={isRollbackPending}
            action={{
              show: true,
              variant: "delete",
              label: isRollbackPending ? "Rolling back..." : "Yes, Rollback",
              onClick: async () => {
                if (!selectedCreditId) return;

                const credit = credits.find((c) => c._id === selectedCreditId);
                const status = String(credit?.status || "").toUpperCase();
                if (status !== "CREDITED") {
                  toast.error("Only CREDITED entries can be rolled back.");
                  setIsConfirmRollback(false);
                  return;
                }

                await startRollback(selectedCreditId);
              },
              disabled: isRollbackPending || !selectedCreditId,
            }}
          >
            <div className="p-2">
              <div
                className="mb-5 flex items-start gap-3 p-3 rounded-xl border transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  borderColor: borderColor,
                }}
              >
                <div
                  className="mt-0.5 p-1.5 rounded-lg border shadow-sm transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: borderColor,
                    color: "var(--app-muted)",
                  }}
                >
                  <Clipboard size={16} />
                </div>

                <div className="min-w-0">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--app-muted)" }}
                  >
                    You are about to rollback this CTO credit
                  </p>

                  <p
                    className="text-sm font-bold break-words"
                    style={{ color: "var(--app-text)" }}
                  >
                    Ref:{" "}
                    {selectedCreditId
                      ? `#${selectedCreditId.slice(-6).toUpperCase()}`
                      : "-"}
                  </p>

                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Memo:{" "}
                    <span
                      className="font-semibold"
                      style={{ color: "var(--app-text)" }}
                    >
                      {credits.find((c) => c._id === selectedCreditId)
                        ?.memoNo || "-"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="text-center py-2">
                <div
                  className="mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-4 border-4 shadow-inner"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.10)",
                    borderColor: "rgba(239,68,68,0.18)",
                    color: "#ef4444",
                  }}
                >
                  <RotateCcw size={40} strokeWidth={3} />
                </div>

                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--app-text)" }}
                >
                  Are you sure you want to rollback this CTO credit?
                </h2>

                <p
                  className="text-sm mt-2"
                  style={{ color: "var(--app-muted)" }}
                >
                  This will deduct the credited hours from the employees&apos;
                  balances and mark this credit as{" "}
                  <span className="font-semibold">ROLLEDBACK</span>.
                </p>
              </div>

              <div
                className="mt-4 rounded-xl border p-3 transition-colors duration-300 ease-out"
                style={{
                  borderColor: "rgba(245,158,11,0.35)",
                  backgroundColor: "rgba(245,158,11,0.10)",
                  color: "rgba(245,158,11,0.95)",
                }}
              >
                <p className="text-xs leading-relaxed">
                  <span className="font-bold">Note:</span> Rollback will fail if
                  any employee has already used or reserved hours from this
                  credit.
                </p>
              </div>
            </div>
          </Modal>

          <Modal
            isOpen={details.isOpen}
            onClose={details.close}
            title="CTO Credit Details"
            maxWidth="max-w-4xl"
          >
            {details.display ? (
              <CtoCreditDetails credit={details.display} />
            ) : details.isOpen ? (
              <DetailsLoading />
            ) : null}
          </Modal>

          <Modal
            isOpen={memoModal.isOpen}
            onClose={() => setMemoModal({ isOpen: false, memo: null })}
            title="CTO Credit Memo"
            maxWidth="max-w-4xl"
          >
            <div className="w-full h-[70vh] flex flex-col">
              <iframe
                title="CTO Credit Memo PDF"
                src={
                  memoPdfUrl
                    ? `${memoPdfUrl}#toolbar=1&navpanes=1&scrollbar=1`
                    : ""
                }
                className="w-full flex-1 rounded-md border transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: borderColor,
                }}
                allow="fullscreen"
              />
            </div>
          </Modal>
        </SkeletonTheme>
      </div>
    </FullHeightCardContainer>
  );
};

export default CtoCreditHistory;
