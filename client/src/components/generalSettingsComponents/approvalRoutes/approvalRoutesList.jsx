import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
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
  RotateCcw,
  Trash2,
  Edit2,
  FileSignature,
  Settings,
  ArrowUp,
  Info,
  MoreVertical,
  Bell,
} from "lucide-react";

import Breadcrumbs from "../../breadCrumbs";
import NotifiedEmployeesModal from "./NotifiedEmployeeModal";

/* =========================
   Helpers & Theme
========================= */
const getErrMsg = (err, fallback = "Failed") =>
  err?.response?.data?.message || err?.message || fallback;

function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
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
    blue: isDark
      ? {
          wrapBg: "rgba(59,130,246,0.12)",
          wrapBorder: "rgba(59,130,246,0.20)",
          title: "#bfdbfe",
          text: "#93c5fd",
          icon: "#60a5fa",
        }
      : {
          wrapBg: "rgba(59,130,246,0.08)",
          wrapBorder: "rgba(59,130,246,0.16)",
          title: "#1e3a8a",
          text: "#1d4ed8",
          icon: "#2563eb",
        },
    green: isDark
      ? {
          wrapBg: "rgba(34,197,94,0.12)",
          wrapBorder: "rgba(34,197,94,0.20)",
          title: "#bbf7d0",
          text: "#86efac",
          icon: "#4ade80",
        }
      : {
          wrapBg: "rgba(34,197,94,0.08)",
          wrapBorder: "rgba(34,197,94,0.16)",
          title: "#166534",
          text: "#15803d",
          icon: "#16a34a",
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

// Format Full Name based on employee schema
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

/* =========================
   UI Primitives
========================= */
const Card = ({
  children,
  className = "",
  borderColor,
  overflowVisible = false,
}) => (
  <div
    className={[
      "rounded-xl shadow-sm transition-colors duration-300 ease-out",
      overflowVisible ? "overflow-visible" : "overflow-hidden",
      className,
    ].join(" ")}
    style={{
      backgroundColor: "var(--app-surface)",
      border: `1px solid ${borderColor}`,
    }}
  >
    {children}
  </div>
);

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
      className="rounded-xl px-4 py-6 flex flex-col items-center justify-center text-center gap-3 transition-colors duration-300 ease-out"
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
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors duration-200 ease-out",
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
        className,
      ].join(" ")}
      style={{
        backgroundColor: disabled ? disabledBg : "transparent",
        color: disabled ? "var(--app-muted)" : "var(--accent)",
        border: `1px solid ${disabled ? borderColor : "var(--accent)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = "var(--accent-soft)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
};

const GhostButton = ({
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
        "inline-flex items-center justify-center gap-2 rounded-lg p-2 text-sm font-bold transition-colors duration-200 ease-out hover:opacity-80",
        className,
      ].join(" ")}
      style={{
        backgroundColor: disabled ? disabledBg : "transparent",
        color: disabled ? "var(--app-muted)" : "var(--app-text)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  );
};

const Toggle = ({ checked, disabled, onChange, borderColor, theme }) => {
  const offBg =
    theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className="relative inline-flex h-6 w-10 items-center rounded-full transition flex-none shrink-0"
      style={{
        backgroundColor: checked ? "var(--accent)" : offBg,
        border: `1px solid ${checked ? "var(--accent)" : borderColor}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
      aria-pressed={checked}
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

const SkeletonLine = ({ width = "100%", height = 16, theme }) => (
  <div
    className="rounded animate-pulse"
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
      <td key={j} className="px-6 py-4">
        <SkeletonLine height={20} theme={theme} />
      </td>
    ))}
  </tr>
);

