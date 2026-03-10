// src/components/employees/EmployeeDirectory.jsx
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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

import {
  Search,
  MoreVertical,
  User,
  Settings,
  Shield,
  Plus,
  ChevronLeft,
  ChevronRight,
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
   HELPERS
========================= */
const initials = (firstName, lastName) =>
  `${(firstName || " ")[0] || ""}${(lastName || " ")[0] || ""}`.toUpperCase();

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
   ACTION MENU
========================= */
const ActionMenu = ({
  onAction,
  disabled = false,
  borderColor,
  resolvedTheme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
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

  return (
    <div className="relative inline-flex justify-center" ref={menuRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setIsOpen((o) => !o);
        }}
        className={`p-2 rounded-full transition-colors duration-200 ease-out ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
        style={{ color: "var(--app-muted)" }}
        onMouseEnter={(e) => {
          if (disabled) return;
          e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
          e.currentTarget.style.color = "var(--app-text)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--app-muted)";
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Actions"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && !disabled && (
        <div
          className="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-lg z-30 py-1 border transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            borderColor,
          }}
        >
          <button
            type="button"
            onClick={() => handle(() => onAction("view"))}
            className="w-full px-4 py-2 text-sm flex items-center gap-2 text-left transition-colors duration-200 ease-out"
            style={{ color: "var(--app-text)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <User size={14} /> View Profile
          </button>

          <button
            type="button"
            onClick={() => handle(() => onAction("update"))}
            className="w-full px-4 py-2 text-sm flex items-center gap-2 text-left transition-colors duration-200 ease-out"
            style={{ color: "var(--app-text)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Settings size={14} /> Update Profile
          </button>

          <div className="h-px my-1" style={{ backgroundColor: borderColor }} />

          <button
            type="button"
            onClick={() => handle(() => onAction("role"))}
            className="w-full px-4 py-2 text-sm flex items-center gap-2 text-left transition-colors duration-200 ease-out"
            style={{
              color: resolvedTheme === "dark" ? "#fcd34d" : "#b45309",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                resolvedTheme === "dark"
                  ? "rgba(245,158,11,0.14)"
                  : "rgba(245,158,11,0.10)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Shield size={14} /> Change Role
          </button>
        </div>
      )}
    </div>
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
          disabled={page === 1 || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            border: `1px solid ${borderColor}`,
            backgroundColor: "var(--app-surface)",
            color: "var(--app-text)",
          }}
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
          disabled={page >= tp || total === 0}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-30 transition-colors duration-200 ease-out"
          style={{
            border: `1px solid ${borderColor}`,
            backgroundColor: "var(--app-surface)",
            color: "var(--app-text)",
          }}
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
            disabled={page === 1 || total === 0}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              if (page === 1 || total === 0) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
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
            disabled={page >= tp || total === 0}
            className="p-1.5 rounded-md disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-muted)" }}
            onMouseEnter={(e) => {
              if (page >= tp || total === 0) return;
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
   EMPLOYEE CARD
========================= */
const EmployeeCard = ({
  emp,
  onNavigate,
  onAction,
  isRoleModalOpen,
  variant = "mobile",
  borderColor,
  resolvedTheme,
}) => {
  const statusPill = getStatusPill(emp?.status, resolvedTheme);

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

  const wrapClass =
    variant === "tablet"
      ? "rounded-xl shadow-sm border overflow-hidden transition-colors duration-300 ease-out"
      : "rounded-xl border overflow-hidden transition-colors duration-300 ease-out";

  return (
    <div
      className={wrapClass}
      onClick={() => onNavigate(emp)}
      role="button"
      tabIndex={0}
      style={{
        ...leftStrip,
        borderLeftWidth: "4px",
        borderTopColor: borderColor,
        borderRightColor: borderColor,
        borderBottomColor: borderColor,
        backgroundColor: "var(--app-surface)",
        boxShadow:
          variant === "tablet"
            ? "0 1px 3px rgba(0,0,0,0.08)"
            : "0 2px 8px rgba(0,0,0,0.04)",
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
              {emp?.firstName} {emp?.lastName}
            </h4>

            <div
              className="flex items-center gap-1 text-xs mt-0.5 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              <Mail size={12} style={{ color: "var(--app-muted)" }} />
              <span className="truncate">{emp?.email || "No email"}</span>
            </div>

            {emp?.username && (
              <div
                className="mt-1 text-[11px] font-mono truncate transition-colors duration-300 ease-out"
                style={{ color: "var(--app-muted)" }}
              >
                @{emp.username}
              </div>
            )}
          </div>

          <div className="flex-none -mt-1">
            <ActionMenu
              disabled={isRoleModalOpen}
              onAction={(action) => onAction(action, emp)}
              borderColor={borderColor}
              resolvedTheme={resolvedTheme}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
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

      <div
        className="grid grid-cols-2 border-t transition-colors duration-300 ease-out"
        style={{ borderColor }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(emp);
          }}
          className="py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-colors duration-200 ease-out"
          style={{
            color: "var(--accent)",
            borderRight: `1px solid ${borderColor}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent-soft)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <User size={14} /> View
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction("role", emp);
          }}
          className="py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-colors duration-200 ease-out"
          style={{
            color: resolvedTheme === "dark" ? "#fcd34d" : "#b45309",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              resolvedTheme === "dark"
                ? "rgba(245,158,11,0.14)"
                : "rgba(245,158,11,0.10)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <Shield size={14} /> Role
        </button>
      </div>
    </div>
  );
};

/* =========================
   MAIN COMPONENT
========================= */
const EmployeeDirectory = () => {
  const navigate = useNavigate();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const stickyBg = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(2,6,23,0.88)"
      : "rgba(248,250,252,0.88)";
  }, [resolvedTheme]);

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

  const employees = data?.data || [];
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
    <div
      className="w-full flex-1 flex h-full flex-col md:p-0 min-h-0 transition-colors duration-300 ease-out"
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
          ref={pageScrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto cto-scrollbar"
        >
          <div
            className="sticky top-0 z-[1] backdrop-blur transition-colors duration-300 ease-out"
            style={{ backgroundColor: stickyBg }}
          >
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

                <button
                  type="button"
                  onClick={handleAddEmployee}
                  className="group relative inline-flex items-center gap-2 justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto"
                  style={{ backgroundColor: "var(--accent)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = "brightness(0.95)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = "none";
                  }}
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                  Add Employee
                </button>
              </div>
            </div>
          </div>

          <div className="mb-1">
            <div
              className="flex flex-col flex-1 min-h-0 rounded-xl shadow-sm overflow-hidden border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor,
              }}
            >
              <div
                className="p-4 border-b space-y-4 transition-colors duration-300 ease-out"
                style={{
                  borderColor,
                  backgroundColor: "var(--app-surface)",
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
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 rounded-lg text-sm outline-none transition-all border"
                        style={{
                          backgroundColor: "var(--app-surface-2)",
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
                          backgroundColor: "var(--app-surface-2)",
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
                      className="flex items-center gap-1 text-[10px] font-bold uppercase transition-colors duration-200 ease-out"
                      style={{ color: "var(--accent)" }}
                    >
                      <FilterX size={10} /> Reset
                    </button>
                  </div>
                )}
              </div>

              <div
                className="min-h-[300px] transition-colors duration-300 ease-out"
                style={{ backgroundColor: "var(--app-surface)" }}
              >
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead
                      className="sticky top-0 z-[1] border-b transition-colors duration-300 ease-out"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        borderColor,
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
                              className="transition-colors duration-200 ease-out"
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
                                      {emp.firstName} {emp.lastName}
                                    </p>
                                    <p
                                      className="text-xs truncate transition-colors duration-300 ease-out"
                                      style={{ color: "var(--app-muted)" }}
                                    >
                                      {emp.email || "No email"}
                                      {emp.username ? (
                                        <span
                                          className="ml-2 font-mono text-[11px] transition-colors duration-300 ease-out"
                                          style={{ color: "var(--app-muted)" }}
                                        >
                                          @{emp.username}
                                        </span>
                                      ) : null}
                                    </p>
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

                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end">
                                  <ActionMenu
                                    disabled={isRoleModalOpen}
                                    onAction={(action) =>
                                      handleAction(action, emp)
                                    }
                                    borderColor={borderColor}
                                    resolvedTheme={resolvedTheme}
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
                                  className="mt-6 text-sm font-bold underline transition-colors duration-200 ease-out"
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
                </div>

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
                          onNavigate={() =>
                            navigate(`/app/employees/${emp._id}`)
                          }
                          onAction={handleAction}
                          variant="mobile"
                          borderColor={borderColor}
                          resolvedTheme={resolvedTheme}
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
                            className="mt-4 text-sm font-bold underline transition-colors duration-200 ease-out"
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
                            onNavigate={() =>
                              navigate(`/app/employees/${emp._id}`)
                            }
                            onAction={handleAction}
                            variant="tablet"
                            borderColor={borderColor}
                            resolvedTheme={resolvedTheme}
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
                            className="mt-6 text-sm font-bold underline transition-colors duration-200 ease-out"
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
        </div>

        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 inline-flex items-center justify-center rounded-full text-white shadow-lg active:scale-[0.98] transition-all w-11 h-11"
            style={{ backgroundColor: "var(--accent)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(0.95)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
            }}
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
          title={`Change Role - ${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
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
  );
};

export default EmployeeDirectory;
