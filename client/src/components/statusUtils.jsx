import React from "react";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  UserMinus,
  UserX,
  UserCircle,
  ShieldCheck,
  Briefcase,
  Users,
  UserCog,
  Ban,
} from "lucide-react";

/**
 * Status styles (theme-aware; no tailwind dark: dependency)
 * Uses your CSS variables from ThemeSync:
 *  - --app-surface / --app-surface-2 / --app-text / --app-muted / --app-border
 *  - --accent / --accent-soft / --accent-soft2
 */
export const getStatusStyles = (status) => {
  const s = String(status || "").toUpperCase();

  // ✅ Theme-aware palette using CSS vars + safe fallbacks
  const base = {
    bg: "var(--app-surface-2)",
    text: "var(--app-text)",
    border: "var(--app-border)",
  };

  const palettes = {
    APPROVED: {
      bg: "rgba(34,197,94,0.14)",
      text: "#16a34a",
      border: "rgba(34,197,94,0.22)",
    },
    CREDITED: {
      bg: "rgba(34,197,94,0.14)",
      text: "#16a34a",
      border: "rgba(34,197,94,0.22)",
    },
    ACTIVE: {
      bg: "rgba(34,197,94,0.14)",
      text: "#16a34a",
      border: "rgba(34,197,94,0.22)",
    },

    REJECTED: {
      bg: "rgba(239,68,68,0.14)",
      text: "#ef4444",
      border: "rgba(239,68,68,0.22)",
    },
    TERMINATED: {
      bg: "rgba(239,68,68,0.14)",
      text: "#ef4444",
      border: "rgba(239,68,68,0.22)",
    },

    ROLLEDBACK: {
      bg: "rgba(244,63,94,0.14)",
      text: "#f43f5e",
      border: "rgba(244,63,94,0.22)",
    },

    RESIGNED: {
      bg: "rgba(245,158,11,0.16)",
      text: "#d97706",
      border: "rgba(245,158,11,0.26)",
    },

    INACTIVE: {
      bg: "var(--app-surface-2)",
      text: "var(--app-muted)",
      border: "var(--app-border)",
    },

    CANCELLED: {
      bg: "rgba(148,163,184,0.20)",
      text: "var(--app-text)",
      border: "rgba(148,163,184,0.28)",
    },

    // default (pending/unknown)
    DEFAULT: {
      bg: "rgba(234,179,8,0.16)",
      text: "#a16207",
      border: "rgba(234,179,8,0.26)",
    },
  };

  const p =
    palettes[s] || (s === "PENDING" ? palettes.DEFAULT : palettes.DEFAULT);

  return {
    backgroundColor: p.bg ?? base.bg,
    color: p.text ?? base.text,
    borderColor: p.border ?? base.border,
  };
};

/**
 * Returns a corresponding icon based on status.
 * Icons are also theme-aware (no tailwind color classes).
 */
export const StatusIcon = ({ status, className = "h-4 w-4" }) => {
  const s = String(status || "").toUpperCase();

  if (s === "APPROVED" || s === "CREDITED" || s === "ACTIVE")
    return <CheckCircle className={className} style={{ color: "#16a34a" }} />;

  if (s === "REJECTED" || s === "TERMINATED")
    return <XCircle className={className} style={{ color: "#ef4444" }} />;

  if (s === "ROLLEDBACK")
    return <RotateCcw className={className} style={{ color: "#f43f5e" }} />;

  if (s === "RESIGNED")
    return <UserMinus className={className} style={{ color: "#d97706" }} />;

  if (s === "INACTIVE")
    return (
      <UserX className={className} style={{ color: "var(--app-muted)" }} />
    );

  if (s === "CANCELLED")
    return (
      <Ban className={className} style={{ color: "rgba(148,163,184,0.95)" }} />
    );

  return <AlertCircle className={className} style={{ color: "#a16207" }} />;
};

/**
 * Renders a reusable status badge with icon + label.
 * ✅ Now uses inline styles so it looks correct in dark mode.
 */
export const StatusBadge = ({
  showIcon = true,
  status,
  size = "sm",
  className = "",
}) => {
  const sizes = {
    sm: { fontSize: "0.75rem", padding: "0.25rem 0.5rem" }, // ~text-xs px-2 py-1
    md: { fontSize: "0.875rem", padding: "0.375rem 0.75rem" }, // ~text-sm px-3 py-1.5
  };

  const style = getStatusStyles(status);

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${className}`}
      style={{
        ...style,
        ...sizes[size],
        lineHeight: 1,
        // smoother in both themes
        transition:
          "background-color 200ms ease, color 200ms ease, border-color 200ms ease",
      }}
      title={status}
    >
      {showIcon && <StatusIcon status={status} className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
};

/**
 * Role styles (theme-aware)
 */
export const getRoleStyles = (role) => {
  const r = String(role || "").toUpperCase();

  const base = {
    bg: "var(--app-surface-2)",
    text: "var(--app-text)",
    border: "var(--app-border)",
  };

  const palettes = {
    ADMIN: {
      bg: "rgba(99,102,241,0.16)",
      text: "#4f46e5",
      border: "rgba(99,102,241,0.26)",
    },
    SUPERVISOR: {
      bg: "rgba(37,99,235,0.16)",
      text: "#2563eb",
      border: "rgba(37,99,235,0.26)",
    },
    HR: {
      bg: "rgba(236,72,153,0.14)",
      text: "#db2777",
      border: "rgba(236,72,153,0.24)",
    },
    EMPLOYEE: {
      bg: "rgba(34,197,94,0.14)",
      text: "#16a34a",
      border: "rgba(34,197,94,0.22)",
    },
    DEFAULT: { bg: base.bg, text: "var(--app-muted)", border: base.border },
  };

  const p = palettes[r] || palettes.DEFAULT;

  return {
    backgroundColor: p.bg ?? base.bg,
    color: p.text ?? base.text,
    borderColor: p.border ?? base.border,
  };
};

/**
 * Returns a corresponding icon based on user role (theme-aware).
 */
export const RoleIcon = ({ role, className = "h-4 w-4" }) => {
  const r = String(role || "").toUpperCase();

  if (r === "ADMIN")
    return <ShieldCheck className={className} style={{ color: "#4f46e5" }} />;

  if (r === "SUPERVISOR")
    return <UserCog className={className} style={{ color: "#2563eb" }} />;

  if (r === "HR")
    return <Briefcase className={className} style={{ color: "#db2777" }} />;

  if (r === "EMPLOYEE")
    return <Users className={className} style={{ color: "#16a34a" }} />;

  return (
    <UserCircle className={className} style={{ color: "var(--app-muted)" }} />
  );
};

/**
 * Renders a role badge with icon + label.
 * ✅ Now uses inline styles so it looks correct in dark mode.
 */
export const RoleBadge = ({
  showIcon = true,
  role,
  size = "sm",
  className = "",
}) => {
  const sizes = {
    sm: { fontSize: "0.75rem", padding: "0.25rem 0.5rem" },
    md: { fontSize: "0.875rem", padding: "0.375rem 0.75rem" },
  };

  const style = getRoleStyles(role);

  return (
    <span
      className={`inline-flex capitalize items-center gap-1 font-medium rounded-full border ${className}`}
      style={{
        ...style,
        ...sizes[size],
        lineHeight: 1,
        transition:
          "background-color 200ms ease, color 200ms ease, border-color 200ms ease",
      }}
      title={role}
    >
      {showIcon && <RoleIcon role={role} className="h-3.5 w-3.5" />}
      {role}
    </span>
  );
};