/* =========================
   Action Menu
========================= */
const ActionMenu = ({ onEdit, onDelete, isBusy, borderColor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState("bottom");
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

  const toggleOpen = (e) => {
    e.stopPropagation();
    if (isBusy) return;

    if (!isOpen) {
      // Calculate remaining space below the button
      const rect = e.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;

      // If there's less than 130px space below, pop the menu upwards
      if (spaceBelow < 130) {
        setMenuPos("top");
      } else {
        setMenuPos("bottom");
      }
    }
    setIsOpen((o) => !o);
  };

  const handle = (cb) => {
    cb?.();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-flex justify-center" ref={menuRef}>
      <button
        type="button"
        disabled={isBusy}
        onClick={toggleOpen}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
        style={{
          color: "var(--app-text)",
          borderColor,
          backgroundColor: "var(--app-surface)",
        }}
      >
        Actions
        <MoreVertical size={14} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 w-36 rounded-lg shadow-lg z-50 py-1 border transition-colors duration-300 ease-out ${
            menuPos === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          style={{ backgroundColor: "var(--app-surface)", borderColor }}
        >
          <button
            type="button"
            disabled={isBusy}
            onClick={() => handle(onEdit)}
            className="w-full px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40 transition-colors duration-200 ease-out"
            style={{ color: "var(--app-text)" }}
            onMouseEnter={(e) => {
              if (isBusy) return;
              e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Edit2 size={14} /> Edit Step
          </button>

          <div
            className="h-px my-1"
            style={{ backgroundColor: "var(--app-border)" }}
          />

          <button
            type="button"
            disabled={isBusy}
            onClick={() => handle(onDelete)}
            className="w-full px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-30 transition-colors duration-200 ease-out"
            style={{ color: "#ef4444" }}
            onMouseEnter={(e) => {
              if (isBusy) return;
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.10)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

/* =========================
   Mobile/Tablet Card
========================= */
const StepCard = ({
  step,
  selectedApprover,
  roleObj,
  isBusy,
  toggleStepEnabled,
  removeStep,
  navigate,
  borderColor,
  theme,
}) => {
  return (
    <Card
      borderColor={borderColor}
      className="border-l-4 border-l-[color:var(--accent)] mb-3 last:mb-0"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-sm font-bold truncate"
                style={{ color: "var(--app-text)" }}
              >
                {selectedApprover?.label || "Unknown Approver"}
              </span>
              <span
                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border whitespace-nowrap"
                style={{
                  backgroundColor: "var(--app-surface-2)",
                  color: "var(--app-text)",
                  borderColor,
                }}
              >
                Level {step.level}
              </span>
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--app-muted)" }}>
              {selectedApprover?.position || "N/A"}
            </div>
          </div>
          <div className="flex-none pt-1">
            <Toggle
              checked={step.isEnabled !== false}
              disabled={isBusy}
              onChange={() => toggleStepEnabled(step.id)}
              borderColor={borderColor}
              theme={theme}
            />
          </div>
        </div>

        <div className="mt-4">
          <div
            className="rounded-lg border p-2 w-full"
            style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--app-muted)" }}
            >
              Role Mapping
            </div>
            <div
              className="mt-1 text-xs font-semibold"
              style={{ color: "var(--app-text)" }}
            >
              {roleObj?.label || "Unmapped"}
            </div>
          </div>
        </div>
      </div>

      <div
        className="border-t p-3"
        style={{ borderColor, backgroundColor: "var(--app-surface)" }}
      >
        <div className="flex items-center gap-2">
          <GhostButton
            onClick={() => navigate(`step/${step.approver}`)}
            disabled={isBusy}
            className="flex-1 border text-xs"
            borderColor={borderColor}
            theme={theme}
          >
            <Edit2 className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />{" "}
            <span style={{ color: "var(--app-text)" }}>Edit</span>
          </GhostButton>
          <GhostButton
            onClick={() => removeStep(step.id)}
            disabled={isBusy}
            className="flex-1 border text-xs !text-red-500"
            borderColor={borderColor}
            theme={theme}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </GhostButton>
        </div>
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
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

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
    if (myRoute) {
      setSteps(
        myRoute.steps.map((s) => ({
          id: Math.random().toString(36).substr(2, 9),
          level: s.level,
          approver: String(s.approver?._id || s.approver),
          role: s.role || "",
          isEnabled: s.isEnabled !== false,
        })),
      );
    } else {
      setSteps([]);
    }
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
        // ✅ Applied dynamic schema-based name formatting
        label: formatFullName(emp),
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
      toast.error(getErrMsg(err, "Failed to update workflow"));
    },
  });

  const reindexSteps = (rawSteps) =>
    rawSteps.map((s, i) => ({ ...s, level: i + 1 }));

  // NOTE: notifiedEmployees is intentionally NOT sent here, so the backend
  // keeps whatever recipients were saved from the Notified Employees modal.
  const saveRoute = useCallback(
    (newSteps) => {
      const sanitizedSteps = reindexSteps(newSteps);
      const payload = {
        name: `${admin?.firstName || "Personal"}'s Workflow`,
        isPublic: false,
        steps: sanitizedSteps.map((s) => ({
          level: s.level,
          approver: s.approver,
          role: s.role || "",
          isEnabled: s.isEnabled !== false,
        })),
      };
      mutation.mutate(payload);
    },
    [admin, mutation],
  );

  const removeStep = (id) => {
    const newSteps = steps.filter((s) => s.id !== id);
    if (newSteps.length === 0) {
      toast.error(
        "A workflow needs at least one approver step. Add another step before deleting this one.",
      );
      return;
    }
    const finalSteps = reindexSteps(newSteps);
    setSteps(finalSteps);
    saveRoute(finalSteps);
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
      const hay = `${approver?.label} ${role?.label}`.toLowerCase();
      return hay.includes(q);
    });
  }, [steps, searchInput, approverOptions, normalizedRoles]);

  const activeApproversCount = useMemo(() => {
    return steps.filter((s) => s.isEnabled !== false).length;
  }, [steps]);

  const isBusy = mutation.isPending;
  const isLoading = routesLoading || approversLoading || rolesLoading;

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

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mt-2 mb-6">
            <div className="min-w-0">
              <h1
                className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
                style={{ color: "var(--app-text)" }}
              >
                Approval <span className="font-bold">Workflows</span>
              </h1>
              <p
                className="text-sm mt-1 transition-colors duration-300 ease-out"
                style={{ color: "var(--app-muted)" }}
              >
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

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
            {[
              {
                label: "Approvers",
                value: activeApproversCount,
                sub: "Active assigned approvers",
                icon: CheckCircle2,
                tone: "blue",
              },
              {
                label: "Role Maps",
                value: steps.filter((s) => s.role).length,
                sub: "Mapped to specific roles",
                icon: FileSignature,
                tone: "indigo",
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
                sub: "Operating workflows",
                icon: Zap,
                tone: "green",
              },
            ].map((stat, i) => {
              const toneMeta = {
                blue: { wrapBg: "rgba(59,130,246,0.12)", iconColor: "#3b82f6" },
                indigo: {
                  wrapBg: "rgba(139, 92, 246, 0.12)",
                  iconColor: "#8b5cf6",
                },
                green: { wrapBg: "rgba(34,197,94,0.12)", iconColor: "#22c55e" },
                amber: {
                  wrapBg: "rgba(245,158,11,0.12)",
                  iconColor: "#f59e0b",
                },
              };
              const t = toneMeta[stat.tone];
              const Icon = stat.icon;

              return (
                <Card
                  key={i}
                  borderColor={borderColor}
                  className="p-3 md:p-4 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest truncate transition-colors duration-300 ease-out"
                        style={{ color: "var(--app-muted)" }}
                      >
                        {stat.label}
                      </p>
                      <h2
                        className="text-xl md:text-2xl font-black mt-1 truncate transition-colors duration-300 ease-out"
                        style={{ color: "var(--app-text)" }}
                      >
                        {stat.value}
                      </h2>
                    </div>
                    <div
                      className="p-1.5 md:p-2 rounded-lg transition-colors duration-300 ease-out shrink-0"
                      style={{ backgroundColor: t.wrapBg, color: t.iconColor }}
                    >
                      <Icon size={18} />
                    </div>
                  </div>
                  <p
                    className="text-[10px] md:text-[11px] font-medium leading-tight mt-2 md:mt-3 truncate transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {stat.sub}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* Main List Area */}
          <Card
            borderColor={borderColor}
            className="flex flex-col md:min-h-0"
            overflowVisible={true}
          >
            {/* Table Header / Toolbar */}
            <div
              className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-300 ease-out"
              style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
            >
              <div className="flex items-center gap-2">
                <RouteIcon
                  className="w-4 h-4"
                  style={{ color: "var(--app-muted)" }}
                />
                <div
                  className="text-sm font-semibold transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-text)" }}
                >
                  Routing Hierarchy
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: "var(--app-muted)" }}
                  />
                  <input
                    type="text"
                    placeholder="Search steps..."
                    value={searchInput}
                    maxLength={100}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full pl-8 pr-8 h-9 rounded-md text-xs outline-none transition-colors duration-200 ease-out"
                    style={{
                      backgroundColor: inputBg,
                      border: `1px solid ${borderColor}`,
                      color: "var(--app-text)",
                    }}
                  />
                  {searchInput && (
                    <button
                      onClick={() => setSearchInput("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Data Content */}
            <div className="w-full">
              {!isLoading && steps.length === 0 ? (
                <div className="p-8">
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
                  No matching steps found for "{searchInput}".
                </div>
              ) : (
                <>
                  {/* Mobile/Tablet View */}
                  <div className="block lg:hidden p-4">
                    {isLoading
                      ? [...Array(3)].map((_, i) => (
                          <div key={i} className="mb-4">
                            <SkeletonLine height={80} theme={resolvedTheme} />
                          </div>
                        ))
                      : filteredSteps.map((step) => {
                          const selectedApprover = approverOptions.find(
                            (o) => String(o.value) === String(step.approver),
                          );
                          const roleObj = normalizedRoles.find(
                            (r) => r.id === step.role,
                          );
                          return (
                            <StepCard
                              key={step.id}
                              step={step}
                              selectedApprover={selectedApprover}
                              roleObj={roleObj}
                              isBusy={isBusy}
                              toggleStepEnabled={toggleStepEnabled}
                              removeStep={removeStep}
                              navigate={navigate}
                              borderColor={borderColor}
                              theme={resolvedTheme}
                            />
                          );
                        })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block w-full align-middle overflow-x-auto pb-4">
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
                          <th className="px-6 py-4 text-center w-24">Level</th>
                          <th className="px-6 py-4">Approver</th>
                          <th className="px-6 py-4">Role Mapping</th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {isLoading
                          ? [...Array(3)].map((_, i) => (
                              <SkeletonRow key={i} theme={resolvedTheme} />
                            ))
                          : filteredSteps.map((step, i) => {
                              const selectedApprover = approverOptions.find(
                                (o) =>
                                  String(o.value) === String(step.approver),
                              );
                              const roleObj = normalizedRoles.find(
                                (r) => r.id === step.role,
                              );

                              // ✅ Alternate row background color logic
                              const rowBg =
                                i % 2 === 0
                                  ? "var(--app-surface)"
                                  : "var(--app-surface-2)";

                              return (
                                <tr
                                  key={step.id}
                                  className="transition-colors duration-200 ease-out"
                                  style={{ backgroundColor: rowBg }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "var(--accent-soft)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      rowBg;
                                  }}
                                >
                                  <td className="px-6 py-4 text-center">
                                    <div
                                      className="w-7 h-7 mx-auto rounded-md flex items-center justify-center font-bold text-xs border transition-colors duration-300"
                                      style={{
                                        backgroundColor: "var(--app-surface)",
                                        color: "var(--app-text)",
                                        borderColor,
                                      }}
                                    >
                                      {step.level}
                                    </div>
                                  </td>

                                  <td className="px-6 py-4">
                                    <div className="flex flex-col min-w-0 pr-2">
                                      <span
                                        className="text-sm font-semibold truncate transition-colors duration-300"
                                        style={{ color: "var(--app-text)" }}
                                      >
                                        {selectedApprover?.label ||
                                          "Unknown Approver"}
                                      </span>
                                      <span
                                        className="text-[11px] truncate mt-0.5 transition-colors duration-300"
                                        style={{ color: "var(--app-muted)" }}
                                      >
                                        {selectedApprover?.position || "N/A"}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="px-6 py-4">
                                    <span
                                      className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold border transition-colors duration-300"
                                      style={{
                                        backgroundColor:
                                          resolvedTheme === "dark"
                                            ? "rgba(34,197,94,0.12)"
                                            : "rgba(34,197,94,0.08)",
                                        color:
                                          resolvedTheme === "dark"
                                            ? "#86efac"
                                            : "#15803d",
                                        border: `1px solid ${
                                          resolvedTheme === "dark"
                                            ? "rgba(34,197,94,0.20)"
                                            : "rgba(34,197,94,0.16)"
                                        }`,
                                      }}
                                    >
                                      {roleObj?.label || "Unmapped"}
                                    </span>
                                  </td>

                                  <td className="px-6 py-4 text-center align-middle">
                                    <div className="flex justify-center items-center">
                                      <Toggle
                                        checked={step.isEnabled !== false}
                                        disabled={isBusy}
                                        onChange={() =>
                                          toggleStepEnabled(step.id)
                                        }
                                        borderColor={borderColor}
                                        theme={resolvedTheme}
                                      />
                                    </div>
                                  </td>

                                  <td className="px-6 py-4 text-right">
                                    <ActionMenu
                                      onEdit={() =>
                                        navigate(`step/${step.approver}`)
                                      }
                                      onDelete={() => removeStep(step.id)}
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
          className="md:hidden fixed bottom-5 right-5 z-[1] h-10 w-10 rounded-full shadow-lg active:scale-95 transition-colors duration-200 flex items-center justify-center"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
