// pages/settings/WorkingDaysSettings.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Breadcrumbs from "../breadCrumbs";
import {
  fetchWorkingDaysGeneralSettings,
  updateWorkingDaysGeneralSettings,
} from "../../api/generalSettings";
import {
  RotateCcw,
  Save,
  Info,
  CalendarDays,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../store/authStore";

/* =========================
   Helpers
========================= */
const getErrMsg = (err, fallback = "Failed") =>
  err?.response?.data?.message || err?.message || fallback;

const toInt = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
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
   UI primitives
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

const SoftNotice = ({ icon: Icon, tone = "amber", title, children, theme }) => {
  const t = getNoticeToneStyles(theme, tone);

  return (
    <div
      className="rounded-xl px-4 py-3 flex gap-3 transition-colors duration-300 ease-out"
      style={{
        backgroundColor: t.wrapBg,
        border: `1px solid ${t.wrapBorder}`,
      }}
    >
      <div className="mt-0.5">
        <Icon className="w-4 h-4" style={{ color: t.icon }} />
      </div>
      <div className="min-w-0">
        {title ? (
          <div className="text-xs font-semibold" style={{ color: t.title }}>
            {title}
          </div>
        ) : null}
        <div className="text-xs leading-relaxed" style={{ color: t.text }}>
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
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2",
        "text-sm font-bold transition-colors duration-200 ease-out",
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
}) => {
  const disabledBg =
    theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2",
        "text-sm font-bold transition-colors duration-200 ease-out",
        className,
      ].join(" ")}
      style={{
        backgroundColor: disabled ? disabledBg : "var(--app-surface)",
        color: disabled ? "var(--app-muted)" : "var(--app-text)",
        border: `1px solid ${borderColor}`,
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
        {hint ? (
          <div
            className="text-xs mt-0.5 leading-relaxed break-words transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            {hint}
          </div>
        ) : null}
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

const SkeletonBlock = ({ theme }) => (
  <div className="p-4 space-y-3">
    <SkeletonLine width="33%" height={16} theme={theme} />
    <SkeletonLine width="100%" height={40} theme={theme} />
    <SkeletonLine width="100%" height={80} theme={theme} />
    <div className="flex gap-2">
      <SkeletonLine width={128} height={40} theme={theme} />
      <SkeletonLine width={128} height={40} theme={theme} />
    </div>
  </div>
);

/* =========================
   Main Page
========================= */
const QK = ["workingDaysSettings"];

const presets = [
  { label: "4 days", value: 4 },
  { label: "5 days", value: 5 },
  { label: "6 days", value: 6 },
  { label: "7 days", value: 7 },
];

export default function WorkingDaysSettings() {
  const queryClient = useQueryClient();

  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const subtleBg = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.03)"
      : "rgba(15,23,42,0.03)";
  }, [resolvedTheme]);

  const disabledBg = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.05)"
      : "rgba(15,23,42,0.04)";
  }, [resolvedTheme]);

  const [inlineError, setInlineError] = useState("");

  // form state
  const [workingDaysEnable, setWorkingDaysEnable] = useState(true);
  const [workingDaysValue, setWorkingDaysValue] = useState(5);

  // initial snapshot for dirty detection
  const [initial, setInitial] = useState(null);

  const settingsQuery = useQuery({
    queryKey: QK,
    queryFn: fetchWorkingDaysGeneralSettings,
    staleTime: 1000 * 60 * 5,
  });

  // API returns { ok, data } → settings inside .data
  const doc = settingsQuery.data?.data;

  useEffect(() => {
    if (!doc) return;

    const enabled = Boolean(doc.workingDaysEnable);
    const days = clamp(toInt(doc.workingDaysValue, 5), 1, 7);

    setWorkingDaysEnable(enabled);
    setWorkingDaysValue(days);

    setInitial({
      workingDaysEnable: enabled,
      workingDaysValue: days,
    });
  }, [doc]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    return (
      initial.workingDaysEnable !== workingDaysEnable ||
      initial.workingDaysValue !== workingDaysValue
    );
  }, [initial, workingDaysEnable, workingDaysValue]);

  const refetch = useCallback(async () => {
    setInlineError("");
    await settingsQuery.refetch();
    toast.info("Settings refreshed");
  }, [settingsQuery]);

  const saveMutation = useMutation({
    mutationFn: (payload) => updateWorkingDaysGeneralSettings(payload),
    onSuccess: async () => {
      setInlineError("");
      toast.success("Settings saved");
      await queryClient.invalidateQueries({ queryKey: QK });
      setInitial({
        workingDaysEnable,
        workingDaysValue,
      });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to save settings");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const onSave = () => {
    setInlineError("");

    const days = clamp(toInt(workingDaysValue, NaN), 1, 7);
    if (!Number.isFinite(days)) {
      const msg = "Working days must be a valid number.";
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    saveMutation.mutate({
      workingDaysEnable: Boolean(workingDaysEnable),
      workingDaysValue: days,
    });
  };

  const onResetToDefault = () => {
    setInlineError("");
    setWorkingDaysEnable(true);
    setWorkingDaysValue(5);
    toast.info("Default values applied (not saved yet)");
  };

  const effectiveText = useMemo(() => {
    if (!workingDaysEnable) return "Working-days rules are disabled.";
    return `System assumes a ${workingDaysValue}-day work week.`;
  }, [workingDaysEnable, workingDaysValue]);

  const isRefreshing = settingsQuery.isRefetching;
  const isSaving = saveMutation.isPending;

  return (
    <div
      className="w-full flex-1 flex h-full flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <div className="px-1 w-full mx-auto py-2 pb-2">
        <Breadcrumbs items={[{ label: "SETTINGS", to: "/app/settings" }]} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              Lead Working <span className="font-bold">Days</span>
            </h1>
            <p
              className="text-sm mt-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Configure your organization’s default work-week settings.
            </p>
          </div>

          <button
            onClick={refetch}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-colors duration-200 ease-out disabled:opacity-40"
            style={{
              backgroundColor: "var(--app-surface)",
              border: `1px solid ${borderColor}`,
              color: "var(--accent)",
            }}
            type="button"
          >
            <RotateCcw className="w-4 h-4" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main card */}
          <div className="lg:col-span-2">
            <Card borderColor={borderColor}>
              <div
                className="px-4 py-3 border-b transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: borderColor,
                }}
              >
                <div className="flex items-center gap-2">
                  <CalendarDays
                    className="w-4 h-4"
                    style={{ color: "var(--app-muted)" }}
                  />
                  <div
                    className="text-sm font-semibold transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    Work-week policy
                  </div>
                </div>
                <div
                  className="text-xs mt-1 transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Defines the number of working days used for calculations and
                  defaults throughout the system.
                </div>
              </div>

              {settingsQuery.isLoading ? (
                <SkeletonBlock theme={resolvedTheme} />
              ) : settingsQuery.isError ? (
                <div className="p-4">
                  <div
                    className="rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: getErrorStyles(resolvedTheme).wrapBg,
                      border: `1px solid ${
                        getErrorStyles(resolvedTheme).wrapBorder
                      }`,
                      color: getErrorStyles(resolvedTheme).wrapText,
                    }}
                  >
                    {getErrMsg(
                      settingsQuery.error,
                      "Failed to load working days settings",
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <Toggle
                    checked={workingDaysEnable}
                    disabled={isSaving}
                    onChange={(v) => setWorkingDaysEnable(v)}
                    label="Enable working days"
                    hint="If disabled, working-day based rules won’t be applied."
                    borderColor={borderColor}
                    theme={resolvedTheme}
                  />

                  <div
                    className="rounded-xl p-2 md:p-4 transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className="text-sm font-semibold transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-text)" }}
                        >
                          Working days per week
                        </div>
                        <div
                          className="text-xs mt-0.5 transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Choose a value from 1–7. Common defaults are 5 or 6.
                        </div>
                      </div>

                      <div
                        className="inline-flex items-center gap-2 rounded-full min-w-16 px-3 py-1.5 text-xs font-medium transition-colors duration-300 ease-out"
                        style={{
                          backgroundColor: subtleBg,
                          border: `1px solid ${borderColor}`,
                          color: "var(--app-text)",
                        }}
                      >
                        {workingDaysValue} day
                        {workingDaysValue === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-center">
                      <div className="flex-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={7}
                          value={workingDaysValue}
                          disabled={isSaving || !workingDaysEnable}
                          onChange={(e) => {
                            const next = toInt(e.target.value, 0);
                            if (!Number.isFinite(next)) return;
                            setWorkingDaysValue(clamp(next, 1, 7));
                          }}
                          className="w-full h-11 rounded-lg px-3 text-sm outline-none transition-colors duration-200 ease-out"
                          style={{
                            backgroundColor:
                              !workingDaysEnable || isSaving
                                ? disabledBg
                                : subtleBg,
                            color:
                              !workingDaysEnable || isSaving
                                ? "var(--app-muted)"
                                : "var(--app-text)",
                            border: `1px solid ${borderColor}`,
                            cursor:
                              !workingDaysEnable || isSaving
                                ? "not-allowed"
                                : "text",
                            opacity: isSaving ? 0.7 : 1,
                          }}
                          placeholder="e.g. 5"
                        />
                        <div
                          className="mt-2 text-[11px] transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Range: 1 to 7 days
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {presets.map((p) => {
                          const isActive = workingDaysValue === p.value;

                          return (
                            <button
                              key={p.value}
                              type="button"
                              disabled={isSaving || !workingDaysEnable}
                              onClick={() => setWorkingDaysValue(p.value)}
                              className="px-3 py-2 rounded-full text-xs font-bold transition-colors duration-200 ease-out"
                              style={{
                                backgroundColor: isActive
                                  ? "var(--accent-soft)"
                                  : "var(--app-surface)",
                                color: isActive
                                  ? "var(--accent)"
                                  : "var(--app-text)",
                                border: `1px solid ${
                                  isActive ? "var(--accent-soft2)" : borderColor
                                }`,
                                opacity:
                                  !workingDaysEnable || isSaving ? 0.5 : 1,
                                cursor:
                                  !workingDaysEnable || isSaving
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <SoftNotice
                    icon={workingDaysEnable ? CheckCircle2 : ShieldAlert}
                    tone={workingDaysEnable ? "green" : "amber"}
                    title="Effective behavior"
                    theme={resolvedTheme}
                  >
                    {effectiveText}
                  </SoftNotice>

                  <SoftNotice
                    icon={Info}
                    tone="blue"
                    title="Note"
                    theme={resolvedTheme}
                  >
                    This setting is often used for credit calculations, SLA
                    expectations, and reporting. Keep it aligned with your HR
                    policy.
                  </SoftNotice>

                  <InlineError message={inlineError} theme={resolvedTheme} />

                  <div className="pt-1 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                    <div
                      className="text-xs transition-colors duration-300 ease-out"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {isDirty ? (
                        <span
                          className="font-medium"
                          style={{ color: "var(--app-text)" }}
                        >
                          You have unsaved changes.
                        </span>
                      ) : (
                        <span>All changes saved.</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <GhostButton
                        onClick={onResetToDefault}
                        disabled={isSaving}
                        borderColor={borderColor}
                        theme={resolvedTheme}
                      >
                        Reset defaults
                      </GhostButton>

                      <PrimaryButton
                        onClick={onSave}
                        disabled={!isDirty || isSaving}
                        borderColor={borderColor}
                        theme={resolvedTheme}
                      >
                        <Save className="w-4 h-4" />
                        {isSaving ? "Saving..." : "Save changes"}
                      </PrimaryButton>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Right rail */}
          <div className="lg:col-span-1">
            <Card borderColor={borderColor}>
              <div
                className="px-4 py-3 border-b transition-colors duration-300 ease-out"
                style={{
                  backgroundColor: "var(--app-surface)",
                  borderColor: borderColor,
                }}
              >
                <div
                  className="text-sm font-semibold transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-text)" }}
                >
                  Summary
                </div>
                <div
                  className="text-xs mt-1 transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Quick view of your current configuration.
                </div>
              </div>

              <div className="p-4 space-y-3">
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
                    Working days
                  </div>
                  <div
                    className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    {workingDaysEnable ? "Enabled" : "Disabled"}
                  </div>
                  <div
                    className="mt-1 text-xs transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {workingDaysEnable
                      ? `${workingDaysValue} day${
                          workingDaysValue === 1 ? "" : "s"
                        } per week`
                      : "Not applied"}
                  </div>
                </div>

                <div
                  className="rounded-xl p-2 md:p-4 transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Limits
                  </div>
                  <div
                    className="mt-2 text-xs leading-relaxed transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    • Minimum: 1 day
                    <br />
                    • Maximum: 7 days
                    <br />
                  </div>
                </div>

                <button
                  onClick={refetch}
                  disabled={isRefreshing}
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-colors duration-200 ease-out disabled:opacity-40"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    border: `1px solid ${borderColor}`,
                    color: "var(--app-text)",
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                  {isRefreshing ? "Refreshing..." : "Reload settings"}
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
