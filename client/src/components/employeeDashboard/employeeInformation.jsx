import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getEmployeeById } from "../../api/employee";
import { StatusBadge, RoleBadge } from "../statusUtils";
import { useParams, useNavigate } from "react-router-dom";
import Breadcrumbs from "../breadCrumbs";
import { toast } from "react-toastify";
import { useAuth } from "../../store/authStore";
import { usePermissions } from "../../hooks/usePermissions";
import EmployeeResetPassword from "./employeeResetPassword";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  ShieldCheck,
  Clock,
  Building2,
  Hash,
  Copy,
  Check,
  MoreHorizontal,
  Layers,
  AlertCircle,
  HeartPulse, // Good icon for wellness leave
  KeyRound,
} from "lucide-react";

/* =========================
   Theme
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
   Utils
========================= */
const formatDate = (dateString, opts = {}) => {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...opts,
  }).format(d);
};

const calculateTenure = (dateString) => {
  if (!dateString) return "";
  const start = new Date(dateString);
  const now = new Date();
  if (Number.isNaN(start.getTime())) return "";

  const diffMs = Math.max(0, now - start);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
  if (diffDays < 365) {
    const months = Math.max(1, Math.floor(diffDays / 30));
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  const years = diffDays / 365;
  return `${years.toFixed(1)} year${years.toFixed(1) === "1.0" ? "" : "s"}`;
};

const safeCopy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// Capitalize first letters of each word
const formatName = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const toneStyle = (tone, resolvedTheme) => {
  const isDark = resolvedTheme === "dark";

  const tones = {
    slate: {
      backgroundColor: isDark
        ? "rgba(148,163,184,0.14)"
        : "rgba(148,163,184,0.10)",
      color: isDark ? "#cbd5e1" : "#475569",
      borderColor: isDark ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.18)",
    },
    blue: {
      backgroundColor: isDark
        ? "rgba(59,130,246,0.14)"
        : "rgba(59,130,246,0.10)",
      color: isDark ? "#93c5fd" : "#1d4ed8",
      borderColor: isDark ? "rgba(59,130,246,0.28)" : "rgba(59,130,246,0.18)",
    },
    emerald: {
      backgroundColor: isDark
        ? "rgba(16,185,129,0.14)"
        : "rgba(16,185,129,0.10)",
      color: isDark ? "#6ee7b7" : "#047857",
      borderColor: isDark ? "rgba(16,185,129,0.28)" : "rgba(16,185,129,0.18)",
    },
    amber: {
      backgroundColor: isDark
        ? "rgba(245,158,11,0.14)"
        : "rgba(245,158,11,0.10)",
      color: isDark ? "#fcd34d" : "#b45309",
      borderColor: isDark ? "rgba(245,158,11,0.28)" : "rgba(245,158,11,0.18)",
    },
    rose: {
      backgroundColor: isDark ? "rgba(244,63,94,0.14)" : "rgba(244,63,94,0.10)",
      color: isDark ? "#fda4af" : "#be123c",
      borderColor: isDark ? "rgba(244,63,94,0.28)" : "rgba(244,63,94,0.18)",
    },
  };

  return tones[tone] || tones.slate;
};

/* =========================
   UI Primitives
========================= */
const Card = ({
  title,
  subtitle,
  action,
  children,
  className = "",
  borderColor,
}) => (
  <div
    className={[
      "rounded-2xl transition-all duration-300 ease-out",
      className,
    ].join(" ")}
    style={{
      backgroundColor: "var(--app-surface)",
      border: `1px solid ${borderColor}`,
      backdropFilter: "blur(10px)",
      boxShadow: "0 1px 0 rgba(15,23,42,0.04)",
    }}
  >
    {(title || action) && (
      <div
        className="px-4 md:px-6 py-4 flex items-center justify-between gap-3 border-b transition-colors duration-300 ease-out"
        style={{ borderColor }}
      >
        <div className="min-w-0">
          {title && (
            <h3
              className="text-sm font-semibold truncate transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {title}
            </h3>
          )}
          {subtitle && (
            <p
              className="text-xs mt-0.5 leading-snug transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div
            className="shrink-0 transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {action}
          </div>
        )}
      </div>
    )}
    <div className="px-4 md:px-6 py-5">{children}</div>
  </div>
);

