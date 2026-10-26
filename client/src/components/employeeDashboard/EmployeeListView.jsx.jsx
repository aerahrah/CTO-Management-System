// src/components/employees/EmployeeDirectory.jsx
import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getEmployees } from "../../api/employee";
import { fetchProjectOptions } from "../../api/project";
import { fetchDesignationOptions } from "../../api/designation";
import { useNavigate } from "react-router-dom";
import { RoleBadge } from "../statusUtils";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Breadcrumbs from "../breadCrumbs";
import EmployeeRoleChanger from "./employeeChangeRole";
import Modal from "../modal";
import { useAuth } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";
import FullHeightCardContainer from "../pageContainer";

import {
  Search,
  User,
  Settings,
  Shield,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  FilterX,
  Mail,
  Building2,
  IdCard,
  Briefcase,
  ArrowUp,
} from "lucide-react";

/* =========================
   CONSTANTS
========================= */
const DIVISION_OPTIONS = ["AFD", "TOD", "ORD"];
const pageSizeOptions = [20, 50, 100];

/* =========================
   THEME
========================= */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* =========================
   INTERACTION TINTS
========================= */
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

/* =========================
   ROW / CARD CLICK HELPERS
========================= */
// A click on a control inside a row or card must not also open the profile.
// This includes the action menu: it is portaled to <body>, but React still
// bubbles its events up to the row/card.
const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, label, [role='menu'], [role='menuitem'], [data-no-row-click]";

const shouldOpenFromClick = (e) => {
  if (e.defaultPrevented) return false;
  const target = e.target;
  if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) {
    return false;
  }
  // Let people highlight/copy text (e.g. a name or email) without navigating
  const selection =
    typeof window !== "undefined" ? window.getSelection?.() : null;
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    return false;
  }
  return true;
};

const isActivationKey = (e) => e.key === "Enter" || e.key === " ";

/* =========================
   HELPERS
========================= */
const initials = (firstName, lastName) =>
  `${(firstName || " ")[0] || ""}${(lastName || " ")[0] || ""}`.toUpperCase();

const formatNamePart = (name) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// ✅ Helper to construct the complete formatted name
const getFullName = (emp) => {
  if (!emp) return "Unknown Employee";

  const first = formatNamePart(emp.firstName);
  const last = formatNamePart(emp.lastName);
  const middleInitial = emp.middleName
    ? `${emp.middleName.trim().charAt(0).toUpperCase()}.`
    : "";

  return [
    emp.prefixTitle,
    first,
    middleInitial,
    last,
    emp.nameExtension,
    emp.postfixTitle,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const getStatusPill = (status, resolvedTheme) => {
  const s = status || "Active";
  const isDark = resolvedTheme === "dark";

  const map = {
    Active: {
      backgroundColor: isDark
        ? "rgba(16,185,129,0.14)"
        : "rgba(16,185,129,0.10)",
      color: isDark ? "#6ee7b7" : "#047857",
      borderColor: isDark ? "rgba(16,185,129,0.28)" : "rgba(16,185,129,0.18)",
      dot: "#10b981",
    },
    Inactive: {
      backgroundColor: isDark
        ? "rgba(148,163,184,0.14)"
        : "rgba(148,163,184,0.10)",
      color: isDark ? "#cbd5e1" : "#475569",
      borderColor: isDark ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.18)",
      dot: "#94a3b8",
    },
    Resigned: {
      backgroundColor: isDark
        ? "rgba(245,158,11,0.14)"
        : "rgba(245,158,11,0.10)",
      color: isDark ? "#fcd34d" : "#b45309",
      borderColor: isDark ? "rgba(245,158,11,0.28)" : "rgba(245,158,11,0.18)",
      dot: "#f59e0b",
    },
    Terminated: {
      backgroundColor: isDark ? "rgba(244,63,94,0.14)" : "rgba(244,63,94,0.10)",
      color: isDark ? "#fda4af" : "#be123c",
      borderColor: isDark ? "rgba(244,63,94,0.28)" : "rgba(244,63,94,0.18)",
      dot: "#f43f5e",
    },
  };

  return {
    ...(map[s] || map.Inactive),
    label: s,
  };
};

const getLeftStripStyle = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
      return { borderLeftColor: "#10b981" };
    case "INACTIVE":
      return { borderLeftColor: "#94a3b8" };
    case "RESIGNED":
      return { borderLeftColor: "#f59e0b" };
    case "TERMINATED":
      return { borderLeftColor: "#f43f5e" };
    default:
      return { borderLeftColor: "#cbd5e1" };
  }
};

const getDivisionBadgeStyle = (division, resolvedTheme) => {
  const isDark = resolvedTheme === "dark";

  const styles = {
    AFD: {
      backgroundColor: isDark
        ? "rgba(59,130,246,0.14)"
        : "rgba(59,130,246,0.10)",
      color: isDark ? "#93c5fd" : "#1d4ed8",
      borderColor: isDark ? "rgba(59,130,246,0.28)" : "rgba(59,130,246,0.18)",
    },
    TOD: {
      backgroundColor: isDark
        ? "rgba(168,85,247,0.14)"
        : "rgba(168,85,247,0.10)",
      color: isDark ? "#d8b4fe" : "#7c3aed",
      borderColor: isDark ? "rgba(168,85,247,0.28)" : "rgba(168,85,247,0.18)",
    },
    ORD: {
      backgroundColor: isDark
        ? "rgba(16,185,129,0.14)"
        : "rgba(16,185,129,0.10)",
      color: isDark ? "#6ee7b7" : "#047857",
      borderColor: isDark ? "rgba(16,185,129,0.28)" : "rgba(16,185,129,0.18)",
    },
  };

  return (
    styles[division] || {
      backgroundColor: isDark
        ? "rgba(148,163,184,0.14)"
        : "rgba(148,163,184,0.10)",
      color: isDark ? "#cbd5e1" : "#475569",
      borderColor: isDark ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.18)",
    }
  );
};

