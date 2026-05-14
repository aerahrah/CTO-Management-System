import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Save,
  Settings2,
  Key,
  Search,
  Info,
} from "lucide-react";

import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} from "../../../api/role";
import { useAuth } from "../../../store/authStore";
import Breadcrumbs from "../../breadCrumbs";

/* =========================
   Constants
========================= */
const AVAILABLE_PERMISSIONS = [
  {
    id: "*",
    label: "Super Admin (All Permissions)",
    hint: "Grants unrestricted access to all modules and settings.",
  },
  {
    id: "employees.view",
    label: "View Employees",
    hint: "Can view the employee directory and profiles.",
  },
  {
    id: "employees.create",
    label: "Create Employees",
    hint: "Can onboard new employees into the system.",
  },
  {
    id: "employees.edit",
    label: "Edit Employees",
    hint: "Can modify existing employee records.",
  },
  {
    id: "employees.delete",
    label: "Delete Employees",
    hint: "Can remove employees from the system.",
  },
  {
    id: "roles.view",
    label: "View Roles",
    hint: "Can view system roles and their assigned permissions.",
  },
  {
    id: "settings.view",
    label: "View Settings & Logs",
    hint: "Can view system configurations and audit logs.",
  },
  {
    id: "settings.edit",
    label: "Edit Settings",
    hint: "Can modify core system settings.",
  },
  {
    id: "cto.view_all",
    label: "View All CTO Records",
    hint: "Can view Compensatory Time-off records for everyone.",
  },
  {
    id: "cto.approve_hr",
    label: "Approve CTO (HR)",
    hint: "Can perform HR-level approvals for CTO requests.",
  },
  {
    id: "cto.approve_supervisor",
    label: "Approve CTO (Supervisor)",
    hint: "Can perform Supervisor-level approvals for CTO requests.",
  },
  {
    id: "cto.create",
    label: "Apply for CTO",
    hint: "Can file a new Compensatory Time-off application.",
  },
  {
    id: "cto.view_self",
    label: "View Own CTO Records",
    hint: "Can view their personal CTO applications.",
  },
  {
    id: "employees.view_self",
    label: "View Own Profile",
    hint: "Can view their personal employee profile.",
  },
];