const SectionHeader = ({ icon: Icon, title, right, borderColor }) => (
  <div className="flex items-center justify-between gap-3 mb-4">
    <div className="flex items-center gap-2">
      <div
        className="p-2 rounded-xl border transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface-2)",
          color: "var(--app-muted)",
          borderColor,
        }}
      >
        <Icon size={16} />
      </div>
      <h2
        className="text-sm font-medium transition-colors duration-300 ease-out"
        style={{ color: "var(--app-muted)" }}
      >
        {title}
      </h2>
    </div>
    {right}
  </div>
);

const Pill = ({ children, tone = "slate", resolvedTheme }) => (
  <span
    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
    style={toneStyle(tone, resolvedTheme)}
  >
    {children}
  </span>
);

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
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider"
      style={style}
    >
      {displayType}
    </span>
  );
};

/* =========================
   Main: EmployeeInformation
========================= */
const EmployeeInformation = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams();

  // Permissions integration
  const { can } = usePermissions();
  const canEditEmployee = can("employees.edit");
  const canResetPassword = can("employees.reset_password");

  const [resetOpen, setResetOpen] = useState(false);

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const pageBg = useMemo(() => {
    return "var(--app-bg, rgba(245,245,245,0.80))";
  }, []);

  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployeeById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const emp = data?.data;

  const onRetry = () =>
    queryClient.refetchQueries({ queryKey: ["employee", id] });

  const copyToClipboard = async (text, label) => {
    if (!text) return;
    const ok = await safeCopy(text);
    if (ok) {
      toast.success(`${label} copied`, {
        autoClose: 900,
        position: "bottom-center",
      });
    } else {
      toast.error("Copy failed. Please try again.");
    }
  };

  if (!id) {
    return (
      <EmptyState borderColor={borderColor} resolvedTheme={resolvedTheme} />
    );
  }

  if (isError) {
    return (
      <ErrorState
        onRetry={onRetry}
        borderColor={borderColor}
        resolvedTheme={resolvedTheme}
      />
    );
  }

  if (isLoading || !emp) {
    return (
      <EmployeeSkeleton
        borderColor={borderColor}
        resolvedTheme={resolvedTheme}
      />
    );
  }

  const initials = `${emp?.firstName?.[0] ?? ""}${emp?.lastName?.[0] ?? ""}`
    .trim()
    .toUpperCase();

  // ✅ Construct full name with capitalization applied correctly
  const fullName = [
    emp?.prefixTitle?.trim(),
    formatName(emp?.firstName),
    formatName(emp?.middleName),
    formatName(emp?.lastName),
    emp?.nameExtension?.trim(),
    emp?.postfixTitle?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="min-h-screen font-sans transition-colors duration-300 ease-out"
      style={{
        backgroundColor: pageBg,
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="mx-auto space-y-6">
        <Breadcrumbs rootLabel="home" rootTo="/app" />

        <div
          className="rounded-xl overflow-hidden transition-all duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface)",
            border: `1px solid ${borderColor}`,
            backdropFilter: "blur(10px)",
            boxShadow: "0 1px 0 rgba(15,23,42,0.04)",
          }}
        >
          <div
            className="px-1.5 md:px-6 pt-5 pb-4 border-b transition-colors duration-300 ease-out"
            style={{ borderColor }}
          >
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="mt-3 flex items-start gap-4">
                  <div
                    className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-base font-semibold shadow-sm"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "#fff",
                    }}
                  >
                    {initials || "?"}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1
                        className="text-2xl md:text-3xl font-semibold tracking-tight truncate transition-colors duration-300 ease-out"
                        style={{ color: "var(--app-text)" }}
                      >
                        {fullName}
                      </h1>
                      <EmployeeTypeBadge
                        type={emp?.employeeType}
                        resolvedTheme={resolvedTheme}
                      />
                      <StatusBadge status={emp?.status} />
                    </div>

                    <div
                      className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm transition-colors duration-300 ease-out"
                      style={{ color: "var(--app-muted)" }}
                    >
                      <span className="flex items-center gap-1.5">
                        <Building2
                          size={14}
                          style={{ color: "var(--app-muted)" }}
                        />
                        {emp?.division || emp?.department || "-"}
                      </span>
                      <span
                        className="hidden sm:inline transition-colors duration-300 ease-out"
                        style={{ color: borderColor }}
                      >
                        •
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Briefcase
                          size={14}
                          style={{ color: "var(--app-muted)" }}
                        />
                        {emp?.position || "-"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Pill tone="slate" resolvedTheme={resolvedTheme}>
                        {emp?.role?.name || "Employee"}
                      </Pill>
                      {emp?.dateHired && (
                        <Pill tone="emerald" resolvedTheme={resolvedTheme}>
                          {calculateTenure(emp?.dateHired)} tenure
                        </Pill>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                {canResetPassword && (
                  <button
                    type="button"
                    onClick={() => setResetOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      borderColor,
                      color: "var(--app-text)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--app-surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--app-surface)";
                    }}
                  >
                    <KeyRound size={16} />
                    Reset Password
                  </button>
                )}

                {canEditEmployee && (
                  <button
                    type="button"
                    onClick={() => navigate(`/app/employees/${id}/update`)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "#fff",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = "brightness(0.95)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "none";
                    }}
                  >
                    <ShieldCheck size={16} />
                    Update Profile
                  </button>
                )}
              </div>
            </div>

            <div
              className="mt-6 flex gap-2 overflow-x-auto no-scrollbar p-1 rounded-2xl border transition-colors duration-300 ease-out"
              style={{
                backgroundColor: "var(--app-surface-2)",
                borderColor,
              }}
            >
              <TabButton
                active={activeTab === "overview"}
                onClick={() => setActiveTab("overview")}
                label="Overview"
                icon={<Layers size={16} />}
                borderColor={borderColor}
              />
              <TabButton
                active={activeTab === "personal"}
                onClick={() => setActiveTab("personal")}
                label="Personal Info"
                icon={<User size={16} />}
                borderColor={borderColor}
              />
              <TabButton
                active={activeTab === "job"}
                onClick={() => setActiveTab("job")}
                label="Job Details"
                icon={<Briefcase size={16} />}
                borderColor={borderColor}
              />
            </div>
          </div>

          <div className="px-1.5 md:px-6 py-6 bg-transparent">
            <div className="max-w-5xl mx-auto space-y-6">
              {activeTab === "overview" && (
                <>
                  <section>
                    <SectionHeader
                      icon={Clock}
                      title="Leave Balances"
                      borderColor={borderColor}
                    />
                    {/* ✅ Adjusted grid layout to accommodate 4 items */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* ✅ Fixed VL and SL balance bindings to match the schema names and updated units to Days */}
                      <MetricTile
                        label="Vacation Leave"
                        value={emp?.balances?.vlDays}
                        unit="Days"
                        tone="blue"
                        icon={<Briefcase size={18} />}
                        borderColor={borderColor}
                        resolvedTheme={resolvedTheme}
                      />
                      <MetricTile
                        label="Sick Leave"
                        value={emp?.balances?.slDays}
                        unit="Days"
                        tone="rose"
                        icon={<Clock size={18} />}
                        borderColor={borderColor}
                        resolvedTheme={resolvedTheme}
                      />
                      <MetricTile
                        label="Compensatory"
                        value={emp?.balances?.ctoHours}
                        unit="Hours"
                        tone="emerald"
                        icon={<Layers size={18} />}
                        borderColor={borderColor}
                        resolvedTheme={resolvedTheme}
                      />
                      {/* ✅ Added Wellness Leave Tile */}
                      <MetricTile
                        label="Wellness Leave"
                        value={emp?.balances?.wellnessDays}
                        unit="Days"
                        tone="amber"
                        icon={<HeartPulse size={18} />}
                        borderColor={borderColor}
                        resolvedTheme={resolvedTheme}
                      />
                    </div>
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card
                      title="Quick Contact"
                      subtitle="Copy or tap to contact"
                      action={<MoreHorizontal size={16} />}
                      borderColor={borderColor}
                    >
                      <div className="space-y-2">
                        <ContactRow
                          icon={<Mail size={16} />}
                          label="Email"
                          value={emp?.email}
                          onCopy={() => copyToClipboard(emp?.email, "Email")}
                          isLink
                          href={emp?.email ? `mailto:${emp.email}` : undefined}
                          borderColor={borderColor}
                        />
                        <ContactRow
                          icon={<Phone size={16} />}
                          label="Phone"
                          value={emp?.phone}
                          onCopy={() => copyToClipboard(emp?.phone, "Phone")}
                          borderColor={borderColor}
                        />
                        <ContactRow
                          icon={<Hash size={16} />}
                          label="Employee ID"
                          value={emp?.employeeId}
                          onCopy={() => copyToClipboard(emp?.employeeId, "ID")}
                          borderColor={borderColor}
                        />
                      </div>
                    </Card>

                    <Card
                      title="Work Status"
                      subtitle="Role, hire date, and status"
                      action={<MoreHorizontal size={16} />}
                      borderColor={borderColor}
                    >
                      <div className="space-y-2">
                        <DataRow label="System Role" borderColor={borderColor}>
                          <RoleBadge role={emp?.role} />
                        </DataRow>

                        <DataRow label="Date Hired" borderColor={borderColor}>
                          <div className="text-right">
                            <div
                              className="font-medium transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-text)" }}
                            >
                              {emp?.dateHired
                                ? formatDate(emp.dateHired, {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "-"}
                            </div>
                            {emp?.dateHired && (
                              <div className="mt-2">
                                <Pill tone="blue" resolvedTheme={resolvedTheme}>
                                  {calculateTenure(emp.dateHired)} tenure
                                </Pill>
                              </div>
                            )}
                          </div>
                        </DataRow>

                        <DataRow
                          label="Employment Status"
                          borderColor={borderColor}
                        >
                          <StatusBadge status={emp?.status} />
                        </DataRow>
                      </div>
                    </Card>
                  </div>
                </>
              )}

              {activeTab === "personal" && (
                <div className="grid grid-cols-1 gap-6">
                  <Card
                    title="Identity & Address"
                    subtitle="Profile and permanent address details"
                    action={<MoreHorizontal size={16} />}
                    borderColor={borderColor}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                      <DataBlock label="Full Name" value={fullName} />
                      <DataBlock
                        label="Email Address"
                        value={emp?.email || "-"}
                      />

                      <div
                        className="md:col-span-2 pt-5 border-t transition-colors duration-300 ease-out"
                        style={{ borderColor }}
                      >
                        <DataBlock
                          label="Permanent Address"
                          icon={
                            <MapPin
                              size={14}
                              style={{ color: "var(--app-muted)" }}
                            />
                          }
                          value={
                            `${emp?.address?.street || ""}${
                              emp?.address?.street ? ", " : ""
                            }${emp?.address?.city || ""}${
                              emp?.address?.city ? ", " : ""
                            }${emp?.address?.province || ""}`.trim() || "-"
                          }
                        />
                      </div>
                    </div>
                  </Card>

                  <Card
                    title="Emergency Contact"
                    subtitle="For urgent situations"
                    action={<MoreHorizontal size={16} />}
                    borderColor={borderColor}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="p-3 rounded-2xl border transition-colors duration-300 ease-out"
                        style={{
                          backgroundColor: "var(--app-surface-2)",
                          color: "var(--app-muted)",
                          borderColor,
                        }}
                      >
                        <ShieldCheck size={22} />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium truncate transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-text)" }}
                        >
                          {emp?.emergencyContact?.name || "Not Set"}
                        </p>
                        <p
                          className="text-xs mt-1 transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          {emp?.emergencyContact?.relation || "-"}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === "job" && (
                <div className="space-y-6">
                  <Card
                    title="Employment Details"
                    subtitle="Division, position, and join date"
                    action={<MoreHorizontal size={16} />}
                    borderColor={borderColor}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                      <DataBlock label="Division" value={emp?.division} />
                      <DataBlock label="Position" value={emp?.position} />

                      <DataBlock
                        label="Employee Type"
                        value={
                          emp?.employeeType === "JO"
                            ? "Job Order"
                            : emp?.employeeType
                        }
                      />

                      <DataBlock
                        label="Employment Status"
                        value={<StatusBadge status={emp?.status} />}
                      />
                      <DataBlock
                        label="Date Joined"
                        value={
                          emp?.dateHired
                            ? formatDate(emp.dateHired, {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "-"
                        }
                      />
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {canResetPassword && (
        <EmployeeResetPassword
          open={resetOpen}
          onClose={() => setResetOpen(false)}
          employee={{
            name: fullName,
            email: emp?.email,
            phone: emp?.phone,
          }}
          borderColor={borderColor}
          resolvedTheme={resolvedTheme}
        />
      )}
    </div>
  );
};

/* =========================
   Subcomponents
========================= */
const TabButton = ({ active, onClick, label, icon, borderColor }) => (
  <button
    type="button"
    onClick={onClick}
    className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm border transition"
    style={
      active
        ? {
            backgroundColor: "var(--accent)",
            color: "#fff",
            borderColor: "var(--accent)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
          }
        : {
            backgroundColor: "var(--app-surface)",
            color: "var(--app-text)",
            borderColor,
          }
    }
  >
    <span
      style={{ color: active ? "rgba(255,255,255,0.9)" : "var(--app-muted)" }}
    >
      {icon}
    </span>
    <span className="font-medium">{label}</span>
  </button>
);

// ✅ Add `unit` prop (defaults to "Days" if not provided)
const MetricTile = ({
  label,
  value,
  unit = "Days",
  tone,
  icon,
  borderColor,
  resolvedTheme,
}) => {
  const num = parseFloat(value || 0);
  const display = Number.isFinite(num)
    ? num % 1 === 0
      ? num
      : num.toFixed(1)
    : 0;

  const pill = toneStyle(tone, resolvedTheme);

  return (
    <div
      className="p-5 rounded-2xl border flex items-center justify-between transition"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor,
        boxShadow: "0 1px 0 rgba(15,23,42,0.04)",
      }}
    >
      <div className="min-w-0">
        <div
          className="text-xs transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          {label}
        </div>
        <div
          className="mt-1 text-2xl font-semibold tracking-tight transition-colors duration-300 ease-out"
          style={{ color: "var(--app-text)" }}
        >
          {display}
        </div>
        <div
          className="text-xs mt-1 transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          {unit}
        </div>
      </div>

      <div className="p-2.5 rounded-xl border" style={pill}>
        {icon}
      </div>
    </div>
  );
};