/* =========================
   UI COMPONENTS
========================= */

const EmployeeTypeBadge = ({ type, resolvedTheme }) => {
  if (!type) return null;
  const isDark = resolvedTheme === "dark";
  const isOrganic = type === "Organic";
  const displayType = type === "JO" ? "Job Order" : type;

  const style = isOrganic
    ? {
        backgroundColor: isDark
          ? "rgba(59,130,246,0.14)"
          : "rgba(59,130,246,0.10)",
        color: isDark ? "#93c5fd" : "#1d4ed8",
        borderColor: isDark ? "rgba(59,130,246,0.28)" : "rgba(59,130,246,0.18)",
      }
    : {
        backgroundColor: isDark
          ? "rgba(245,158,11,0.14)"
          : "rgba(245,158,11,0.10)",
        color: isDark ? "#fcd34d" : "#b45309",
        borderColor: isDark ? "rgba(245,158,11,0.28)" : "rgba(245,158,11,0.18)",
      };

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider"
      style={style}
    >
      {displayType}
    </span>
  );
};

/* =========================
   HOOK: DEBOUNCE
========================= */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/* =========================
   ACTION MENU (portal, never clipped)
========================= */
const MENU_WIDTH = 192;

// "Actions" trigger: solid accent like the Add Employee button so it's easy to
// spot in every row; darker on hover, darker still while its menu is open.
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
  "transition-colors duration-150 ease-out focus-visible:outline-none";

const MENU_ITEM_NEUTRAL =
  `${MENU_ITEM_BASE} text-[color:var(--app-text)] ` +
  "hover:bg-[color:var(--wl-hover)] hover:text-[color:var(--accent)] " +
  "active:bg-[color:var(--wl-press)] focus-visible:bg-[color:var(--wl-hover)]";

const MENU_ITEM_WARN = {
  light:
    `${MENU_ITEM_BASE} text-[#b45309] ` +
    "hover:bg-[rgba(245,158,11,0.16)] active:bg-[rgba(245,158,11,0.26)] focus-visible:bg-[rgba(245,158,11,0.16)]",
  dark:
    `${MENU_ITEM_BASE} text-[#fcd34d] ` +
    "hover:bg-[rgba(245,158,11,0.18)] active:bg-[rgba(245,158,11,0.28)] focus-visible:bg-[rgba(245,158,11,0.18)]",
};

const ActionMenu = ({
  onAction,
  disabled = false,
  borderColor,
  resolvedTheme,
  interactionVars,
  canEditEmployee,
  canChangeRole,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, visible: false });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  // Close the menu if it becomes disabled while open (e.g. role modal opens)
  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    // Global theme CSS may put a `transition` on every element. Without this
    // the menu visibly slides in from the top-left corner when top/left are set.
    menuRef.current?.style.setProperty("transition", "none", "important");
    const btn = btnRef.current?.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 140;
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

  const handle = (action) => {
    setIsOpen(false);
    onAction?.(action);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation(); // don't open the profile
          if (disabled) return;
          setPos((p) => ({ ...p, visible: false }));
          setIsOpen((o) => !o);
        }}
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
        !disabled &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Employee actions"
            // Portaled, but React still bubbles clicks to the row: stop them here
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg py-1 overflow-hidden"
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
              onClick={() => handle("view")}
              className={MENU_ITEM_NEUTRAL}
            >
              <User size={14} /> View Profile
            </button>

            {canEditEmployee && (
              <button
                type="button"
                role="menuitem"
                onClick={() => handle("update")}
                className={MENU_ITEM_NEUTRAL}
              >
                <Settings size={14} /> Update Profile
              </button>
            )}

            {canChangeRole && (
              <>
                <div
                  className="h-px my-1"
                  style={{ backgroundColor: borderColor }}
                />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handle("role")}
                  className={
                    MENU_ITEM_WARN[resolvedTheme === "dark" ? "dark" : "light"]
                  }
                >
                  <Shield size={14} /> Change Role
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
};

