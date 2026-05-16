import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Settings2,
  ShieldAlert,
  CheckCircle2,
  Key,
  Save,
  ShieldCheck,
  ListChecks,
  Info,
} from "lucide-react";

import { getRoles, updateRole } from "../../../api/role";
import { useAuth } from "../../../store/authStore";
import Breadcrumbs from "../../breadCrumbs";

/* =========================
   Configuration & Helpers
========================= */
import { SUPER_ADMIN_PERM, PERMISSION_GROUPS } from "./permission";

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
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 ease-out active:scale-[0.98]",
        className,
      ].join(" ")}
      style={{
        backgroundColor: disabled ? disabledBg : "var(--accent)",
        color: disabled ? "var(--app-muted)" : "#ffffff",
        border: `1px solid ${disabled ? borderColor : "var(--accent)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
        boxShadow: disabled ? "none" : "0 2px 4px rgba(0,0,0,0.1)",
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
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 ease-out active:scale-[0.98]",
        className,
      ].join(" ")}
      style={{
        backgroundColor: disabled ? disabledBg : "transparent",
        color: disabled ? "var(--app-muted)" : "var(--app-text)",
        border: `1px solid ${borderColor}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.backgroundColor =
            theme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = "transparent";
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
    <div
      className={`flex items-start gap-3 transition-opacity ${disabled ? "opacity-60" : "hover:opacity-100"}`}
    >
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

/* =========================
   UpdateRole Component
========================= */
export default function UpdateRole() {
  const { id } = useParams();
  const navigate = useNavigate();
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
        ? "rgba(255,255,255,0.02)"
        : "rgba(15,23,42,0.02)",
    [resolvedTheme],
  );

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
  });

  const [currentRole, setCurrentRole] = useState(null);
  const [inlineError, setInlineError] = useState("");

  useEffect(() => {
    if (roles && id) {
      const foundRole = roles.find((r) => r._id === id);
      if (foundRole) {
        setCurrentRole({ ...foundRole });
      } else {
        toast.error("Role not found");
        navigate("/app/roles");
      }
    }
  }, [roles, id, navigate]);

  const updateMut = useMutation({
    mutationFn: updateRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role updated successfully");
      navigate("/app/roles");
    },
    onError: (err) => {
      setInlineError(getErrMsg(err, "Failed to update role"));
      toast.error("Failed to update role");
    },
  });

  const isSaving = updateMut.isPending;

  const togglePermission = (permId) => {
    setCurrentRole((prev) => {
      let perms = [...prev.permissions];
      if (permId === SUPER_ADMIN_PERM) {
        if (perms.includes(SUPER_ADMIN_PERM))
          perms = perms.filter((p) => p !== SUPER_ADMIN_PERM);
        else perms.push(SUPER_ADMIN_PERM);
      } else {
        if (perms.includes(permId)) perms = perms.filter((p) => p !== permId);
        else perms.push(permId);
      }
      return { ...prev, permissions: perms };
    });
  };

  const toggleGroup = (groupPermIds, isAllSelected) => {
    setCurrentRole((prev) => {
      let perms = [...prev.permissions];
      if (isAllSelected) {
        perms = perms.filter((p) => !groupPermIds.includes(p));
      } else {
        const missing = groupPermIds.filter((id) => !perms.includes(id));
        perms = [...perms, ...missing];
      }
      return { ...prev, permissions: perms };
    });
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    setInlineError("");
    if (!currentRole.name.trim()) {
      setInlineError("Role name is required.");
      toast.error("Role name is required.");
      return;
    }
    updateMut.mutate({ id: currentRole._id, ...currentRole });
  };

  const handleCancel = () => {
    navigate("/app/roles");
  };

  if (isLoading || !currentRole) {
    return (
      <div
        className="flex items-center justify-center p-10 h-full w-full"
        style={{ color: "var(--app-muted)" }}
      >
        Loading role details...
      </div>
    );
  }

  const isSuperAdmin = currentRole?.permissions?.includes(SUPER_ADMIN_PERM);

  return (
    <div
      className="w-full flex-1 flex h-full flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="px-1 w-full mx-auto py-2 pb-8">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "SETTINGS", to: "/app/settings" },
            { label: "ROLES & PERMISSIONS", to: "/app/roles" },
            { label: "EDIT ROLE", to: `/app/roles/${id}/update` },
          ]}
        />

        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mt-2 mb-8">
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out flex items-center gap-3"
              style={{ color: "var(--app-text)" }}
            >
              <div
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              Update Role
            </h1>
            <p
              className="text-sm mt-2 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Modify role properties and adjust system access permissions.
            </p>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Form (Span 2) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Edit Card */}
            <Card borderColor={borderColor}>
              <div
                className="px-6 py-4 border-b transition-colors duration-300 ease-out flex items-center gap-2"
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
                  Role Profile
                </div>
              </div>

              <div className="p-6 space-y-5">
                {currentRole.isSystem && (
                  <SoftNotice
                    icon={ShieldAlert}
                    tone="amber"
                    title="Protected System Role"
                    theme={resolvedTheme}
                  >
                    This is a core system role. Its name cannot be modified to
                    ensure system stability. You may only adjust its
                    permissions.
                  </SoftNotice>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      className="w-full h-11 rounded-lg px-4 text-sm outline-none transition-colors duration-200 ease-out focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent disabled:opacity-70 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: currentRole.isSystem
                          ? "transparent"
                          : inputBg,
                        border: `1px solid ${borderColor}`,
                        color: "var(--app-text)",
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
                      className="w-full h-11 rounded-lg px-4 text-sm outline-none transition-colors duration-200 ease-out focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
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

            {/* Permissions Setup Card */}
            <Card borderColor={borderColor}>
              <div
                className="px-6 py-4 border-b transition-colors duration-300 ease-out flex items-center justify-between"
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
                  className="text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md transition-colors"
                  style={{
                    backgroundColor: inputBg,
                    color: "var(--app-text)",
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  {isSuperAdmin
                    ? "Unrestricted Access"
                    : `${currentRole.permissions.length} selected`}
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Super Admin Toggle */}
                <div
                  className="p-5 rounded-xl border transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: isSuperAdmin
                      ? "var(--accent-soft)"
                      : inputBg,
                    borderColor: isSuperAdmin ? "var(--accent)" : borderColor,
                  }}
                >
                  <Toggle
                    checked={isSuperAdmin}
                    disabled={isSaving}
                    onChange={() => togglePermission(SUPER_ADMIN_PERM)}
                    label="Super Admin (All Permissions)"
                    hint="Grants unrestricted, permanent access to all modules and settings. Overrides all toggles below."
                    borderColor={borderColor}
                    theme={resolvedTheme}
                  />
                </div>

                {isSuperAdmin && (
                  <SoftNotice
                    icon={CheckCircle2}
                    tone="blue"
                    title="Super Admin Active"
                    theme={resolvedTheme}
                  >
                    Because this role is a Super Admin, all individual
                    permissions below are automatically granted and locked.
                  </SoftNotice>
                )}

                {/* Grouped Permissions */}
                <div className="space-y-6">
                  {PERMISSION_GROUPS.map((group) => {
                    const groupPermIds = group.permissions.map((p) => p.id);
                    const selectedInGroup = groupPermIds.filter((id) =>
                      currentRole.permissions.includes(id),
                    );
                    const isAllSelected =
                      selectedInGroup.length === groupPermIds.length;
                    const visualAllSelected = isSuperAdmin || isAllSelected;
                    const isGroupDisabled = isSaving || isSuperAdmin;

                    return (
                      <div
                        key={group.name}
                        className="rounded-xl border overflow-hidden transition-colors duration-300 ease-out"
                        style={{
                          borderColor,
                          backgroundColor: "var(--app-surface)",
                        }}
                      >
                        <div
                          className="px-6 py-4 border-b flex items-center justify-between transition-colors duration-300 ease-out"
                          style={{ borderColor, backgroundColor: subtleBg }}
                        >
                          <div>
                            <h4
                              className="text-sm font-bold"
                              style={{ color: "var(--app-text)" }}
                            >
                              {group.name}
                            </h4>
                            <p
                              className="text-xs mt-1"
                              style={{ color: "var(--app-muted)" }}
                            >
                              {isSuperAdmin
                                ? "All granted via Super Admin"
                                : `${selectedInGroup.length} of ${group.permissions.length} selected`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className="text-xs font-semibold"
                              style={{ color: "var(--app-muted)" }}
                            >
                              Select All
                            </span>
                            <button
                              type="button"
                              disabled={isGroupDisabled}
                              onClick={() =>
                                toggleGroup(groupPermIds, isAllSelected)
                              }
                              className="relative inline-flex h-6 w-11 items-center rounded-full transition flex-none shrink-0"
                              style={{
                                backgroundColor: visualAllSelected
                                  ? "var(--accent)"
                                  : resolvedTheme === "dark"
                                    ? "rgba(255,255,255,0.06)"
                                    : "rgba(15,23,42,0.06)",
                                border: `1px solid ${
                                  visualAllSelected
                                    ? "var(--accent)"
                                    : borderColor
                                }`,
                                cursor: isGroupDisabled
                                  ? "not-allowed"
                                  : "pointer",
                                opacity: isGroupDisabled ? 0.55 : 1,
                              }}
                            >
                              <span
                                className={[
                                  "inline-block h-4 w-4 transform rounded-full shadow transition",
                                  visualAllSelected
                                    ? "translate-x-6"
                                    : "translate-x-1",
                                ].join(" ")}
                                style={{ backgroundColor: "#ffffff" }}
                              />
                            </button>
                          </div>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                          {group.permissions.map((perm) => {
                            const isChecked =
                              isSuperAdmin ||
                              currentRole.permissions.includes(perm.id);
                            return (
                              <Toggle
                                key={perm.id}
                                checked={isChecked}
                                disabled={isGroupDisabled}
                                onChange={() => togglePermission(perm.id)}
                                label={perm.label}
                                hint={perm.hint}
                                borderColor={borderColor}
                                theme={resolvedTheme}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <InlineError message={inlineError} theme={resolvedTheme} />
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <GhostButton
                onClick={handleCancel}
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
                <Save className="w-4 h-4" />{" "}
                {isSaving ? "Saving..." : "Save Changes"}
              </PrimaryButton>
            </div>
          </div>

          {/* Right Column: Summary (Span 1) */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6" borderColor={borderColor}>
              <div
                className="px-6 py-4 border-b transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: borderColor,
                }}
              >
                <div className="flex items-center gap-2">
                  <ListChecks
                    className="w-4 h-4"
                    style={{ color: "var(--app-muted)" }}
                  />
                  <div
                    className="text-sm font-semibold transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    Summary
                  </div>
                </div>
                <div
                  className="text-xs mt-1 transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Quick view of current role configurations.
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div
                  className="rounded-xl p-4 transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: subtleBg,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Role Name
                  </div>
                  <div
                    className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out truncate"
                    style={{ color: "var(--app-text)" }}
                  >
                    {currentRole.name || (
                      <span className="italic opacity-60">Untitled Role</span>
                    )}
                  </div>
                </div>

                <div
                  className="rounded-xl p-4 transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: subtleBg,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Access Level
                  </div>
                  <div
                    className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    {isSuperAdmin ? "Super Admin" : "Custom Configuration"}
                  </div>
                  <div
                    className="mt-1 text-xs transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {isSuperAdmin
                      ? "Has access to all current and future modules."
                      : `${currentRole.permissions.length} specific permission(s) granted.`}
                  </div>
                </div>

                {!currentRole.name.trim() && (
                  <SoftNotice
                    icon={Info}
                    tone="blue"
                    title="Required Fields"
                    theme={resolvedTheme}
                  >
                    You must provide a Role Name before you can save this
                    configuration.
                  </SoftNotice>
                )}

                <PrimaryButton
                  onClick={handleSubmit}
                  disabled={isSaving || !currentRole.name.trim()}
                  className="w-full mt-4"
                  borderColor={borderColor}
                  theme={resolvedTheme}
                >
                  <Save className="w-4 h-4" />{" "}
                  {isSaving ? "Saving..." : "Save Changes"}
                </PrimaryButton>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