const ContactRow = ({
  icon,
  label,
  value,
  onCopy,
  isLink,
  href,
  borderColor,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    await onCopy?.();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="flex items-center justify-between gap-3 group">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="p-2 rounded-xl border shrink-0 transition-colors duration-300 ease-out"
          style={{
            backgroundColor: "var(--app-surface-2)",
            color: "var(--app-muted)",
            borderColor,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div
            className="text-xs transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {label}
          </div>
          {isLink && href ? (
            <a
              href={href}
              className="block text-sm font-medium truncate transition-colors duration-200 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {value || "-"}
            </a>
          ) : (
            <div
              className="text-sm font-medium truncate transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              {value || "-"}
            </div>
          )}
        </div>
      </div>

      {value ? (
        <button
          type="button"
          onClick={handleCopy}
          className="p-2 rounded-xl border transition opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          style={{
            borderColor: "transparent",
            color: "var(--app-muted)",
            backgroundColor: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--app-text)";
            e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
            e.currentTarget.style.borderColor = borderColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--app-muted)";
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.borderColor = "transparent";
          }}
          title="Copy"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      ) : (
        <span
          className="text-xs transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          —
        </span>
      )}
    </div>
  );
};

const DataRow = ({ label, children, borderColor }) => (
  <div
    className="flex items-center justify-between gap-4 py-3 border-b last:border-0 transition-colors duration-300 ease-out"
    style={{ borderColor }}
  >
    <span
      className="text-sm transition-colors duration-300 ease-out"
      style={{ color: "var(--app-muted)" }}
    >
      {label}
    </span>
    <div className="shrink-0">{children}</div>
  </div>
);

