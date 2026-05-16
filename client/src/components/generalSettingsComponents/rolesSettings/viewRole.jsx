import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Settings2,
  ShieldAlert,
  CheckCircle2,
  Key,
  ShieldCheck,
  Pencil,
  ListChecks,
} from "lucide-react";

import { getRoles } from "../../../api/role";
import { useAuth } from "../../../store/authStore";
import Breadcrumbs from "../../breadCrumbs";

/* =========================
   Configuration & Helpers
========================= */
import { SUPER_ADMIN_PERM, PERMISSION_GROUPS } from "./permission";

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

const Toggle = ({ checked, label, hint, borderColor, theme }) => {
  const offBg =
    theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
  return (
    <div className="flex items-start gap-3 opacity-80 transition-opacity hover:opacity-100">
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
          disabled={true}
          className="relative inline-flex h-7 w-12 items-center rounded-full transition flex-none shrink-0 cursor-default"
          style={{
            backgroundColor: checked ? "var(--accent)" : offBg,
            border: `1px solid ${checked ? "var(--accent)" : borderColor}`,
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
   ViewRole Component
========================= */
export default function ViewRole() {
  const { id } = useParams();
  const navigate = useNavigate();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useResolvedTheme(prefTheme);

  const borderColor = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.07)"
        : "rgba(15,23,42,0.08)",
    [resolvedTheme],
  );
  const inputBg = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(15,23,42,0.02)",
    [resolvedTheme],
  );
  const subtleBg = useMemo(
    () =>
      resolvedTheme === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(15,23,42,0.01)",
    [resolvedTheme],
  );

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
  });

  const [currentRole, setCurrentRole] = useState(null);

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

  const handleEdit = () => {
    navigate(`/app/roles/${id}/update`);
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
            { label: "VIEW ROLE", to: `/app/roles/${id}` },
          ]}
        />

        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mt-2 mb-4">
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out flex items-center gap-3"
              style={{ color: "var(--app-text)" }}
            >
              {/* <div
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <ShieldCheck className="w-6 h-6" />
              </div> */}
              Role Overview
            </h1>
            <p
              className="text-sm mt-2 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Viewing role properties and system access permissions.
            </p>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Form (Span 2) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Card */}
            <Card borderColor={borderColor}>
              <div
                className="px-6 py-4 border-b transition-colors duration-300 ease-out flex items-center justify-between"
                style={{ backgroundColor: "var(--app-surface)", borderColor }}
              >
                <div className="flex items-center gap-2">
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
              </div>

              <div className="p-6 space-y-6">
                {currentRole.isSystem && (
                  <SoftNotice
                    icon={ShieldAlert}
                    tone="amber"
                    title="Protected System Role"
                    theme={resolvedTheme}
                  >
                    This is a core system role. It is heavily protected to
                    ensure system stability.
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
                      readOnly
                      type="text"
                      value={currentRole.name}
                      className="w-full h-11 rounded-lg px-4 text-sm outline-none transition-colors duration-200 ease-out cursor-default font-medium"
                      style={{
                        backgroundColor: inputBg,
                        border: `1px solid ${borderColor}`,
                        color: "var(--app-text)",
                      }}
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
                      readOnly
                      type="text"
                      value={
                        currentRole.description || "No description provided."
                      }
                      className="w-full h-11 rounded-lg px-4 text-sm outline-none transition-colors duration-200 ease-out cursor-default"
                      style={{
                        backgroundColor: inputBg,
                        border: `1px solid ${borderColor}`,
                        color: "var(--app-text)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Permissions Card */}
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
                  className="text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md"
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

                <div className="space-y-6">
                  {PERMISSION_GROUPS.map((group) => {
                    const groupPermIds = group.permissions.map((p) => p.id);
                    const selectedInGroup = groupPermIds.filter((id) =>
                      currentRole.permissions.includes(id),
                    );
                    const isAllSelected =
                      selectedInGroup.length === groupPermIds.length;
                    const visualAllSelected = isSuperAdmin || isAllSelected;

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
                          <div className="flex items-center gap-3 opacity-80">
                            <span
                              className="text-xs font-semibold"
                              style={{ color: "var(--app-muted)" }}
                            >
                              Select All
                            </span>
                            <button
                              type="button"
                              disabled={true}
                              className="relative inline-flex h-6 w-11 items-center rounded-full transition flex-none shrink-0 cursor-default"
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
              </div>
            </Card>
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
                  Quick overview of role details.
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

                <PrimaryButton
                  onClick={handleEdit}
                  className="w-full mt-4"
                  borderColor={borderColor}
                  theme={resolvedTheme}
                >
                  <Pencil className="w-4 h-4" /> Edit Role
                </PrimaryButton>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
