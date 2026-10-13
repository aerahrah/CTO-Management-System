// approvalRoutesList.jsx
import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../store/authStore";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  fetchAllApprovalRoutes,
  upsertMyApprovalRoute,
  fetchApprovalRoles,
} from "../../../api/approvalRoute";
import { fetchApprovers } from "../../../api/cto";
import {
  Plus,
  Route as RouteIcon,
  CheckCircle2,
  Zap,
  Search,
  X,
  Trash2,
  Edit2,
  FileSignature,
  ArrowUp,
  Info,
  MoreVertical,
  Bell,
  AlertTriangle,
} from "lucide-react";

import Breadcrumbs from "../../breadCrumbs";
import Modal from "../../modal";
import NotifiedEmployeesModal from "./NotifiedEmployeeModal";

/* =========================
   Helpers & Theme
========================= */
const getErrMsg = (err, fallback = "Failed") =>
  err?.response?.data?.message || err?.message || fallback;

const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;

function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

/* Reactive resolved theme (follows OS changes in "system" mode) */
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

const getNoticeToneStyles = (theme, tone = "neutral") => {
  const isDark = theme === "dark";
  const tones = {
    amber: isDark
      ? {
          wrapBg: "rgba(245,158,11,0.12)",
          wrapBorder: "rgba(245,158,11,0.20)",
          title: "#fde68a",
          text: "#fcd34d",
          icon: "#fbbf24",
        }
      : {
          wrapBg: "rgba(245,158,11,0.08)",
          wrapBorder: "rgba(245,158,11,0.16)",
          title: "#92400e",
          text: "#b45309",
          icon: "#d97706",
        },
    neutral: isDark
      ? {
          wrapBg: "rgba(255,255,255,0.04)",
          wrapBorder: "rgba(255,255,255,0.08)",
          title: "var(--app-text)",
          text: "var(--app-muted)",
          icon: "var(--app-muted)",
        }
      : {
          wrapBg: "rgba(15,23,42,0.03)",
          wrapBorder: "rgba(15,23,42,0.08)",
          title: "#111827",
          text: "#4b5563",
          icon: "#6b7280",
        },
  };
  return tones[tone] || tones.neutral;
};

const CHIP_TONES = {
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
  blue: {
    bg: "rgba(59,130,246,0.12)",
    fg: "#3b82f6",
    br: "rgba(59,130,246,0.22)",
  },
  violet: {
    bg: "rgba(139,92,246,0.12)",
    fg: "#8b5cf6",
    br: "rgba(139,92,246,0.22)",
  },
  amber: {
    bg: "rgba(245,158,11,0.14)",
    fg: "#d97706",
    br: "rgba(245,158,11,0.26)",
  },
};

// Format full name based on the employee schema
const formatFullName = (emp) => {
  if (!emp) return "Unknown Approver";

  const prefix = emp.prefixTitle ? `${emp.prefixTitle.trim()} ` : "";
  const first = emp.firstName ? `${emp.firstName.trim()} ` : "";
  const middleInitial = emp.middleName
    ? `${emp.middleName.trim().charAt(0).toUpperCase()}. `
    : "";
  const last = emp.lastName ? `${emp.lastName.trim()}` : "";
  const extension = emp.nameExtension ? ` ${emp.nameExtension.trim()}` : "";
  const postfix = emp.postfixTitle ? `, ${emp.postfixTitle.trim()}` : "";

  const fullName = `${prefix}${first}${middleInitial}${last}${extension}${postfix}`;
  return fullName.trim() || "Unknown Approver";
};

const initialsOf = (emp) =>
  `${emp?.firstName?.trim()?.[0] || ""}${emp?.lastName?.trim()?.[0] || ""}`.toUpperCase() ||
  "?";

const buildStepsFromRoute = (route) =>
  (route?.steps || []).map((s) => ({
    id: Math.random().toString(36).slice(2, 11),
    level: s.level,
    approver: String(s.approver?._id || s.approver),
    role: s.role || "",
    isEnabled: s.isEnabled !== false,
  }));

const reindexSteps = (rawSteps) =>
  rawSteps.map((s, i) => ({ ...s, level: i + 1 }));