const DataBlock = ({ label, value, icon }) => (
  <div className="flex flex-col gap-1">
    <span
      className="text-xs flex items-center gap-1 transition-colors duration-300 ease-out"
      style={{ color: "var(--app-muted)" }}
    >
      {icon} {label}
    </span>
    <span
      className="text-sm md:text-base font-medium break-words transition-colors duration-300 ease-out"
      style={{ color: "var(--app-text)" }}
    >
      {value || (
        <span style={{ color: "var(--app-muted)" }}>Not specified</span>
      )}
    </span>
  </div>
);

/* =========================
   States
========================= */
const EmptyState = ({ borderColor, resolvedTheme }) => (
  <div
    className="min-h-screen p-6 flex items-center justify-center transition-colors duration-300 ease-out"
    style={{ backgroundColor: "var(--app-bg)" }}
  >
    <div
      className="w-full max-w-xl text-center p-10 rounded-2xl transition-all duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        border: `1px solid ${borderColor}`,
        backdropFilter: "blur(10px)",
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface-2)",
          borderColor,
          color: "var(--app-muted)",
        }}
      >
        <User size={26} />
      </div>
      <h3
        className="font-semibold text-lg transition-colors duration-300 ease-out"
        style={{ color: "var(--app-text)" }}
      >
        No Profile Selected
      </h3>
      <p
        className="text-sm mt-2 max-w-md mx-auto transition-colors duration-300 ease-out"
        style={{ color: "var(--app-muted)" }}
      >
        Select an employee from the list to view their details here.
      </p>
    </div>
  </div>
);

