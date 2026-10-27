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
  Briefcase,
  Hourglass,
  Paperclip,
  Calculator, // ✅ Imported Calculator for computation mode
  History,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../store/authStore";
import { getEarliestFilingDate } from "../../utils/lateFilingWindow";

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

// Late filing backdate limits (keep in sync with the backend model)
const BACKDATE_MIN = 0;
const BACKDATE_MAX = 30;
const BACKDATE_DEFAULT = 7;

const formatDate = (date) =>
  date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
   Interaction styles (hover / focus / active / cursor)
   Inline styles set the base colors, so hover overrides need !important.
   Colors come from CSS variables set on the page root (theme-aware).
========================= */
const PAGE_STYLES = `
.wds-btn {
  transition: background-color .15s ease, border-color .15s ease,
    box-shadow .15s ease, transform .1s ease, filter .15s ease;
}
.wds-btn:not(:disabled) { cursor: pointer; }
.wds-btn:disabled { cursor: not-allowed; }
.wds-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--wds-ring); }
.wds-btn:active:not(:disabled) { transform: scale(0.97); }

.wds-primary:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 6px 16px -6px var(--wds-ring);
}

.wds-ghost:hover:not(:disabled) {
  background-color: var(--wds-hover-bg) !important;
  border-color: var(--wds-hover-border) !important;
}

.wds-day:hover:not(:disabled) { transform: translateY(-1px); }
.wds-day[aria-pressed="false"]:hover:not(:disabled) {
  background-color: var(--wds-hover-bg) !important;
  border-color: var(--accent) !important;
}
.wds-day[aria-pressed="true"]:hover:not(:disabled) { filter: brightness(1.1); }
.wds-day:active:not(:disabled) { transform: scale(0.92); }

.wds-toggle:hover:not(:disabled) { box-shadow: 0 0 0 4px var(--wds-hover-bg); }
.wds-toggle:hover:not(:disabled) .wds-knob { box-shadow: 0 1px 4px rgba(0,0,0,.35); }

.wds-toggle-label { cursor: pointer; user-select: none; }
.wds-toggle-label[aria-disabled="true"] { cursor: not-allowed; }
.wds-toggle-label:hover:not([aria-disabled="true"]) .wds-toggle-title { color: var(--accent) !important; }

.wds-input {
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
}
.wds-input:hover:not(:disabled):not(:focus) { border-color: var(--wds-hover-border) !important; }
.wds-input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--wds-ring); }
.wds-select:not(:disabled) { cursor: pointer; }

@media (prefers-reduced-motion: reduce) {
  .wds-btn, .wds-input { transition: none; }
  .wds-btn:active:not(:disabled),
  .wds-day:hover:not(:disabled),
  .wds-day:active:not(:disabled) { transform: none; }
}
`;

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
        "wds-btn wds-primary",
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2",
        "text-sm font-bold",
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
        "wds-btn wds-ghost",
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2",
        "text-sm font-bold",
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

  const flip = () => {
    if (!disabled) onChange?.(!checked);
  };

  return (
    <div className="flex items-start gap-3">
      {/* Clicking the label/hint also flips the switch */}
      <div
        className="wds-toggle-label min-w-0 flex-1"
        onClick={flip}
        aria-disabled={disabled ? "true" : "false"}
      >
        <div
          className="wds-toggle-title text-sm font-semibold break-words transition-colors duration-200 ease-out"
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
          role="switch"
          aria-checked={checked}
          aria-label={label}
          title={checked ? "Click to turn off" : "Click to turn on"}
          disabled={disabled}
          onClick={flip}
          className="wds-btn wds-toggle relative inline-flex h-7 w-12 items-center rounded-full flex-none shrink-0"
          style={{
            backgroundColor: checked ? "var(--accent)" : offBg,
            border: `1px solid ${checked ? "var(--accent)" : borderColor}`,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.55 : 1,
          }}
        >
          <span
            className={[
              "wds-knob inline-block h-5 w-5 transform rounded-full shadow transition",
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

const DAYS_OF_WEEK = [
  { label: "Sun", full: "Sunday", value: 0 },
  { label: "Mon", full: "Monday", value: 1 },
  { label: "Tue", full: "Tuesday", value: 2 },
  { label: "Wed", full: "Wednesday", value: 3 },
  { label: "Thu", full: "Thursday", value: 4 },
  { label: "Fri", full: "Friday", value: 5 },
  { label: "Sat", full: "Saturday", value: 6 },
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
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [activeWorkingDays, setActiveWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [lateFilingAttachmentRequired, setLateFilingAttachmentRequired] =
    useState(false);
  const [computationMode, setComputationMode] = useState("Working Days"); // ✅ Added state
  const [lateFilingBackdateEnabled, setLateFilingBackdateEnabled] =
    useState(false);
  const [lateFilingBackdateDays, setLateFilingBackdateDays] =
    useState(BACKDATE_DEFAULT);

  // initial snapshot for dirty detection
  const [initial, setInitial] = useState(null);

  const settingsQuery = useQuery({
    queryKey: QK,
    queryFn: fetchWorkingDaysGeneralSettings,
    staleTime: 1000 * 60 * 5,
  });

  const doc = settingsQuery.data?.data;

  useEffect(() => {
    if (!doc) return;

    const enabled = Boolean(doc.workingDaysEnable);
    const days = clamp(toInt(doc.workingDaysValue, 5), 1, 7);
    const hpd = clamp(toInt(doc.hoursPerDay, 8), 1, 24);
    const awd = Array.isArray(doc.activeWorkingDays)
      ? doc.activeWorkingDays
      : [1, 2, 3, 4, 5];
    const lateAttachReq = Boolean(doc.lateFilingAttachmentRequired);
    const compMode = doc.computationMode || "Working Days"; // ✅ Fetch computation mode
    const backdateEnabled = Boolean(doc.lateFilingBackdateEnabled);
    const backdateDays = clamp(
      toInt(doc.lateFilingBackdateDays, BACKDATE_DEFAULT),
      BACKDATE_MIN,
      BACKDATE_MAX,
    );

    setWorkingDaysEnable(enabled);
    setWorkingDaysValue(days);
    setHoursPerDay(hpd);
    setActiveWorkingDays(awd);
    setLateFilingAttachmentRequired(lateAttachReq);
    setComputationMode(compMode); // ✅ Set computation mode
    setLateFilingBackdateEnabled(backdateEnabled);
    setLateFilingBackdateDays(backdateDays);

    setInitial({
      workingDaysEnable: enabled,
      workingDaysValue: days,
      hoursPerDay: hpd,
      activeWorkingDays: awd,
      lateFilingAttachmentRequired: lateAttachReq,
      computationMode: compMode, // ✅ Add to initial
      lateFilingBackdateEnabled: backdateEnabled,
      lateFilingBackdateDays: backdateDays,
    });
  }, [doc]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    if (initial.workingDaysEnable !== workingDaysEnable) return true;
    if (initial.workingDaysValue !== workingDaysValue) return true;
    if (initial.hoursPerDay !== hoursPerDay) return true;
    if (initial.lateFilingAttachmentRequired !== lateFilingAttachmentRequired)
      return true;
    if (initial.computationMode !== computationMode) return true; // ✅ Dirty check for computation mode
    if (initial.lateFilingBackdateEnabled !== lateFilingBackdateEnabled)
      return true;
    if (initial.lateFilingBackdateDays !== lateFilingBackdateDays) return true;

    // Different number of days selected means it changed
    if (initial.activeWorkingDays.length !== activeWorkingDays.length)
      return true;

    const sortedInitial = [...initial.activeWorkingDays].sort();
    const sortedCurrent = [...activeWorkingDays].sort();
    return sortedInitial.some((v, i) => v !== sortedCurrent[i]);
  }, [
    initial,
    workingDaysEnable,
    workingDaysValue,
    hoursPerDay,
    activeWorkingDays,
    lateFilingAttachmentRequired,
    computationMode, // ✅ Dependency added
    lateFilingBackdateEnabled,
    lateFilingBackdateDays,
  ]);

  // Live preview: earliest date an employee could file for today with the
  // settings currently on screen (same logic the CTO form and backend use).
  const unit = computationMode === "Calendar Days" ? "calendar" : "working";
  const earliestFilingDate = useMemo(
    () =>
      getEarliestFilingDate({
        lateFilingBackdateEnabled,
        lateFilingBackdateDays,
        computationMode,
        activeWorkingDays,
      }),
    [
      lateFilingBackdateEnabled,
      lateFilingBackdateDays,
      computationMode,
      activeWorkingDays,
    ],
  );
  const backdateActive =
    lateFilingBackdateEnabled && lateFilingBackdateDays > 0;

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
      // Invalidating the public cache too so CTO forms see the change immediately
      await queryClient.invalidateQueries({
        queryKey: ["workingDaysSettings"],
      });

      setInitial({
        workingDaysEnable,
        workingDaysValue,
        hoursPerDay,
        activeWorkingDays,
        lateFilingAttachmentRequired,
        computationMode, // ✅ Save new initial
        lateFilingBackdateEnabled,
        lateFilingBackdateDays,
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

    if (activeWorkingDays.length === 0) {
      const msg = "You must select at least one active working day.";
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    const hpd = clamp(toInt(hoursPerDay, NaN), 1, 24);
    if (!Number.isFinite(hpd)) {
      const msg = "Hours per day must be between 1 and 24.";
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    const days = clamp(toInt(workingDaysValue, NaN), 1, 7);
    if (!Number.isFinite(days)) {
      const msg = "Lead time value must be between 1 and 7 days.";
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    const backdateDays = clamp(
      toInt(lateFilingBackdateDays, NaN),
      BACKDATE_MIN,
      BACKDATE_MAX,
    );
    if (!Number.isFinite(backdateDays)) {
      const msg = `Backdate days must be between ${BACKDATE_MIN} and ${BACKDATE_MAX}.`;
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    saveMutation.mutate({
      workingDaysEnable: Boolean(workingDaysEnable),
      workingDaysValue: days,
      hoursPerDay: hpd,
      activeWorkingDays: activeWorkingDays,
      lateFilingAttachmentRequired: Boolean(lateFilingAttachmentRequired),
      computationMode: computationMode, // ✅ Add to payload
      lateFilingBackdateEnabled: Boolean(lateFilingBackdateEnabled),
      lateFilingBackdateDays: backdateDays,
    });
  };

  const onResetToDefault = () => {
    setInlineError("");
    setWorkingDaysEnable(true);
    setWorkingDaysValue(5);
    setHoursPerDay(8);
    setActiveWorkingDays([1, 2, 3, 4, 5]);
    setLateFilingAttachmentRequired(false);
    setComputationMode("Working Days"); // ✅ Reset to default
    setLateFilingBackdateEnabled(false);
    setLateFilingBackdateDays(BACKDATE_DEFAULT);
    toast.info("Default values applied (not saved yet)");
  };

  const toggleWorkingDay = (dayValue) => {
    setActiveWorkingDays((prev) =>
      prev.includes(dayValue)
        ? prev.filter((d) => d !== dayValue)
        : [...prev, dayValue].sort(),
    );
  };

  const isRefreshing = settingsQuery.isRefetching;
  const isSaving = saveMutation.isPending;

  return (
    <div
      className="w-full flex-1 flex h-full flex-col transition-colors duration-300 ease-out"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
        // Theme-aware colors used by PAGE_STYLES hover/focus rules
        "--wds-hover-bg":
          resolvedTheme === "dark"
            ? "rgba(255,255,255,0.06)"
            : "rgba(15,23,42,0.05)",
        "--wds-hover-border":
          resolvedTheme === "dark"
            ? "rgba(255,255,255,0.18)"
            : "rgba(15,23,42,0.22)",
        "--wds-ring": "color-mix(in srgb, var(--accent) 35%, transparent)",
      }}
    >
      <style>{PAGE_STYLES}</style>
      <div className="px-1 w-full mx-auto py-2 pb-2">
        <Breadcrumbs items={[{ label: "SETTINGS", to: "/app/settings" }]} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              Work Schedule <span className="font-bold">Settings</span>
            </h1>
            <p
              className="text-sm mt-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Configure your organization’s default work-week and leave request
              lead time.
            </p>
          </div>

          <button
            onClick={refetch}
            disabled={isRefreshing}
            title="Reload settings from the server"
            className="wds-btn wds-ghost inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold disabled:opacity-40"
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
                    Work Schedule & Lead Time
                  </div>
                </div>
                <div
                  className="text-xs mt-1 transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Defines the standard schedule and lead time required for
                  applications.
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
                <div className="p-4 space-y-6">
                  {/* Hours & Schedule Section */}
                  <div className="space-y-4">
                    <h3
                      className="text-sm font-bold flex items-center gap-2"
                      style={{ color: "var(--app-text)" }}
                    >
                      <Briefcase className="w-4 h-4" /> Work Schedule
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Hours Per Day */}
                      <div
                        className="rounded-xl p-4 transition-colors duration-300 ease-out"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          border: `1px solid ${borderColor}`,
                        }}
                      >
                        <div
                          className="text-sm font-semibold transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-text)" }}
                        >
                          Hours per Day
                        </div>
                        <div
                          className="text-[11px] mt-1 mb-3 transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Standard hours in a single workday.
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={hoursPerDay}
                          disabled={isSaving}
                          onChange={(e) => {
                            const next = toInt(e.target.value, 0);
                            if (!Number.isFinite(next)) return;
                            setHoursPerDay(clamp(next, 1, 24));
                          }}
                          className="wds-input w-full h-11 rounded-lg px-3 text-sm outline-none"
                          style={{
                            backgroundColor: isSaving ? disabledBg : subtleBg,
                            color: isSaving
                              ? "var(--app-muted)"
                              : "var(--app-text)",
                            border: `1px solid ${borderColor}`,
                            cursor: isSaving ? "not-allowed" : "text",
                          }}
                        />
                      </div>

                      {/* Active Working Days */}
                      <div
                        className="rounded-xl p-4 transition-colors duration-300 ease-out"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          border: `1px solid ${borderColor}`,
                        }}
                      >
                        <div
                          className="text-sm font-semibold transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-text)" }}
                        >
                          Active Working Days
                        </div>
                        <div
                          className="text-[11px] mt-1 mb-3 transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Select the days of the week employees work.
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {DAYS_OF_WEEK.map((day) => {
                            const isSelected = activeWorkingDays.includes(
                              day.value,
                            );
                            return (
                              <button
                                key={day.value}
                                type="button"
                                disabled={isSaving}
                                onClick={() => toggleWorkingDay(day.value)}
                                aria-pressed={isSelected}
                                aria-label={day.full}
                                title={`${day.full} — ${
                                  isSelected
                                    ? "working day (click to remove)"
                                    : "day off (click to add)"
                                }`}
                                className="wds-btn wds-day w-10 h-10 rounded-full text-xs font-bold flex items-center justify-center"
                                style={{
                                  cursor: isSaving ? "not-allowed" : "pointer",
                                  backgroundColor: isSelected
                                    ? "var(--accent)"
                                    : "var(--app-surface)",
                                  color: isSelected
                                    ? "#ffffff"
                                    : "var(--app-text)",
                                  border: `1px solid ${
                                    isSelected ? "var(--accent)" : borderColor
                                  }`,
                                  opacity: isSaving ? 0.6 : 1,
                                }}
                              >
                                {day.label[0]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr style={{ borderColor: borderColor }} />

                  {/* ✅ NEW: Computation Settings Section */}
                  <div className="space-y-4">
                    <h3
                      className="text-sm font-bold flex items-center gap-2"
                      style={{ color: "var(--app-text)" }}
                    >
                      <Calculator className="w-4 h-4" /> Computation Settings
                    </h3>

                    <div
                      className="rounded-xl p-4 transition-colors duration-300 ease-out"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1">
                          <div
                            className="text-sm font-semibold transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-text)" }}
                          >
                            Leave Computation Mode
                          </div>
                          <div
                            className="text-[11px] mt-1 transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Determines if weekends are skipped (Working Days) or
                            counted (Calendar Days) during CTO/Leave
                            applications.
                          </div>
                        </div>

                        <div className="w-full sm:w-48">
                          <select
                            value={computationMode}
                            disabled={isSaving}
                            onChange={(e) => setComputationMode(e.target.value)}
                            className="wds-input wds-select w-full h-11 rounded-lg px-3 text-sm outline-none"
                            style={{
                              backgroundColor: isSaving ? disabledBg : subtleBg,
                              color: isSaving
                                ? "var(--app-muted)"
                                : "var(--app-text)",
                              border: `1px solid ${borderColor}`,
                              cursor: isSaving ? "not-allowed" : "pointer",
                            }}
                          >
                            <option value="Working Days">Working Days</option>
                            <option value="Calendar Days">Calendar Days</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr style={{ borderColor: borderColor }} />

                  {/* Lead Time Section */}
                  <div className="space-y-4">
                    <h3
                      className="text-sm font-bold flex items-center gap-2"
                      style={{ color: "var(--app-text)" }}
                    >
                      <Hourglass className="w-4 h-4" /> Request Lead Time
                    </h3>

                    <Toggle
                      checked={workingDaysEnable}
                      disabled={isSaving}
                      onChange={(v) => setWorkingDaysEnable(v)}
                      label="Enforce Application Lead Time"
                      hint="If enabled, employees must apply for leaves X working days in advance."
                      borderColor={borderColor}
                      theme={resolvedTheme}
                    />

                    <div
                      className="rounded-xl p-4 transition-colors duration-300 ease-out"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1">
                          <div
                            className="text-sm font-semibold transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-text)" }}
                          >
                            Minimum Working Days Notice
                          </div>
                          <div
                            className="text-[11px] mt-1 transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-muted)" }}
                          >
                            Number of active work days before the leave start
                            date.
                          </div>
                        </div>

                        <div className="w-full sm:w-32">
                          <input
                            type="number"
                            min={1}
                            max={7}
                            value={workingDaysValue}
                            disabled={isSaving || !workingDaysEnable}
                            onChange={(e) => {
                              const next = toInt(e.target.value, 0);
                              if (!Number.isFinite(next)) return;
                              setWorkingDaysValue(clamp(next, 1, 7));
                            }}
                            className="wds-input w-full h-11 rounded-lg px-3 text-sm outline-none"
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
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr style={{ borderColor: borderColor }} />

                  {/* Late Filing Section */}
                  <div className="space-y-4">
                    <h3
                      className="text-sm font-bold flex items-center gap-2"
                      style={{ color: "var(--app-text)" }}
                    >
                      <Paperclip className="w-4 h-4" /> Late Filing Settings
                    </h3>

                    <Toggle
                      checked={lateFilingAttachmentRequired}
                      disabled={isSaving}
                      onChange={(v) => setLateFilingAttachmentRequired(v)}
                      label="Require Attachment for Late Filing"
                      hint="If enabled, employees must upload a supporting document (like a medical cert or explanation memo) when filing leaves on short notice."
                      borderColor={borderColor}
                      theme={resolvedTheme}
                    />

                    <Toggle
                      checked={lateFilingBackdateEnabled}
                      disabled={isSaving}
                      onChange={(v) => setLateFilingBackdateEnabled(v)}
                      label="Allow Backdated Late Filing"
                      hint="If enabled, employees can file for past dates within the window below. Backdated applications always require a late filing justification."
                      borderColor={borderColor}
                      theme={resolvedTheme}
                    />

                    <div
                      className="rounded-xl p-4 transition-colors duration-300 ease-out"
                      style={{
                        backgroundColor: "var(--app-surface)",
                        border: `1px solid ${borderColor}`,
                        opacity: lateFilingBackdateEnabled ? 1 : 0.7,
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1">
                          <div
                            className="text-sm font-semibold transition-colors duration-300 ease-out flex items-center gap-2"
                            style={{ color: "var(--app-text)" }}
                          >
                            <History
                              className="w-4 h-4"
                              style={{ color: "var(--app-muted)" }}
                            />
                            Maximum Backdate
                          </div>
                          <div
                            className="text-[11px] mt-1 transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-muted)" }}
                          >
                            How many {unit} days before today an employee can
                            still file for ({BACKDATE_MIN}–{BACKDATE_MAX}).
                            Follows the Leave Computation Mode above.
                          </div>
                        </div>

                        <div className="w-full sm:w-32">
                          <input
                            type="number"
                            min={BACKDATE_MIN}
                            max={BACKDATE_MAX}
                            value={lateFilingBackdateDays}
                            disabled={isSaving || !lateFilingBackdateEnabled}
                            onChange={(e) => {
                              const next = toInt(e.target.value, 0);
                              if (!Number.isFinite(next)) return;
                              setLateFilingBackdateDays(
                                clamp(next, BACKDATE_MIN, BACKDATE_MAX),
                              );
                            }}
                            className="wds-input w-full h-11 rounded-lg px-3 text-sm outline-none"
                            style={{
                              backgroundColor:
                                !lateFilingBackdateEnabled || isSaving
                                  ? disabledBg
                                  : subtleBg,
                              color:
                                !lateFilingBackdateEnabled || isSaving
                                  ? "var(--app-muted)"
                                  : "var(--app-text)",
                              border: `1px solid ${borderColor}`,
                              cursor:
                                !lateFilingBackdateEnabled || isSaving
                                  ? "not-allowed"
                                  : "text",
                            }}
                          />
                        </div>
                      </div>

                      <div
                        className="mt-3 rounded-lg px-3 py-2 text-xs flex flex-wrap items-center gap-x-2 gap-y-1 transition-colors duration-300 ease-out"
                        style={{
                          backgroundColor: subtleBg,
                          border: `1px dashed ${borderColor}`,
                          color: "var(--app-muted)",
                        }}
                      >
                        <span>Earliest date employees can file for today:</span>
                        <span
                          className="font-semibold"
                          style={{ color: "var(--app-text)" }}
                        >
                          {formatDate(earliestFilingDate)}
                        </span>
                        {!backdateActive ? (
                          <span>(today and future dates only)</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <SoftNotice
                    icon={workingDaysEnable ? CheckCircle2 : ShieldAlert}
                    tone={workingDaysEnable ? "green" : "amber"}
                    title="Effective behavior"
                    theme={resolvedTheme}
                  >
                    {workingDaysEnable
                      ? `Employees are required to file applications at least ${workingDaysValue} working days in advance.`
                      : "Working-days rules are disabled."}{" "}
                    {backdateActive
                      ? `Late filing is allowed for dates up to ${lateFilingBackdateDays} ${unit} day(s) back (earliest: ${formatDate(earliestFilingDate)}).`
                      : "Past dates cannot be filed."}
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

                  <div
                    className="pt-1 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between border-t mt-4 pt-4"
                    style={{ borderColor: borderColor }}
                  >
                    <div
                      className="text-xs transition-colors duration-300 ease-out"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {isDirty ? (
                        <span
                          className="font-medium"
                          style={{ color: "var(--app-text)" }}
                        >
                          You have unsaved schedule changes.
                        </span>
                      ) : (
                        <span>Schedule settings up to date.</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <GhostButton
                        onClick={onResetToDefault}
                        disabled={isSaving}
                        borderColor={borderColor}
                        theme={resolvedTheme}
                      >
                        Reset
                      </GhostButton>

                      <PrimaryButton
                        onClick={onSave}
                        disabled={!isDirty || isSaving}
                        borderColor={borderColor}
                        theme={resolvedTheme}
                      >
                        <Save className="w-4 h-4" />
                        {isSaving ? "Saving..." : "Save Schedule"}
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
                {/* Schedule Summary */}
                <div
                  className="rounded-xl p-4 transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: subtleBg,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out flex items-center gap-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    <Briefcase className="w-3 h-3" /> Schedule
                  </div>
                  <div
                    className="mt-2 text-sm font-semibold transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    {hoursPerDay} Hrs / Day
                  </div>
                  <div
                    className="mt-1 text-xs transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {activeWorkingDays.length} active working days.
                  </div>
                </div>

                {/* ✅ NEW: Computation Mode Summary */}
                <div
                  className="rounded-xl p-4 transition-colors duration-300 ease-out mt-3"
                  style={{
                    backgroundColor: subtleBg,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out flex items-center gap-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    <Calculator className="w-3 h-3" /> Computation
                  </div>
                  <div
                    className="mt-2 text-sm font-semibold transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    {computationMode}
                  </div>
                  <div
                    className="mt-1 text-xs transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {computationMode === "Working Days"
                      ? "Weekends are excluded."
                      : "Weekends are included."}
                  </div>
                </div>

                {/* Lead Time Summary */}
                <div
                  className="rounded-xl p-4 transition-colors duration-300 ease-out mt-3"
                  style={{
                    backgroundColor: subtleBg,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out flex items-center gap-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    <Hourglass className="w-3 h-3" /> Lead Time
                  </div>
                  <div
                    className="mt-2 text-sm font-semibold transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    {workingDaysEnable ? "Enforced" : "Disabled"}
                  </div>
                  <div
                    className="mt-1 text-xs transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {workingDaysEnable
                      ? `${workingDaysValue} working days prior to leave.`
                      : "No advance notice required."}
                  </div>
                </div>

                {/* Late Filing Summary */}
                <div
                  className="rounded-xl p-4 transition-colors duration-300 ease-out mt-3"
                  style={{
                    backgroundColor: subtleBg,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out flex items-center gap-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    <Paperclip className="w-3 h-3" /> Late Filing
                  </div>
                  <div
                    className="mt-2 text-sm font-semibold transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    {lateFilingAttachmentRequired
                      ? "Attachment Required"
                      : "Attachment Optional"}
                  </div>
                  <div
                    className="mt-1 text-xs transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {backdateActive
                      ? `Backdating up to ${lateFilingBackdateDays} ${unit} day(s).`
                      : "No backdating — today and future dates only."}
                  </div>
                </div>

                <button
                  onClick={refetch}
                  disabled={isRefreshing}
                  type="button"
                  title="Reload settings from the server"
                  className="wds-btn wds-ghost w-full mt-2 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold disabled:opacity-40"
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