/* =========================
   UI Primitives
========================= */
const Card = ({ children, className = "", borderColor, style }) => (
  <div
    className={[
      "rounded-xl shadow-sm overflow-hidden transition-colors duration-300 ease-out",
      className,
    ].join(" ")}
    style={{
      backgroundColor: "var(--app-surface)",
      border: `1px solid ${borderColor}`,
      ...style,
    }}
  >
    {children}
  </div>
);

const SectionHeader = ({
  icon: Icon,
  tone = "accent",
  title,
  subtitle,
  right,
}) => {
  const t = CHIP_TONES[tone] || CHIP_TONES.accent;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="h-10 w-10 rounded-xl flex items-center justify-center flex-none border"
          style={{ backgroundColor: t.bg, color: t.fg, borderColor: t.br }}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h3
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "var(--app-muted)" }}
          >
            {title}
          </h3>
          {subtitle ? (
            <p
              className="text-xs font-medium mt-0.5 truncate"
              style={{ color: "var(--app-muted)" }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {right}
    </div>
  );
};

const SoftNotice = ({
  icon: Icon,
  tone = "neutral",
  title,
  children,
  theme,
}) => {
  const t = getNoticeToneStyles(theme, tone);
  return (
    <div
      className="rounded-xl px-4 py-8 flex flex-col items-center justify-center text-center gap-3 transition-colors duration-300 ease-out"
      style={{ backgroundColor: t.wrapBg, border: `1px solid ${t.wrapBorder}` }}
    >
      <Icon className="w-8 h-8" style={{ color: t.icon }} />
      <div className="min-w-0">
        {title && (
          <div
            className="text-sm font-semibold mb-1"
            style={{ color: t.title }}
          >
            {title}
          </div>
        )}
        <div
          className="text-xs leading-relaxed max-w-sm"
          style={{ color: t.text }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

const PrimaryButton = ({
  children,
  disabled,
  onClick,
  className = "",
  borderColor,
  theme,
}) => {
  const disabledBg =
    theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition hover:brightness-95",
        className,
      ].join(" ")}
      style={{
        backgroundColor: disabled ? disabledBg : "var(--accent)",
        color: disabled ? "var(--app-muted)" : "#ffffff",
        border: `1px solid ${disabled ? borderColor : "var(--accent)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  );
};

const OutlineButton = ({
  children,
  disabled,
  onClick,
  className = "",
  borderColor,
  theme,
}) => {
  const disabledBg =
    theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors duration-200 ease-out",
        disabled ? "" : "hover:bg-[color:var(--accent-soft)]",
        className,
      ].join(" ")}
      style={{
        backgroundColor: disabled ? disabledBg : undefined,
        color: disabled ? "var(--app-muted)" : "var(--accent)",
        border: `1px solid ${disabled ? borderColor : "var(--accent)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  );
};

const Toggle = ({ checked, disabled, onChange, borderColor, theme, label }) => {
  const offBg =
    theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className="relative inline-flex h-6 w-10 items-center rounded-full transition flex-none shrink-0"
      style={{
        backgroundColor: checked ? "var(--accent)" : offBg,
        border: `1px solid ${checked ? "var(--accent)" : borderColor}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span
        className={[
          "inline-block h-4 w-4 transform rounded-full shadow transition",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
        style={{ backgroundColor: "#ffffff" }}
      />
    </button>
  );
};

const StatusPill = ({ enabled, borderColor }) => (
  <span
    className="inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider"
    style={
      enabled
        ? {
            backgroundColor: CHIP_TONES.green.bg,
            color: CHIP_TONES.green.fg,
            borderColor: CHIP_TONES.green.br,
          }
        : {
            backgroundColor: "var(--app-surface-2)",
            color: "var(--app-muted)",
            borderColor,
          }
    }
  >
    {enabled ? "Active" : "Disabled"}
  </span>
);

const RoleBadge = ({ label }) => (
  <span
    className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border max-w-full truncate"
    style={
      label
        ? {
            backgroundColor: CHIP_TONES.violet.bg,
            color: CHIP_TONES.violet.fg,
            borderColor: CHIP_TONES.violet.br,
          }
        : {
            backgroundColor: "var(--app-surface-2)",
            color: "var(--app-muted)",
            borderColor: "var(--app-border)",
          }
    }
  >
    {label || "Unmapped"}
  </span>
);

const Avatar = ({ initials, enabled }) => (
  <div
    className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-none"
    style={{
      backgroundColor: enabled ? "var(--accent-soft)" : "var(--app-surface-2)",
      color: enabled ? "var(--accent)" : "var(--app-muted)",
    }}
  >
    {initials}
  </div>
);

const SkeletonLine = ({
  width = "100%",
  height = 16,
  theme,
  rounded = "rounded",
}) => (
  <div
    className={`${rounded} animate-pulse`}
    style={{
      width,
      height,
      backgroundColor:
        theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
    }}
  />
);

const SkeletonRow = ({ theme }) => (
  <tr>
    {[...Array(5)].map((_, j) => (
      <td key={j} className="px-5 py-4">
        <SkeletonLine height={20} theme={theme} />
      </td>
    ))}
  </tr>
);

/* =========================
   Action Menu (rendered in a portal so no container can clip it)
========================= */
const MENU_WIDTH = 168;

const ActionMenu = ({ onEdit, onDelete, isBusy, borderColor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, visible: false });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  // Position after the menu renders, so we can measure its real height
  useLayoutEffect(() => {
    if (!isOpen) return;
    const btn = btnRef.current?.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 96;
    if (!btn) return;

    const gap = 6;
    const spaceBelow = window.innerHeight - btn.bottom;
    const openUp = spaceBelow < menuH + gap + 8 && btn.top > menuH + gap;

    const top = openUp ? btn.top - menuH - gap : btn.bottom + gap;
    const left = Math.min(
      Math.max(8, btn.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );

    setPos({ top, left, visible: true });
  }, [isOpen]);

  // Close on outside click, Escape, scroll or resize
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

  const toggle = (e) => {
    e.stopPropagation();
    if (isBusy) return;
    setPos((p) => ({ ...p, visible: false }));
    setIsOpen((o) => !o);
  };

  const run = (cb) => {
    setIsOpen(false);
    cb?.();
  };

  const itemClass =
    "w-full px-3 py-2 text-sm flex items-center gap-2 transition-colors duration-150 disabled:opacity-40";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={isBusy}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)]"
        style={{ color: "var(--app-text)", borderColor }}
      >
        Actions
        <MoreVertical size={14} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="rounded-lg shadow-lg py-1 border"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              zIndex: 1000,
              visibility: pos.visible ? "visible" : "hidden",
              backgroundColor: "var(--app-surface)",
              borderColor,
            }}
          >
            <button
              type="button"
              role="menuitem"
              disabled={isBusy}
              onClick={() => run(onEdit)}
              className={`${itemClass} hover:bg-[color:var(--app-surface-2)]`}
              style={{ color: "var(--app-text)" }}
            >
              <Edit2 size={14} /> Edit Step
            </button>

            <div
              className="h-px my-1"
              style={{ backgroundColor: "var(--app-border)" }}
            />

            <button
              type="button"
              role="menuitem"
              disabled={isBusy}
              onClick={() => run(onDelete)}
              className={`${itemClass} hover:bg-[rgba(239,68,68,0.10)]`}
              style={{ color: "#ef4444" }}
            >
              <Trash2 size={14} /> Delete Step
            </button>
          </div>,
          document.body,
        )}
    </>
  );
};

/* =========================
   Mobile / Tablet Card
========================= */
const StepCard = ({
  step,
  approver,
  roleObj,
  isBusy,
  onToggle,
  onEdit,
  onDelete,
  borderColor,
  theme,
}) => {
  const enabled = step.isEnabled !== false;

  return (
    <Card
      borderColor={borderColor}
      style={{
        borderLeft: `4px solid ${enabled ? "var(--accent)" : borderColor}`,
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Avatar initials={approver?.initials || "?"} enabled={enabled} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--app-muted)" }}
                >
                  Level {step.level}
                </span>
                <StatusPill enabled={enabled} borderColor={borderColor} />
              </div>
              <div
                className="text-sm font-bold mt-1 break-words"
                style={{
                  color: "var(--app-text)",
                  opacity: enabled ? 1 : 0.7,
                }}
              >
                {approver?.label || "Unknown Approver"}
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ color: "var(--app-muted)" }}
              >
                {approver?.position || "N/A"}
              </div>
            </div>
          </div>
          <div className="flex-none pt-1">
            <Toggle
              checked={enabled}
              disabled={isBusy}
              onChange={onToggle}
              borderColor={borderColor}
              theme={theme}
              label={`Turn Level ${step.level} ${enabled ? "off" : "on"}`}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-bold uppercase tracking-wider flex-none"
            style={{ color: "var(--app-muted)" }}
          >
            Role
          </span>
          <RoleBadge label={roleObj?.label} />
        </div>
      </div>

      <div
        className="border-t px-3 py-2.5 flex items-center gap-2"
        style={{ borderColor }}
      >
        <button
          type="button"
          onClick={onEdit}
          disabled={isBusy}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)] disabled:opacity-50"
          style={{ borderColor, color: "var(--app-text)" }}
        >
          <Edit2 className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isBusy}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition bg-[color:var(--app-surface)] hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50"
          style={{ borderColor, color: "#ef4444" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </Card>
  );
};

/* =========================
   Main Page Component
========================= */
export default function ApprovalRoutesList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { admin, preferences } = useAuth();

  const currentUserId = admin?.id || admin?._id;
  const prefTheme = preferences?.theme || "system";
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.07)"
        : "rgba(15,23,42,0.10)",
    [resolvedTheme],
  );
  const inputBg = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(15,23,42,0.03)",
    [resolvedTheme],
  );

  const [steps, setSteps] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [isNotifiedOpen, setIsNotifiedOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
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

  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ["approvalRoutes"],
    queryFn: fetchAllApprovalRoutes,
  });

  const myRoute = useMemo(() => {
    return routes.find(
      (r) => String(r.createdBy?._id || r.createdBy) === String(currentUserId),
    );
  }, [routes, currentUserId]);

  useEffect(() => {
    setSteps(buildStepsFromRoute(myRoute));
  }, [myRoute]);

  const notifiedCount = myRoute?.notifiedEmployees?.length || 0;

  const { data: approversRaw = [], isLoading: approversLoading } = useQuery({
    queryKey: ["approvers"],
    queryFn: fetchApprovers,
  });

  const approverOptions = useMemo(() => {
    const list = Array.isArray(approversRaw?.data?.data)
      ? approversRaw.data.data
      : Array.isArray(approversRaw?.data)
        ? approversRaw.data
        : Array.isArray(approversRaw)
          ? approversRaw
          : [];

    return list
      .filter((emp) => emp?._id && (emp?.firstName || emp?.lastName))
      .map((emp) => ({
        value: String(emp._id),
        label: formatFullName(emp),
        initials: initialsOf(emp),
        position: emp.position || emp.designation?.name || "Staff",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [approversRaw]);

  const { data: rolesRaw, isLoading: rolesLoading } = useQuery({
    queryKey: ["approvalRoles"],
    queryFn: fetchApprovalRoles,
  });

  const normalizedRoles = useMemo(() => {
    const list = Array.isArray(rolesRaw?.data)
      ? rolesRaw.data
      : Array.isArray(rolesRaw)
        ? rolesRaw
        : [];

    return list.map((r) => ({
      id: r.id || r.value || r.name || r,
      label: r.label || r.name || r.value || r.id || String(r),
      desc: r.description || r.desc || "Assigned approval role.",
    }));
  }, [rolesRaw]);

  const mutation = useMutation({
    mutationFn: (payload) => upsertMyApprovalRoute(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvalRoutes"] });
      toast.success("Workflow updated successfully!");
    },
    onError: (err) => {
      // Put the list back to what the server has
      setSteps(buildStepsFromRoute(myRoute));
      toast.error(getErrMsg(err, "Failed to update workflow"));
    },
  });

  // NOTE: notifiedEmployees is intentionally NOT sent here, so the backend
  // keeps whatever recipients were saved from the Notified Employees modal.
  const saveRoute = useCallback(
    (newSteps) => {
      const sanitizedSteps = reindexSteps(newSteps);
      mutation.mutate({
        name: `${admin?.firstName || "Personal"}'s Workflow`,
        isPublic: false,
        steps: sanitizedSteps.map((s) => ({
          level: s.level,
          approver: s.approver,
          role: s.role || "",
          isEnabled: s.isEnabled !== false,
        })),
      });
    },
    [admin, mutation],
  );

  const requestDelete = (step) => {
    if (steps.length <= 1) {
      toast.error(
        "A workflow needs at least one approver step. Add another step before deleting this one.",
      );
      return;
    }
    setDeleteTarget(step);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const finalSteps = reindexSteps(
      steps.filter((s) => s.id !== deleteTarget.id),
    );
    setSteps(finalSteps);
    saveRoute(finalSteps);
    setDeleteTarget(null);
  };

  const toggleStepEnabled = (id) => {
    const newSteps = steps.map((s) =>
      s.id === id ? { ...s, isEnabled: !s.isEnabled } : s,
    );
    setSteps(newSteps);
    saveRoute(newSteps);
  };

  const filteredSteps = useMemo(() => {
    const q = searchInput.toLowerCase().trim();
    if (!q) return steps;
    return steps.filter((step) => {
      const approver = approverOptions.find(
        (o) => o.value === String(step.approver),
      );
      const role = normalizedRoles.find((r) => r.id === step.role);
      const hay =
        `${approver?.label || ""} ${approver?.position || ""} ${role?.label || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [steps, searchInput, approverOptions, normalizedRoles]);

  const activeApproversCount = useMemo(
    () => steps.filter((s) => s.isEnabled !== false).length,
    [steps],
  );

  const isBusy = mutation.isPending;
  const isLoading = routesLoading || approversLoading || rolesLoading;

  const deleteApprover = deleteTarget
    ? approverOptions.find((o) => o.value === String(deleteTarget.approver))
    : null;
  const stepsAfterDelete = deleteTarget
    ? steps.filter((s) => s.level > deleteTarget.level).length
    : 0;

  const stats = [
    {
      label: "Approvers",
      value: activeApproversCount,
      sub: `${steps.length - activeApproversCount} turned off`,
      icon: CheckCircle2,
      tone: "blue",
    },
    {
      label: "Role Maps",
      value: steps.filter((s) => s.role).length,
      sub: "Mapped to specific roles",
      icon: FileSignature,
      tone: "violet",
    },
    {
      label: "Notified",
      value: notifiedCount,
      sub: "Employees kept informed",
      icon: Bell,
      tone: "amber",
    },
    {
      label: "Active Routes",
      value: myRoute ? 1 : 0,
      sub: myRoute ? "Your workflow is live" : "No workflow yet",
      icon: Zap,
      tone: "green",
    },
  ];

  return (
    <div
      className="flex-1 w-full h-full flex flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto w-full cto-scrollbar pb-24 touch-pan-y"
      >
        <div className="px-3 py-4 md:px-6 max-w-[1600px] mx-auto w-full">
          {/* Header */}
          <Breadcrumbs
            rootLabel="HOME"
            rootTo="/app"
            items={[
              { label: "APPROVAL WORKFLOWS", to: "/app/settings/approvals" },
            ]}
          />

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2 mb-5">
            <div className="min-w-0">
              <h1
                className="text-2xl md:text-3xl font-bold tracking-tight"
                style={{ color: "var(--app-text)" }}
              >
                Approval Workflows
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--app-muted)" }}>
                Configure your personal routing layers for Travel and CTO
                requests.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <OutlineButton
                onClick={() => setIsNotifiedOpen(true)}
                disabled={isBusy || isLoading}
                borderColor={borderColor}
                theme={resolvedTheme}
                className="w-full md:w-auto"
              >
                <Bell className="w-4 h-4" /> Notified Employees
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--accent-soft)" }}
                >
                  {notifiedCount}
                </span>
              </OutlineButton>

              <PrimaryButton
                onClick={() => navigate("step/new")}
                disabled={isBusy}
                borderColor={borderColor}
                theme={resolvedTheme}
                className="w-full md:w-auto"
              >
                <Plus className="w-4 h-4" /> Create Step
              </PrimaryButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
            {stats.map((stat) => {
              const t = CHIP_TONES[stat.tone];
              const Icon = stat.icon;
              return (
                <Card
                  key={stat.label}
                  borderColor={borderColor}
                  className="p-3 md:p-4 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest truncate"
                        style={{ color: "var(--app-muted)" }}
                      >
                        {stat.label}
                      </p>
                      <h2
                        className="text-xl md:text-2xl font-black mt-1 truncate"
                        style={{ color: "var(--app-text)" }}
                      >
                        {isLoading ? (
                          <SkeletonLine
                            width={36}
                            height={26}
                            theme={resolvedTheme}
                          />
                        ) : (
                          stat.value
                        )}
                      </h2>
                    </div>
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center border shrink-0"
                      style={{
                        backgroundColor: t.bg,
                        color: t.fg,
                        borderColor: t.br,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                  </div>
                  <p
                    className="text-[10px] md:text-[11px] font-medium leading-tight mt-2 md:mt-3 truncate"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {stat.sub}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* Routing hierarchy */}
          <Card borderColor={borderColor} className="flex flex-col">
            <div className="px-4 sm:px-5 py-4 border-b" style={{ borderColor }}>
              <SectionHeader
                icon={RouteIcon}
                title="Routing Hierarchy"
                subtitle={
                  steps.length
                    ? `${plural(steps.length, "step")} · requests go through them in level order`
                    : "No steps yet"
                }
                right={
                  <div className="relative w-full sm:w-64">
                    <Search
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: "var(--app-muted)" }}
                    />
                    <input
                      type="text"
                      placeholder="Search approver or role..."
                      value={searchInput}
                      maxLength={100}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="w-full pl-8 pr-8 h-9 rounded-lg text-xs outline-none transition-colors duration-200 ease-out"
                      style={{
                        backgroundColor: inputBg,
                        border: `1px solid ${borderColor}`,
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
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                }
              />
            </div>

            <div className="w-full">
              {!isLoading && steps.length === 0 ? (
                <div className="p-4 sm:p-6">
                  <SoftNotice
                    icon={Info}
                    tone="neutral"
                    title="No steps configured"
                    theme={resolvedTheme}
                  >
                    You haven't added any routing steps to your workflow yet.
                    Click "Create Step" to get started and assign an approver.
                  </SoftNotice>
                </div>
              ) : !isLoading && filteredSteps.length === 0 ? (
                <div
                  className="p-8 text-center text-sm"
                  style={{ color: "var(--app-muted)" }}
                >
                  No steps match "{searchInput}".
                </div>
              ) : (
                <>
                  {/* Mobile / Tablet */}
                  <div className="lg:hidden p-3 sm:p-4 flex flex-col gap-3">
                    {isLoading
                      ? [...Array(3)].map((_, i) => (
                          <SkeletonLine
                            key={i}
                            height={120}
                            theme={resolvedTheme}
                            rounded="rounded-xl"
                          />
                        ))
                      : filteredSteps.map((step) => (
                          <StepCard
                            key={step.id}
                            step={step}
                            approver={approverOptions.find(
                              (o) => o.value === String(step.approver),
                            )}
                            roleObj={normalizedRoles.find(
                              (r) => r.id === step.role,
                            )}
                            isBusy={isBusy}
                            onToggle={() => toggleStepEnabled(step.id)}
                            onEdit={() => navigate(`step/${step.approver}`)}
                            onDelete={() => requestDelete(step)}
                            borderColor={borderColor}
                            theme={resolvedTheme}
                          />
                        ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden lg:block w-full overflow-x-auto">
                    <table className="w-full text-left">
                      <thead
                        className="border-b"
                        style={{
                          backgroundColor: "var(--app-surface-2)",
                          borderColor,
                        }}
                      >
                        <tr
                          className="text-[10px] uppercase tracking-[0.12em] font-bold"
                          style={{ color: "var(--app-muted)" }}
                        >
                          <th className="px-5 py-3 text-center w-20">Level</th>
                          <th className="px-5 py-3">Approver</th>
                          <th className="px-5 py-3">Role Mapping</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {isLoading
                          ? [...Array(3)].map((_, i) => (
                              <SkeletonRow key={i} theme={resolvedTheme} />
                            ))
                          : filteredSteps.map((step, i) => {
                              const enabled = step.isEnabled !== false;
                              const approver = approverOptions.find(
                                (o) => o.value === String(step.approver),
                              );
                              const roleObj = normalizedRoles.find(
                                (r) => r.id === step.role,
                              );
                              const isLastRow = i === filteredSteps.length - 1;

                              return (
                                <tr
                                  key={step.id}
                                  className="transition-colors duration-150 hover:bg-[color:var(--app-surface-2)]"
                                  style={{
                                    borderBottom: isLastRow
                                      ? "none"
                                      : `1px solid ${borderColor}`,
                                  }}
                                >
                                  <td className="px-5 py-3.5 text-center">
                                    <div
                                      className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center font-bold text-xs border"
                                      style={{
                                        backgroundColor: enabled
                                          ? "var(--accent-soft)"
                                          : "var(--app-surface-2)",
                                        color: enabled
                                          ? "var(--accent)"
                                          : "var(--app-muted)",
                                        borderColor: enabled
                                          ? "var(--accent-soft2, rgba(37,99,235,0.18))"
                                          : borderColor,
                                      }}
                                    >
                                      {step.level}
                                    </div>
                                  </td>

                                  <td className="px-5 py-3.5">
                                    <div
                                      className="flex items-center gap-3 min-w-0"
                                      style={{ opacity: enabled ? 1 : 0.65 }}
                                    >
                                      <Avatar
                                        initials={approver?.initials || "?"}
                                        enabled={enabled}
                                      />
                                      <div className="flex flex-col min-w-0">
                                        <span
                                          className="text-sm font-semibold truncate"
                                          style={{ color: "var(--app-text)" }}
                                        >
                                          {approver?.label ||
                                            "Unknown Approver"}
                                        </span>
                                        <span
                                          className="text-[11px] truncate mt-0.5"
                                          style={{ color: "var(--app-muted)" }}
                                        >
                                          {approver?.position || "N/A"}
                                        </span>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-5 py-3.5">
                                    <RoleBadge label={roleObj?.label} />
                                  </td>

                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                      <Toggle
                                        checked={enabled}
                                        disabled={isBusy}
                                        onChange={() =>
                                          toggleStepEnabled(step.id)
                                        }
                                        borderColor={borderColor}
                                        theme={resolvedTheme}
                                        label={`Turn Level ${step.level} ${enabled ? "off" : "on"}`}
                                      />
                                      <StatusPill
                                        enabled={enabled}
                                        borderColor={borderColor}
                                      />
                                    </div>
                                  </td>

                                  <td className="px-5 py-3.5 text-right">
                                    <ActionMenu
                                      onEdit={() =>
                                        navigate(`step/${step.approver}`)
                                      }
                                      onDelete={() => requestDelete(step)}
                                      isBusy={isBusy}
                                      borderColor={borderColor}
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
          </Card>
        </div>
      </div>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Step"
        maxWidth="max-w-md"
        action={{
          show: true,
          label: isBusy ? "Deleting..." : "Delete Step",
          variant: "delete",
          onClick: confirmDelete,
          disabled: isBusy,
        }}
      >
        <div className="p-2 space-y-4">
          <div
            className="flex items-start gap-3 p-3 rounded-xl border"
            style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
          >
            <Avatar initials={deleteApprover?.initials || "?"} enabled />
            <div className="min-w-0">
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--app-muted)" }}
              >
                Level {deleteTarget?.level}
              </p>
              <p
                className="text-sm font-bold break-words"
                style={{ color: "var(--app-text)" }}
              >
                {deleteApprover?.label || "Unknown Approver"}
              </p>
              <p className="text-xs" style={{ color: "var(--app-muted)" }}>
                {deleteApprover?.position || "N/A"}
              </p>
            </div>
          </div>

          <div
            className="flex items-start gap-2 text-sm"
            style={{ color: "var(--app-text)" }}
          >
            <AlertTriangle
              size={16}
              className="flex-none mt-0.5"
              style={{ color: "#ef4444" }}
            />
            <p>
              This approver will be removed from your workflow.
              {stepsAfterDelete > 0
                ? ` The ${plural(stepsAfterDelete, "step")} after it will move up one level.`
                : ""}
            </p>
          </div>
        </div>
      </Modal>

      {/* Notified Employees Modal */}
      <NotifiedEmployeesModal
        isOpen={isNotifiedOpen}
        onClose={() => setIsNotifiedOpen(false)}
        myRoute={myRoute}
        steps={steps}
        employeeOptions={approverOptions}
        admin={admin}
        borderColor={borderColor}
      />

      {/* Back to top */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="md:hidden fixed bottom-5 right-5 z-[1] h-10 w-10 rounded-full shadow-lg active:scale-95 transition flex items-center justify-center"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
          aria-label="Back to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