const ErrorState = ({ onRetry, borderColor, resolvedTheme }) => (
  <div
    className="min-h-screen p-6 flex items-center justify-center transition-colors duration-300 ease-out"
    style={{ backgroundColor: "var(--app-bg)" }}
  >
    <div
      className="w-full max-w-xl p-10 text-center rounded-2xl transition-all duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-surface)",
        border: `1px solid ${borderColor}`,
        backdropFilter: "blur(10px)",
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 border"
        style={toneStyle("rose", resolvedTheme)}
      >
        <AlertCircle size={20} />
      </div>
      <p
        className="font-semibold text-lg transition-colors duration-300 ease-out"
        style={{ color: "var(--app-text)" }}
      >
        Failed to load profile
      </p>
      <p
        className="text-sm mt-2 transition-colors duration-300 ease-out"
        style={{ color: "var(--app-muted)" }}
      >
        Please check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 px-4 py-2.5 rounded-xl text-sm font-medium transition"
        style={{
          backgroundColor: "var(--app-surface)",
          border: `1px solid ${borderColor}`,
          color: "var(--app-text)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--app-surface)";
        }}
      >
        Try Again
      </button>
    </div>
  </div>
);

const EmployeeSkeleton = ({ borderColor, resolvedTheme }) => (
  <div
    className="min-h-screen p-6 md:p-10 animate-pulse transition-colors duration-300 ease-out"
    style={{ backgroundColor: "var(--app-bg)" }}
  >
    <div className="max-w-6xl mx-auto space-y-6">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--app-surface)",
          border: `1px solid ${borderColor}`,
          boxShadow: "0 1px 0 rgba(15,23,42,0.04)",
        }}
      >
        <div
          className="px-4 md:px-6 pt-5 pb-4 border-b"
          style={{ borderColor }}
        >
          <div className="flex gap-4 items-center">
            <div
              className="w-12 h-12 rounded-2xl"
              style={{ backgroundColor: "var(--app-surface-2)" }}
            />
            <div className="flex-1 space-y-2">
              <div
                className="h-6 w-64 rounded-lg"
                style={{ backgroundColor: "var(--app-surface-2)" }}
              />
              <div
                className="h-4 w-40 rounded-lg"
                style={{ backgroundColor: "var(--app-surface-2)" }}
              />
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <div
              className="h-10 w-28 rounded-xl"
              style={{ backgroundColor: "var(--app-surface-2)" }}
            />
            <div
              className="h-10 w-32 rounded-xl"
              style={{ backgroundColor: "var(--app-surface-2)" }}
            />
            <div
              className="h-10 w-28 rounded-xl"
              style={{ backgroundColor: "var(--app-surface-2)" }}
            />
          </div>
        </div>

        <div className="px-4 md:px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              className="h-28 rounded-2xl"
              style={{
                backgroundColor: "var(--app-surface)",
                border: `1px solid ${borderColor}`,
              }}
            />
            <div
              className="h-28 rounded-2xl"
              style={{
                backgroundColor: "var(--app-surface)",
                border: `1px solid ${borderColor}`,
              }}
            />
            <div
              className="h-28 rounded-2xl"
              style={{
                backgroundColor: "var(--app-surface)",
                border: `1px solid ${borderColor}`,
              }}
            />
            <div
              className="h-28 rounded-2xl"
              style={{
                backgroundColor: "var(--app-surface)",
                border: `1px solid ${borderColor}`,
              }}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className="h-64 rounded-2xl"
              style={{
                backgroundColor: "var(--app-surface)",
                border: `1px solid ${borderColor}`,
              }}
            />
            <div
              className="h-64 rounded-2xl"
              style={{
                backgroundColor: "var(--app-surface)",
                border: `1px solid ${borderColor}`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default EmployeeInformation;