/* =========================
   Pagination
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
}) => {
  const tp = Math.max(Number(totalPages) || 1, 1);
  const prevDisabled = page === 1 || total === 0;
  const nextDisabled = page >= tp || total === 0;

  const mobileBtn = `inline-flex items-center gap-1 rounded-lg px-3 py-2 border text-sm font-bold cursor-pointer transition-colors duration-150 ease-out bg-[color:var(--app-surface)] text-[color:var(--app-text)] enabled:hover:bg-[color:var(--wl-hover)] enabled:active:bg-[color:var(--wl-press)] disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS_RING}`;

  const iconBtn = `p-1.5 rounded-md cursor-pointer transition-colors duration-150 ease-out enabled:hover:bg-[color:var(--wl-hover)] enabled:active:bg-[color:var(--wl-press)] disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS_RING}`;

  return (
    <div
      className="px-4 md:px-6 py-3 border-t transition-colors duration-300 ease-out"
      style={{
        borderColor,
        backgroundColor: "var(--app-surface)",
      }}
    >
      <div className="flex md:hidden items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={prevDisabled}
          className={mobileBtn}
          style={{ borderColor }}
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
            {page} / {tp}
          </div>
          <div
            className="text-[11px] truncate transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {total === 0 ? `0 ${label}` : `${startItem}-${endItem} of ${total}`}
          </div>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className={mobileBtn}
          style={{ borderColor }}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="hidden md:flex flex-col md:flex-row items-center justify-between gap-4">
        <div
          className="text-xs font-medium transition-colors duration-300 ease-out"
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
            borderColor,
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
            className="text-xs font-mono font-medium px-3 transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {page} / {tp}
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

/* =========================
   Small Select UI
========================= */
const SelectField = ({
  label,
  value,
  onChange,
  options,
  disabled,
  className = "",
  borderColor,
}) => {
  return (
    <div className={className}>
      <label
        className="block text-[10px] font-bold uppercase tracking-[0.14em] mb-1 transition-colors duration-300 ease-out"
        style={{ color: "var(--app-muted)" }}
      >
        {label}
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-10 px-3 text-sm rounded-lg outline-none transition-all cursor-pointer border ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor,
          color: "var(--app-text)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-soft)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = borderColor;
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const DivisionBadge = ({ division, resolvedTheme }) => {
  const style = getDivisionBadgeStyle(division, resolvedTheme);

  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded text-xs font-bold border"
      style={style}
    >
      {division || "N/A"}
    </span>
  );
};

/* =========================
   EMPLOYEE CARD (Mobile/Tablet)
========================= */
const EmployeeCard = ({
  emp,
  onNavigate,
  onAction,
  isRoleModalOpen,
  variant = "mobile",
  borderColor,
  resolvedTheme,
  interactionVars,
  canEditEmployee,
  canChangeRole,
}) => {
  const statusPill = getStatusPill(emp?.status, resolvedTheme);
  const isDark = resolvedTheme === "dark";

  const projectLabel =
    typeof emp?.project === "string"
      ? emp.project
      : emp?.project?.name || emp?.project?._id || "—";

  const designationLabel =
    typeof emp?.designation === "string"
      ? emp.designation
      : emp?.designation?.name || "—";

  const positionOrDesignation = emp?.position || designationLabel;
  const leftStrip = getLeftStripStyle(emp?.status);

  // Shadows live in classes (not inline style) so the hover lift can apply
  const wrapClass = `rounded-xl border overflow-hidden cursor-pointer transition-[box-shadow,background-color] duration-200 ease-out hover:shadow-md ${FOCUS_RING} ${
    variant === "tablet" ? "shadow-sm" : "shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
  }`;

  const footerBtn = `py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors duration-150 ease-out ${FOCUS_RING}`;

  return (
    <div
      className={wrapClass}
      tabIndex={0}
      // Tapping anywhere on the card (except its buttons) opens the profile
      onClick={(e) => {
        if (shouldOpenFromClick(e)) onNavigate(emp);
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || !isActivationKey(e)) return;
        e.preventDefault();
        onNavigate(emp);
      }}
      style={{
        ...leftStrip,
        borderLeftWidth: "4px",
        borderTopColor: borderColor,
        borderRightColor: borderColor,
        borderBottomColor: borderColor,
        backgroundColor: "var(--app-surface)",
      }}
    >
      <div
        className="px-3 py-2 flex justify-between items-center border-b transition-colors duration-300 ease-out"
        style={{ borderColor }}
      >
        <span
          className="text-[11px] font-mono transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          #{emp?._id ? emp._id.slice(-6).toUpperCase() : "—"}
        </span>

        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
          style={{
            backgroundColor: statusPill.backgroundColor,
            color: statusPill.color,
            borderColor: statusPill.borderColor,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: statusPill.dot }}
          />
          {statusPill.label}
        </span>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold border flex-none"
            style={{
              backgroundColor: "var(--accent-soft)",
              color: "var(--accent)",
              borderColor: "var(--accent-soft2)",
            }}
          >
            {initials(emp?.firstName, emp?.lastName)}
          </div>

          <div className="min-w-0 flex-1">
            <h4
              className="text-sm font-bold truncate leading-5 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {getFullName(emp)}
            </h4>

            <div className="mt-1 flex items-center gap-2">
              <EmployeeTypeBadge
                type={emp?.employeeType}
                resolvedTheme={resolvedTheme}
              />
            </div>

            <div
              className="flex items-center gap-1 text-xs mt-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <Mail size={12} style={{ color: "var(--app-muted)" }} />
              <span className="truncate">{emp?.email || "No email"}</span>
            </div>
          </div>

          <div className="flex-none">
            <ActionMenu
              disabled={isRoleModalOpen}
              onAction={(action) => onAction(action, emp)}
              borderColor={borderColor}
              resolvedTheme={resolvedTheme}
              interactionVars={interactionVars}
              canEditEmployee={canEditEmployee}
              canChangeRole={canChangeRole}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <div
            className="rounded-lg p-2 border transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor,
            }}
          >
            <div
              className="text-[10px] uppercase font-bold flex items-center gap-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <IdCard size={12} /> Position
            </div>
            <div
              className="text-xs font-semibold mt-0.5 truncate transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {positionOrDesignation || "—"}
            </div>
          </div>

          <div
            className="rounded-lg p-2 border transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor,
            }}
          >
            <div
              className="text-[10px] uppercase font-bold flex items-center gap-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <Building2 size={12} /> Division
            </div>
            <div className="mt-1">
              <DivisionBadge
                division={emp?.division}
                resolvedTheme={resolvedTheme}
              />
            </div>
          </div>

          <div
            className="rounded-lg p-2 col-span-2 border transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div
                  className="text-[10px] uppercase font-bold flex items-center gap-1 transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  <Briefcase size={12} /> Project
                </div>
                <div
                  className="text-xs font-semibold mt-0.5 truncate transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-text)" }}
                >
                  {projectLabel || "—"}
                </div>
              </div>
              <div className="flex-none text-right">
                <div
                  className="text-[10px] uppercase font-bold flex items-center gap-1 justify-end transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  <Shield size={12} /> Role
                </div>
                <div
                  className="text-xs font-semibold mt-0.5 transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-text)" }}
                >
                  {emp?.role ? <RoleBadge role={emp.role} /> : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Button bar: taps here never fall through to the card */}
      <div
        data-no-row-click
        className={`grid ${canChangeRole ? "grid-cols-2" : "grid-cols-1"} border-t cursor-default transition-colors duration-300 ease-out`}
        style={{ borderColor }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(emp);
          }}
          className={`${footerBtn} hover:bg-[color:var(--wl-hover)] active:bg-[color:var(--wl-press)]`}
          style={{
            color: "var(--accent)",
            borderRight: canChangeRole ? `1px solid ${borderColor}` : "none",
          }}
        >
          <User size={14} /> View
        </button>

        {canChangeRole && (
          <button
            type="button"
            disabled={isRoleModalOpen}
            onClick={(e) => {
              e.stopPropagation();
              onAction("role", emp);
            }}
            className={`${footerBtn} disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? "hover:bg-[rgba(245,158,11,0.18)] active:bg-[rgba(245,158,11,0.28)]"
                : "hover:bg-[rgba(245,158,11,0.16)] active:bg-[rgba(245,158,11,0.26)]"
            }`}
            style={{ color: isDark ? "#fcd34d" : "#b45309" }}
          >
            <Shield size={14} /> Role
          </button>
        )}
      </div>
    </div>
  );
};