/* =========================
   Helpers & Theme Logic
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

const getErrorStyles = (theme) =>
  theme === "dark"
    ? {
        wrapBg: "rgba(244,63,94,0.12)",
        wrapBorder: "rgba(244,63,94,0.22)",
        wrapText: "#fda4af",
      }
    : {
        wrapBg: "rgba(244,63,94,0.08)",
        wrapBorder: "rgba(244,63,94,0.18)",
        wrapText: "#be123c",
      };

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

/* =========================
   UI Primitives
========================= */
const Card = ({ children, className = "", borderColor }) => (
  <div
    className={[
      "rounded-xl shadow-sm overflow-hidden transition-colors duration-300 ease-out",
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

const InlineError = ({ message, theme }) => {
  if (!message) return null;
  const s = getErrorStyles(theme);
  return (
    <div
      className="mt-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-300 ease-out"
      style={{
        backgroundColor: s.wrapBg,
        border: `1px solid ${s.wrapBorder}`,
        color: s.wrapText,
      }}
    >
      {message}
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
      className="rounded-xl px-4 py-3 flex gap-3 transition-colors duration-300 ease-out"
      style={{ backgroundColor: t.wrapBg, border: `1px solid ${t.wrapBorder}` }}
    >
      <div className="mt-0.5">
        <Icon className="w-4 h-4" style={{ color: t.icon }} />
      </div>
      <div className="min-w-0">
        {title && (
          <div className="text-xs font-semibold" style={{ color: t.title }}>
            {title}
          </div>
        )}
        <div
          className="text-xs leading-relaxed mt-0.5"
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

const GhostButton = ({
  children,
  disabled,
  onClick,
  className = "",
  borderColor,
  theme,
  danger,
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
        backgroundColor: disabled ? disabledBg : "var(--app-surface)",
        color: disabled
          ? "var(--app-muted)"
          : danger
            ? "#ef4444"
            : "var(--app-text)",
        border: `1px solid ${danger ? "rgba(239,68,68,0.3)" : borderColor}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  );
};

const Toggle = ({
  checked,
  disabled,
  onChange,
  label,
  hint,
  borderColor,
  theme,
}) => {
  const offBg =
    theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div
          className="text-sm font-semibold break-words transition-colors duration-300 ease-out"
          style={{ color: "var(--app-text)" }}
        >
          {label}
        </div>
        {hint && (
          <div
            className="text-xs mt-0.5 leading-relaxed break-words transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {hint}
          </div>
        )}
      </div>
      <div className="flex-none shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(!checked)}
          className="relative inline-flex h-7 w-12 items-center rounded-full transition flex-none shrink-0"
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
              "inline-block h-5 w-5 transform rounded-full shadow transition",
              checked ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
            style={{ backgroundColor: "#ffffff" }}
          />
        </button>
      </div>
    </div>
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

const SkeletonCard = ({ theme, borderColor }) => (
  <Card
    borderColor={borderColor}
    className="p-5 flex flex-col justify-between h-48"
  >
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <SkeletonLine width="60%" height={24} theme={theme} />
        <SkeletonLine width={24} height={24} theme={theme} />
      </div>
      <div className="space-y-2">
        <SkeletonLine width="100%" height={14} theme={theme} />
        <SkeletonLine width="80%" height={14} theme={theme} />
      </div>
    </div>
    <div
      className="pt-4 border-t mt-4 flex justify-between"
      style={{ borderColor }}
    >
      <SkeletonLine width="30%" height={20} theme={theme} />
      <SkeletonLine width="20%" height={14} theme={theme} />
    </div>
  </Card>
);

/* =========================
   Main Component
========================= */
export default function RolesSettings() {
  const queryClient = useQueryClient();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
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
  const subtleBg = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15,23,42,0.03)",
    [resolvedTheme],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);
  const [search, setSearch] = useState("");
  const [inlineError, setInlineError] = useState("");

  const {
    data: roles,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
  });

  const createMut = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role created successfully");
      setIsEditing(false);
      setInlineError("");
    },
    onError: (err) => {
      setInlineError(getErrMsg(err, "Failed to create role"));
      toast.error("Failed to create role");
    },
  });

  const updateMut = useMutation({
    mutationFn: updateRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role updated successfully");
      setIsEditing(false);
      setInlineError("");
    },
    onError: (err) => {
      setInlineError(getErrMsg(err, "Failed to update role"));
      toast.error("Failed to update role");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role deleted successfully");
    },
    onError: (err) => {
      toast.error(getErrMsg(err, "Failed to delete role"));
    },
  });

  const isSaving = createMut.isPending || updateMut.isPending;

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)),
    );
  }, [roles, search]);

  const handleEdit = (role) => {
    setCurrentRole({ ...role });
    setInlineError("");
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setCurrentRole({ name: "", description: "", permissions: [] });
    setInlineError("");
    setIsEditing(true);
  };

  const handleDelete = (id) => {
    if (
      window.confirm(
        "Are you sure you want to delete this role? This action cannot be undone.",
      )
    ) {
      deleteMut.mutate(id);
    }
  };

  const togglePermission = (permId) => {
    setCurrentRole((prev) => {
      let perms = [...prev.permissions];
      if (permId === "*") {
        if (perms.includes("*")) perms = [];
        else perms = ["*"];
      } else {
        if (perms.includes("*")) perms = perms.filter((p) => p !== "*");
        if (perms.includes(permId)) {
          perms = perms.filter((p) => p !== permId);
        } else {
          perms.push(permId);
        }
      }
      return { ...prev, permissions: perms };
    });
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    setInlineError("");
    if (!currentRole.name.trim()) {
      setInlineError("Role name is required.");
      return;
    }
    if (currentRole._id) {
      updateMut.mutate({ id: currentRole._id, ...currentRole });
    } else {
      createMut.mutate(currentRole);
    }
  };

  const handleRefetch = async () => {
    await refetch();
    toast.info("Roles refreshed");
  };

  return (
    <div
      className="w-full flex-1 flex h-full flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      {/* 
        ==============================
        FLAT LAYOUT CONTAINER
        (No nested overflow-y-auto to prevent wheel scroll locks)
        ============================== 
      */}
      <div className="px-1 w-full mx-auto py-2 pb-8">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "SETTINGS", to: "/app/settings" },
            { label: "ROLES & PERMISSIONS", to: "/app/settings/roles" },
          ]}
        />

        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mt-2 mb-5">
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out flex items-center gap-2"
              style={{ color: "var(--app-text)" }}
            >
              <ShieldCheck
                className="w-8 h-8"
                style={{ color: "var(--accent)" }}
              />
              Roles & Permissions
            </h1>
            <p
              className="text-sm mt-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Manage system roles, define access controls, and assign
              capabilities.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isEditing && (
              <>
                <GhostButton
                  onClick={handleRefetch}
                  disabled={isLoading || isRefetching}
                  borderColor={borderColor}
                  theme={resolvedTheme}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {isRefetching ? "Refreshing..." : "Refresh"}
                  </span>
                </GhostButton>
                <PrimaryButton
                  onClick={handleCreateNew}
                  borderColor={borderColor}
                  theme={resolvedTheme}
                >
                  <Plus className="w-4 h-4" />
                  New Role
                </PrimaryButton>
              </>
            )}
          </div>
        </div>

        {/* Toolbar for List View */}
        {!isEditing && (
          <div className="mb-6 relative max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--app-muted)" }}
            />
            <input
              type="text"
              placeholder="Search roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-11 rounded-lg text-sm outline-none transition-colors duration-200 ease-out"
              style={{
                backgroundColor: "var(--app-surface)",
                border: `1px solid ${borderColor}`,
                color: "var(--app-text)",
              }}
            />
          </div>
        )}

        {/* Content Area */}
        {isEditing ? (
          <div className="max-w-4xl mx-auto space-y-4">
            <Card borderColor={borderColor}>
              <div
                className="px-5 py-4 border-b transition-colors duration-300 ease-out flex items-center gap-2"
                style={{ backgroundColor: "var(--app-surface)", borderColor }}
              >
                <Settings2
                  className="w-4 h-4"
                  style={{ color: "var(--app-muted)" }}
                />
                <div
                  className="text-sm font-semibold transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-text)" }}
                >
                  {currentRole._id ? "Edit Role Profile" : "Create New Role"}
                </div>
              </div>

              <div className="p-5 space-y-5">
                {currentRole.isSystem && (
                  <SoftNotice
                    icon={ShieldAlert}
                    tone="amber"
                    title="Protected System Role"
                    theme={resolvedTheme}
                  >
                    This is a core system role. Its name cannot be modified, and
                    it cannot be deleted to ensure system stability. You may
                    only adjust its permissions.
                  </SoftNotice>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label
                      className="block text-xs font-bold uppercase tracking-wider mb-2"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Role Name
                    </label>
                    <input
                      required
                      type="text"
                      value={currentRole.name}
                      onChange={(e) =>
                        setCurrentRole({ ...currentRole, name: e.target.value })
                      }
                      disabled={currentRole.isSystem || isSaving}
                      className="w-full h-11 rounded-lg px-3 text-sm outline-none transition-colors duration-200 ease-out"
                      style={{
                        backgroundColor: currentRole.isSystem
                          ? "transparent"
                          : inputBg,
                        border: `1px solid ${borderColor}`,
                        color: currentRole.isSystem
                          ? "var(--app-muted)"
                          : "var(--app-text)",
                        opacity: currentRole.isSystem ? 0.7 : 1,
                      }}
                      placeholder="e.g. IT Administrator"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs font-bold uppercase tracking-wider mb-2"
                      style={{ color: "var(--app-muted)" }}
                    >
                      Description
                    </label>
                    <input
                      type="text"
                      value={currentRole.description}
                      onChange={(e) =>
                        setCurrentRole({
                          ...currentRole,
                          description: e.target.value,
                        })
                      }
                      disabled={isSaving}
                      className="w-full h-11 rounded-lg px-3 text-sm outline-none transition-colors duration-200 ease-out"
                      style={{
                        backgroundColor: inputBg,
                        border: `1px solid ${borderColor}`,
                        color: "var(--app-text)",
                      }}
                      placeholder="Brief summary of responsibilities..."
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card borderColor={borderColor}>
              <div
                className="px-5 py-4 border-b transition-colors duration-300 ease-out flex items-center justify-between"
                style={{ backgroundColor: "var(--app-surface)", borderColor }}
              >
                <div className="flex items-center gap-2">
                  <Key
                    className="w-4 h-4"
                    style={{ color: "var(--app-muted)" }}
                  />
                  <div
                    className="text-sm font-semibold transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    Access Permissions
                  </div>
                </div>
                <div
                  className="text-[11px] font-medium"
                  style={{ color: "var(--app-muted)" }}
                >
                  {currentRole.permissions.includes("*")
                    ? "All permissions granted"
                    : `${currentRole.permissions.length} selected`}
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <Toggle
                      key={perm.id}
                      checked={currentRole.permissions.includes(perm.id)}
                      disabled={isSaving}
                      onChange={() => togglePermission(perm.id)}
                      label={perm.label}
                      hint={perm.hint}
                      borderColor={borderColor}
                      theme={resolvedTheme}
                    />
                  ))}
                </div>

                <InlineError message={inlineError} theme={resolvedTheme} />
              </div>

              <div
                className="px-5 py-4 border-t flex justify-end gap-3 transition-colors duration-300 ease-out"
                style={{ backgroundColor: "var(--app-surface-2)", borderColor }}
              >
                <GhostButton
                  onClick={() => {
                    setIsEditing(false);
                    setInlineError("");
                  }}
                  disabled={isSaving}
                  borderColor={borderColor}
                  theme={resolvedTheme}
                >
                  Cancel
                </GhostButton>
                <PrimaryButton
                  onClick={handleSubmit}
                  disabled={isSaving || !currentRole.name.trim()}
                  borderColor={borderColor}
                  theme={resolvedTheme}
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save Role"}
                </PrimaryButton>
              </div>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {isLoading ? (
              <>
                <SkeletonCard theme={resolvedTheme} borderColor={borderColor} />
                <SkeletonCard theme={resolvedTheme} borderColor={borderColor} />
                <SkeletonCard theme={resolvedTheme} borderColor={borderColor} />
                <SkeletonCard theme={resolvedTheme} borderColor={borderColor} />
              </>
            ) : filteredRoles.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 px-4 text-center">
                <div
                  className="p-6 rounded-full mb-4 ring-1"
                  style={{ backgroundColor: "var(--app-surface)", borderColor }}
                >
                  <Search
                    className="w-10 h-10"
                    style={{ color: "var(--app-muted)", opacity: 0.6 }}
                  />
                </div>
                <h3
                  className="text-lg font-bold"
                  style={{ color: "var(--app-text)" }}
                >
                  No Roles Found
                </h3>
                <p
                  className="text-sm max-w-xs mt-1"
                  style={{ color: "var(--app-muted)" }}
                >
                  Try adjusting your search criteria or create a new role.
                </p>
              </div>
            ) : (
              filteredRoles.map((role) => (
                <Card
                  key={role._id}
                  borderColor={borderColor}
                  className="flex flex-col h-full group relative"
                >
                  <div className="p-5 flex-1 flex flex-col min-h-0">
                    <div className="flex justify-between items-start mb-3">
                      <div className="min-w-0 pr-2">
                        <h3
                          className="font-bold text-base transition-colors duration-300 ease-out flex items-center gap-2"
                          style={{ color: "var(--app-text)" }}
                        >
                          {role.name}
                          {role.isSystem && (
                            <div
                              className="flex items-center justify-center p-1 rounded-md"
                              style={{
                                backgroundColor: "rgba(245,158,11,0.12)",
                                color: "#d97706",
                              }}
                              title="System Protected"
                            >
                              <ShieldAlert size={12} />
                            </div>
                          )}
                        </h3>
                      </div>
                      <div className="flex flex-none items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(role)}
                          className="p-1.5 rounded-lg transition-colors duration-200 ease-out"
                          style={{ color: "var(--accent)" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "var(--accent-soft)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                          title="Edit Role"
                        >
                          <Pencil size={14} />
                        </button>
                        {!role.isSystem && (
                          <button
                            onClick={() => handleDelete(role._id)}
                            className="p-1.5 rounded-lg transition-colors duration-200 ease-out"
                            style={{ color: "#ef4444" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "rgba(239,68,68,0.1)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                            title="Delete Role"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <p
                      className="text-sm leading-relaxed transition-colors duration-300 ease-out line-clamp-3"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {role.description || "No description provided."}
                    </p>
                  </div>

                  <div
                    className="px-5 py-3 border-t flex items-center justify-between transition-colors duration-300 ease-out"
                    style={{ borderColor, backgroundColor: subtleBg }}
                  >
                    <span
                      className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        border: `1px solid ${borderColor}`,
                        color: "var(--app-text)",
                      }}
                    >
                      {role.permissions.includes("*")
                        ? "All Permissions"
                        : `${role.permissions.length} Permissions`}
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {role.isSystem ? "System Role" : "Custom Role"}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