/* =========================
   MAIN COMPONENT
========================= */
const EmployeeDirectory = () => {
  const navigate = useNavigate();

  // Permissions integration
  const { can } = usePermissions();
  const canCreateEmployee = can("employees.create");
  const canEditEmployee = can("employees.edit");
  const canChangeRole = can("employees.change_role");

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

  const zebraAltColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.02)"
      : "rgba(15,23,42,0.025)";
  }, [resolvedTheme]);

  const hoverColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "var(--accent-soft)"
      : "rgba(37,99,235,0.06)";
  }, [resolvedTheme]);

  // Role modal
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const openRoleLockRef = useRef(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 400);

  const [filters, setFilters] = useState({
    division: "All",
    designation: "All",
    project: "All",
  });

  const pageScrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback(() => {
    const el = pageScrollRef.current;
    const st = el ? el.scrollTop : 0;
    setShowScrollTop(st > 320);
  }, []);

  const scrollToTop = useCallback(() => {
    const el = pageScrollRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* -------- Projects -------- */
  const projectsQuery = useQuery({
    queryKey: ["projectOptions", "Active"],
    queryFn: () => fetchProjectOptions({ status: "Active" }),
    staleTime: 5 * 60 * 1000,
  });

  const activeProjects = useMemo(() => {
    const items = Array.isArray(projectsQuery.data?.items)
      ? projectsQuery.data.items
      : [];
    return items;
  }, [projectsQuery.data]);

  const projectOptions = useMemo(() => {
    const base = [{ value: "All", label: "All" }];
    const opts = activeProjects
      .filter((p) => p?._id && p?.name)
      .map((p) => ({ value: String(p._id), label: p.name }));

    const seen = new Set();
    return [...base, ...opts].filter((o) => {
      if (!o?.value) return false;
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  }, [activeProjects]);

  const projectIdSet = useMemo(
    () => new Set(projectOptions.map((o) => o.value)),
    [projectOptions],
  );

  /* -------- Designations -------- */
  const designationsQuery = useQuery({
    queryKey: ["designationOptions", "Active"],
    queryFn: () => fetchDesignationOptions({ status: "Active" }),
    staleTime: 5 * 60 * 1000,
  });

  const activeDesignations = useMemo(() => {
    const items = Array.isArray(designationsQuery.data?.items)
      ? designationsQuery.data.items
      : [];
    return items;
  }, [designationsQuery.data]);

  const designationOptions = useMemo(() => {
    const base = [{ value: "All", label: "All" }];
    const opts = activeDesignations
      .filter((d) => d?._id && d?.name)
      .map((d) => ({ value: String(d._id), label: d.name }));

    const seen = new Set();
    return [...base, ...opts].filter((o) => {
      if (!o?.value) return false;
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  }, [activeDesignations]);

  const designationIdSet = useMemo(
    () => new Set(designationOptions.map((o) => o.value)),
    [designationOptions],
  );

  /* -------- Employees -------- */
  const safeFilters = useMemo(() => {
    const safeDivision = ["All", ...DIVISION_OPTIONS].includes(filters.division)
      ? filters.division
      : "All";

    const safeDesignation =
      filters.designation === "All"
        ? "All"
        : designationIdSet.has(filters.designation)
          ? filters.designation
          : "All";

    const safeProject =
      filters.project === "All"
        ? "All"
        : projectIdSet.has(filters.project)
          ? filters.project
          : "All";

    return {
      division: safeDivision,
      designation: safeDesignation,
      project: safeProject,
    };
  }, [filters, designationIdSet, projectIdSet]);

  const employeeQueryParams = useMemo(
    () => ({
      page,
      limit,
      search: debouncedSearch || undefined,
      division:
        safeFilters.division === "All" ? undefined : safeFilters.division,
      designation:
        safeFilters.designation === "All" ? undefined : safeFilters.designation,
      project: safeFilters.project === "All" ? undefined : safeFilters.project,
    }),
    [page, limit, debouncedSearch, safeFilters],
  );

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["employees", employeeQueryParams],
    queryFn: () => getEmployees(employeeQueryParams),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setPage(1);
  }, [safeFilters, debouncedSearch, limit]);

  // ✅ SORT EMPLOYEES ALPHABETICALLY BY LAST NAME
  const employees = useMemo(() => {
    const list = data?.data || [];
    return [...list].sort((a, b) => {
      const nameA = (a?.lastName || "").trim().toLowerCase();
      const nameB = (b?.lastName || "").trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [data?.data]);

  const totalItems = data?.total || 0;

  const totalPages = useMemo(() => {
    const tpFromApi = data?.totalPages;
    if (Number(tpFromApi) && Number(tpFromApi) > 0) return Number(tpFromApi);
    return Math.max(Math.ceil(totalItems / limit) || 1, 1);
  }, [data?.totalPages, totalItems, limit]);

  useEffect(() => {
    setPage((p) => {
      if (p > totalPages) return totalPages;
      if (p < 1) return 1;
      return p;
    });
  }, [totalPages]);

  const startItem = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(page * limit, totalItems);

  const selectedProjectLabel =
    projectOptions.find((o) => o.value === safeFilters.project)?.label || "";
  const selectedDesignationLabel =
    designationOptions.find((o) => o.value === safeFilters.designation)
      ?.label || "";

  const handleAddEmployee = () => navigate("/app/employees/add-employee");

  const closeRoleModal = useCallback(() => {
    setIsRoleModalOpen(false);
    setSelectedEmployee(null);
    setRoleBusy(false);
    openRoleLockRef.current = false;
  }, []);

  const openRoleModal = useCallback((employee) => {
    if (openRoleLockRef.current) return;
    openRoleLockRef.current = true;

    setSelectedEmployee(employee);
    setRoleBusy(false);
    setIsRoleModalOpen(true);

    requestAnimationFrame(() => {
      openRoleLockRef.current = false;
    });
  }, []);

  const handleAction = useCallback(
    (action, employee) => {
      if (!employee?._id) return;

      if (action === "view") navigate(`/app/employees/${employee._id}`);
      if (action === "update")
        navigate(`/app/employees/${employee._id}/update`);
      if (action === "role") openRoleModal(employee);
    },
    [navigate, openRoleModal],
  );

  const openProfile = useCallback(
    (employee) => {
      if (employee?._id) navigate(`/app/employees/${employee._id}`);
    },
    [navigate],
  );

  const clearFilters = useCallback(() => {
    setFilters({ division: "All", designation: "All", project: "All" });
    setSearchInput("");
    setPage(1);
  }, []);

  const hasActiveFilters = Boolean(
    debouncedSearch ||
    safeFilters.division !== "All" ||
    safeFilters.designation !== "All" ||
    safeFilters.project !== "All",
  );

  return (
    <FullHeightCardContainer>
      <div
        className="w-full flex-1 flex h-full flex-col md:p-0 min-h-0 transition-colors duration-300 ease-out"
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
          {/* 1. Outer wrapper (scrolls on mobile, disappears on desktop) */}
          <div
            ref={pageScrollRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain md:contents cto-scrollbar"
          >
            {/* HEADER (Not sticky) */}
            <div className="pt-2 pb-3 sm:pb-6 px-1">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Breadcrumbs rootLabel="home" rootTo="/app" />
                  <h1
                    className="text-2xl md:text-3xl font-bold tracking-tight font-sans transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    Employee Directory
                  </h1>
                  <p
                    className="text-sm mt-1 max-w-2xl transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Manage your organization’s staffing and roles.
                  </p>
                </div>

                {canCreateEmployee && (
                  <button
                    type="button"
                    onClick={handleAddEmployee}
                    className={`group relative inline-flex items-center gap-2 justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md cursor-pointer transition-all hover:brightness-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto ${FOCUS_RING}`}
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                    Add Employee
                  </button>
                )}
              </div>
            </div>

            {/* 2. MAIN SURFACE (Expands on mobile, locks to screen height on desktop) */}
            <div
              className="flex flex-col rounded-xl shadow-sm overflow-visible md:flex-1 md:min-h-0 md:overflow-hidden border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor,
              }}
            >
              {/* 3. TOOLBAR: Sticky on mobile, static on desktop */}
              <div
                className="p-4 border-b space-y-4 sticky top-0 z-[1] backdrop-blur md:static md:z-auto transition-colors duration-300 ease-out"
                style={{
                  borderColor,
                  backgroundColor: "var(--app-surface-2)",
                }}
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="w-full md:w-auto">
                    <div className="grid grid-cols-3 gap-2">
                      <SelectField
                        label="Division"
                        value={safeFilters.division}
                        onChange={(v) =>
                          setFilters((p) => ({ ...p, division: v }))
                        }
                        options={[
                          { value: "All", label: "All" },
                          ...DIVISION_OPTIONS.map((d) => ({
                            value: d,
                            label: d,
                          })),
                        ]}
                        borderColor={borderColor}
                      />

                      <SelectField
                        label="Designation"
                        value={safeFilters.designation}
                        onChange={(v) =>
                          setFilters((p) => ({ ...p, designation: v }))
                        }
                        options={
                          designationsQuery.isLoading
                            ? [
                                {
                                  value: "All",
                                  label: "Loading designations...",
                                },
                              ]
                            : designationOptions
                        }
                        disabled={
                          designationsQuery.isLoading ||
                          designationOptions.length <= 1
                        }
                        borderColor={borderColor}
                      />

                      <SelectField
                        label="Project"
                        value={safeFilters.project}
                        onChange={(v) =>
                          setFilters((p) => ({ ...p, project: v }))
                        }
                        options={
                          projectsQuery.isLoading
                            ? [{ value: "All", label: "Loading projects..." }]
                            : projectOptions
                        }
                        disabled={
                          projectsQuery.isLoading || projectOptions.length <= 1
                        }
                        borderColor={borderColor}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: "var(--app-muted)" }}
                      />
                      <input
                        type="text"
                        placeholder="Search employee..."
                        value={searchInput}
                        maxLength={100}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 rounded-lg text-sm outline-none transition-all border"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                          color: "var(--app-text)",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "var(--accent)";
                          e.currentTarget.style.boxShadow =
                            "0 0 0 3px var(--accent-soft)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = borderColor;
                          e.currentTarget.style.boxShadow = "none";
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
                      className="hidden md:flex items-center gap-2 pl-3 border-l transition-colors duration-300 ease-out"
                      style={{ borderColor }}
                    >
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
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
                        className="text-xs rounded-lg block p-1.5 font-medium outline-none cursor-pointer border transition-colors duration-200 ease-out"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                          color: "var(--app-text)",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "var(--accent)";
                          e.currentTarget.style.boxShadow =
                            "0 0 0 3px var(--accent-soft)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = borderColor;
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        {pageSizeOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {hasActiveFilters && (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-[10px] font-bold uppercase transition-colors duration-300 ease-out"
                        style={{ color: "var(--app-muted)" }}
                      >
                        Active:
                      </span>
                      {debouncedSearch && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium"
                          style={{
                            backgroundColor: "var(--accent-soft)",
                            color: "var(--accent)",
                            borderColor: "var(--accent-soft2)",
                          }}
                        >
                          "{debouncedSearch}"
                        </span>
                      )}
                      {safeFilters.division !== "All" && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium"
                          style={{
                            backgroundColor: "var(--accent-soft)",
                            color: "var(--accent)",
                            borderColor: "var(--accent-soft2)",
                          }}
                        >
                          {safeFilters.division}
                        </span>
                      )}
                      {safeFilters.designation !== "All" && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium"
                          style={{
                            backgroundColor: "var(--accent-soft)",
                            color: "var(--accent)",
                            borderColor: "var(--accent-soft2)",
                          }}
                        >
                          {selectedDesignationLabel || "Designation"}
                        </span>
                      )}
                      {safeFilters.project !== "All" && (
                        <span
                          className="px-2 py-0.5 rounded border text-[10px] font-medium"
                          style={{
                            backgroundColor: "var(--accent-soft)",
                            color: "var(--accent)",
                            borderColor: "var(--accent-soft2)",
                          }}
                        >
                          {selectedProjectLabel || "Project"}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={clearFilters}
                      className={`flex items-center gap-1 text-[10px] font-bold uppercase rounded cursor-pointer transition-colors duration-200 ease-out hover:underline hover:brightness-90 ${FOCUS_RING}`}
                      style={{ color: "var(--accent)" }}
                    >
                      <FilterX size={10} /> Reset
                    </button>
                  </div>
                )}
              </div>

              {/* 4. DATA REGION: Expands on mobile, handles scrolling on desktop */}
              <div
                className="min-h-[calc(100dvh-26rem)] md:flex-1 md:overflow-auto transition-colors duration-300 ease-out cto-scrollbar relative"
                style={{ backgroundColor: "var(--app-bg)" }}
              >
                <table className="w-full text-left hidden lg:table">
                  <thead
                    className="sticky top-0 z-20 transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      boxShadow: `inset 0 -1px 0 0 ${borderColor}`,
                    }}
                  >
                    <tr
                      className="text-[10px] uppercase tracking-[0.12em] font-bold"
                      style={{ color: "var(--app-muted)" }}
                    >
                      <th className="px-6 py-4 font-bold">Employee</th>
                      <th className="px-6 py-4 font-bold">
                        Position / Designation
                      </th>
                      <th className="px-6 py-4 font-bold">Division</th>
                      <th className="px-6 py-4 font-bold">Project</th>
                      <th className="px-6 py-4 font-bold">Role</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 text-right font-bold">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {isLoading ? (
                      [...Array(Math.min(limit, 10))].map((_, i) => (
                        <tr key={i}>
                          {[...Array(7)].map((__, j) => (
                            <td key={j} className="px-6 py-4">
                              <Skeleton />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : employees.length > 0 ? (
                      employees.map((emp, i) => {
                        const statusPill = getStatusPill(
                          emp?.status,
                          resolvedTheme,
                        );

                        const projectLabel =
                          typeof emp?.project === "string"
                            ? emp.project
                            : emp?.project?.name || emp?.project?._id || "—";

                        const designationLabel =
                          typeof emp?.designation === "string"
                            ? emp.designation
                            : emp?.designation?.name || "—";

                        const positionOrDesignation =
                          emp?.position || designationLabel;

                        const bg =
                          i % 2 === 0 ? "var(--app-surface)" : zebraAltColor;

                        return (
                          <tr
                            key={emp._id}
                            tabIndex={0}
                            // Clicking anywhere on the row (except its buttons) opens the profile
                            onClick={(e) => {
                              if (shouldOpenFromClick(e)) openProfile(emp);
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.target !== e.currentTarget ||
                                !isActivationKey(e)
                              )
                                return;
                              e.preventDefault();
                              openProfile(emp);
                            }}
                            className="cursor-pointer transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                            style={{ backgroundColor: bg }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                hoverColor;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = bg;
                            }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold border"
                                  style={{
                                    backgroundColor: "var(--accent-soft)",
                                    color: "var(--accent)",
                                    borderColor: "var(--accent-soft2)",
                                  }}
                                >
                                  {initials(emp.firstName, emp.lastName)}
                                </div>
                                <div className="min-w-0">
                                  <p
                                    className="text-sm font-semibold truncate transition-colors duration-300 ease-out"
                                    style={{ color: "var(--app-text)" }}
                                  >
                                    {getFullName(emp)}
                                  </p>

                                  <div className="flex items-center gap-2 mt-1">
                                    <EmployeeTypeBadge
                                      type={emp.employeeType}
                                      resolvedTheme={resolvedTheme}
                                    />
                                    <p
                                      className="text-xs truncate transition-colors duration-300 ease-out"
                                      style={{ color: "var(--app-muted)" }}
                                    >
                                      {emp.email || "No email"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td
                              className="px-6 py-4 text-sm transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-muted)" }}
                            >
                              {positionOrDesignation || "—"}
                            </td>

                            <td className="px-6 py-4">
                              <DivisionBadge
                                division={emp.division}
                                resolvedTheme={resolvedTheme}
                              />
                            </td>

                            <td
                              className="px-6 py-4 text-sm transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-muted)" }}
                            >
                              {projectLabel && projectLabel !== "—" ? (
                                <span
                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border"
                                  style={{
                                    backgroundColor: "var(--app-surface-2)",
                                    color: "var(--app-text)",
                                    borderColor,
                                  }}
                                >
                                  {projectLabel}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td
                              className="px-6 py-4 text-sm transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-muted)" }}
                            >
                              {emp.role ? <RoleBadge role={emp.role} /> : "—"}
                            </td>

                            <td className="px-6 py-4">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                                style={{
                                  backgroundColor: statusPill.backgroundColor,
                                  color: statusPill.color,
                                  borderColor: statusPill.borderColor,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: statusPill.dot }}
                                />
                                {statusPill.label}
                              </span>
                            </td>

                            {/* Clicks around the Actions button shouldn't open the profile */}
                            <td
                              data-no-row-click
                              className="px-6 py-4 text-right cursor-default"
                            >
                              <div className="flex justify-end">
                                <ActionMenu
                                  disabled={isRoleModalOpen}
                                  onAction={(action) =>
                                    handleAction(action, emp)
                                  }
                                  borderColor={borderColor}
                                  resolvedTheme={resolvedTheme}
                                  interactionVars={interactionVars}
                                  canEditEmployee={canEditEmployee}
                                  canChangeRole={canChangeRole}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-16">
                          <div className="flex flex-col items-center justify-center text-center">
                            <div
                              className="p-6 rounded-full mb-4 ring-1 transition-colors duration-300 ease-out"
                              style={{
                                backgroundColor: "var(--app-surface-2)",
                                borderColor,
                              }}
                            >
                              <Search
                                className="w-10 h-10"
                                style={{ color: "var(--app-muted)" }}
                              />
                            </div>
                            <h3
                              className="text-lg font-bold transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-text)" }}
                            >
                              No employees found
                            </h3>
                            <p
                              className="text-sm mt-1 max-w-md transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-muted)" }}
                            >
                              Try adjusting your search or filters.
                            </p>
                            {hasActiveFilters && (
                              <button
                                type="button"
                                onClick={clearFilters}
                                className={`mt-6 text-sm font-bold underline rounded cursor-pointer transition-colors duration-200 ease-out hover:brightness-90 ${FOCUS_RING}`}
                                style={{ color: "var(--accent)" }}
                              >
                                Clear all filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="lg:hidden">
                  <div
                    className="md:hidden flex flex-col p-3 gap-2 transition-colors duration-300 ease-out"
                    style={{ backgroundColor: "var(--app-bg)" }}
                  >
                    {isLoading ? (
                      [...Array(6)].map((_, i) => (
                        <div
                          key={i}
                          className="rounded-xl p-3 shadow-sm border space-y-2"
                          style={{
                            backgroundColor: "var(--app-surface)",
                            borderColor,
                          }}
                        >
                          <Skeleton height={14} count={2} />
                          <div className="mt-2">
                            <Skeleton height={10} count={2} />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Skeleton height={52} />
                            <Skeleton height={52} />
                            <Skeleton height={52} className="col-span-2" />
                          </div>
                          <div className="mt-3">
                            <Skeleton height={38} />
                          </div>
                        </div>
                      ))
                    ) : employees.length > 0 ? (
                      employees.map((emp) => (
                        <EmployeeCard
                          key={emp._id}
                          emp={emp}
                          isRoleModalOpen={isRoleModalOpen}
                          onNavigate={openProfile}
                          onAction={handleAction}
                          variant="mobile"
                          borderColor={borderColor}
                          resolvedTheme={resolvedTheme}
                          interactionVars={interactionVars}
                          canEditEmployee={canEditEmployee}
                          canChangeRole={canChangeRole}
                        />
                      ))
                    ) : (
                      <div
                        className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-xl border transition-colors duration-300 ease-out"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                        }}
                      >
                        <div
                          className="p-5 rounded-full mb-3 ring-1 transition-colors duration-300 ease-out"
                          style={{
                            backgroundColor: "var(--app-surface-2)",
                            borderColor,
                          }}
                        >
                          <Search
                            className="w-8 h-8"
                            style={{ color: "var(--app-muted)" }}
                          />
                        </div>
                        <h3
                          className="text-base font-bold transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-text)" }}
                        >
                          No employees found
                        </h3>
                        <p
                          className="text-sm mt-1 max-w-xs transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Try adjusting your search or filters.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className={`mt-4 text-sm font-bold underline rounded cursor-pointer transition-colors duration-200 ease-out hover:brightness-90 ${FOCUS_RING}`}
                            style={{ color: "var(--accent)" }}
                          >
                            Clear all filters
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    className="hidden md:block lg:hidden p-4 transition-colors duration-300 ease-out"
                    style={{ backgroundColor: "var(--app-bg)" }}
                  >
                    {isLoading ? (
                      <div className="grid grid-cols-2 gap-3">
                        {[...Array(Math.min(limit, 6))].map((_, i) => (
                          <div
                            key={i}
                            className="border rounded-xl shadow-sm p-4"
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
                            <div className="mt-3">
                              <Skeleton height={52} />
                            </div>
                            <div className="mt-4">
                              <Skeleton height={40} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : employees.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {employees.map((emp) => (
                          <EmployeeCard
                            key={emp._id}
                            emp={emp}
                            isRoleModalOpen={isRoleModalOpen}
                            onNavigate={openProfile}
                            onAction={handleAction}
                            variant="tablet"
                            borderColor={borderColor}
                            resolvedTheme={resolvedTheme}
                            interactionVars={interactionVars}
                            canEditEmployee={canEditEmployee}
                            canChangeRole={canChangeRole}
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border transition-colors duration-300 ease-out"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          borderColor,
                        }}
                      >
                        <div
                          className="p-6 rounded-full mb-4 ring-1 transition-colors duration-300 ease-out"
                          style={{
                            backgroundColor: "var(--app-surface-2)",
                            borderColor,
                          }}
                        >
                          <Search
                            className="w-10 h-10"
                            style={{ color: "var(--app-muted)" }}
                          />
                        </div>
                        <h3
                          className="text-lg font-bold transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-text)" }}
                        >
                          No employees found
                        </h3>
                        <p
                          className="text-sm mt-1 max-w-md transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Try adjusting your search or filters.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className={`mt-6 text-sm font-bold underline rounded cursor-pointer transition-colors duration-200 ease-out hover:brightness-90 ${FOCUS_RING}`}
                            style={{ color: "var(--accent)" }}
                          >
                            Clear all filters
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <CompactPagination
                page={page}
                totalPages={totalPages}
                total={totalItems}
                startItem={startItem}
                endItem={endItem}
                label="employees"
                onPrev={() => setPage((p) => Math.max(p - 1, 1))}
                onNext={() => {
                  if (!isPlaceholderData && page < totalPages) {
                    setPage((p) => p + 1);
                  }
                }}
                borderColor={borderColor}
              />
            </div>
          </div>

          {showScrollTop && (
            <button
              type="button"
              onClick={scrollToTop}
              className={`fixed bottom-6 right-6 z-50 inline-flex items-center justify-center rounded-full text-white shadow-lg cursor-pointer hover:brightness-90 active:scale-[0.98] transition-all w-11 h-11 ${FOCUS_RING}`}
              style={{ backgroundColor: "var(--accent)" }}
              aria-label="Back to top"
              title="Back to top"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          )}
        </SkeletonTheme>

        {isRoleModalOpen && selectedEmployee && (
          <Modal
            isOpen={isRoleModalOpen}
            title={`Change Role - ${getFullName(selectedEmployee)}`} // ✅ Updated Modal Title
            showFooter={false}
            maxWidth="max-w-lg"
            canClose={!roleBusy}
            onClose={() => {
              if (roleBusy) return;
              closeRoleModal();
            }}
          >
            <EmployeeRoleChanger
              key={selectedEmployee._id}
              employeeId={selectedEmployee._id}
              currentRole={selectedEmployee.role}
              onPendingChange={(v) => setRoleBusy(!!v)}
              onCancel={closeRoleModal}
              onRoleUpdated={closeRoleModal}
            />
          </Modal>
        )}
      </div>
    </FullHeightCardContainer>
  );
};

export default EmployeeDirectory;
