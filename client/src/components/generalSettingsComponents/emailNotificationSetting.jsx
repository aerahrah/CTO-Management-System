// pages/settings/EmailNotificationSettings.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Breadcrumbs from "../breadCrumbs";
import {
  fetchEmailNotificationSettings,
  updateEmailNotificationSetting,
} from "../../api/emailNotificationSettings";
import {
  RotateCcw,
  Save,
  Mail,
  Bell,
  CheckCircle2,
  ShieldAlert,
  Info,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../store/authStore";

/* =========================
   Helpers
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
   Settings definition
========================= */
const GROUPS = [
  {
    title: "Employee",
    icon: Mail,
    description:
      "Automations sent to employees during onboarding and account lifecycle.",
    items: [
      {
        key: "employee_welcome",
        label: "Welcome email",
        hint: "Sent when HR/Admin creates a new employee account.",
      },
    ],
  },
  {
    title: "CTO Applications",
    icon: Bell,
    description: "Notifications for CTO request approvals and outcomes.",
    items: [
      {
        key: "cto_approval",
        label: "Approval request",
        hint: "Sent to the next approver when an approval step is pending.",
      },
      {
        key: "cto_final_approval",
        label: "Final approval",
        hint: "Sent to the employee after the final approval is completed.",
      },
      {
        key: "cto_rejection",
        label: "Rejection",
        hint: "Sent to the employee when an approver rejects the request.",
      },
    ],
  },
  {
    title: "CTO Credits",
    icon: Sparkles,
    description: "Notifications for credit changes and adjustments.",
    items: [
      {
        key: "cto_credit_added",
        label: "Credit added",
        hint: "Sent when new CTO credits are added for an employee.",
      },
      {
        key: "cto_credit_rolled_back",
        label: "Credit rolled back",
        hint: "Sent when CTO credit changes are reverted/rolled back.",
      },
    ],
  },
];

const ALL_KEYS = GROUPS.flatMap((g) => g.items.map((i) => i.key));

/* =========================
   Main Page
========================= */
const QK = ["emailNotificationSettings"];

export default function EmailNotificationSettings() {
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

  const inputBg = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.04)"
      : "rgba(15,23,42,0.03)";
  }, [resolvedTheme]);

  const [inlineError, setInlineError] = useState("");
  const [search, setSearch] = useState("");

  const [flags, setFlags] = useState(() =>
    Object.fromEntries(ALL_KEYS.map((k) => [k, true])),
  );

  const [initial, setInitial] = useState(null);

  const settingsQuery = useQuery({
    queryKey: QK,
    queryFn: fetchEmailNotificationSettings,
    staleTime: 1000 * 60 * 5,
  });

  const doc = settingsQuery.data?.data;

  useEffect(() => {
    if (!doc) return;

    const normalized = Object.fromEntries(
      ALL_KEYS.map((k) => [k, typeof doc?.[k] === "boolean" ? doc[k] : true]),
    );

    setFlags(normalized);
    setInitial(normalized);
  }, [doc]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    return ALL_KEYS.some((k) => Boolean(initial[k]) !== Boolean(flags[k]));
  }, [initial, flags]);

  const isRefreshing = settingsQuery.isRefetching;

  const refetch = useCallback(async () => {
    setInlineError("");
    await settingsQuery.refetch();
    toast.info("Settings refreshed");
  }, [settingsQuery]);

  const filteredGroups = useMemo(() => {
    const q = String(search || "")
      .trim()
      .toLowerCase();
    if (!q) return GROUPS;

    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        const hay = `${it.key} ${it.label} ${it.hint || ""}`.toLowerCase();
        return hay.includes(q);
      }),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  const changedKeys = useMemo(() => {
    if (!initial) return [];
    return ALL_KEYS.filter((k) => Boolean(initial[k]) !== Boolean(flags[k]));
  }, [initial, flags]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!initial) return;

      const diffs = changedKeys;
      if (!diffs.length) return;

      for (const key of diffs) {
        await updateEmailNotificationSetting(key, Boolean(flags[key]));
      }
    },
    onSuccess: async () => {
      setInlineError("");
      toast.success("Email notification settings saved");
      await queryClient.invalidateQueries({ queryKey: QK });
      setInitial({ ...flags });
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to save email notification settings");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const isSaving = saveMutation.isPending;

  const onSave = () => {
    setInlineError("");
    if (!changedKeys.length) {
      toast.info("No changes to save");
      return;
    }
    saveMutation.mutate();
  };

  const onResetToDefault = () => {
    setInlineError("");
    setFlags(Object.fromEntries(ALL_KEYS.map((k) => [k, true])));
    toast.info("Default values applied (not saved yet)");
  };

  const setOne = (key, value) => {
    setFlags((prev) => ({ ...prev, [key]: Boolean(value) }));
  };

  const enabledCount = useMemo(
    () => ALL_KEYS.filter((k) => Boolean(flags[k])).length,
    [flags],
  );

  const disabledCount = ALL_KEYS.length - enabledCount;

  const disabledList = useMemo(() => {
    const map = new Map(GROUPS.flatMap((g) => g.items.map((i) => [i.key, i])));
    return ALL_KEYS.filter((k) => !flags[k])
      .map((k) => map.get(k))
      .filter(Boolean);
  }, [flags]);

  const effectiveTone = disabledCount ? "amber" : "green";
  const effectiveIcon = disabledCount ? ShieldAlert : CheckCircle2;

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

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              Email <span className="font-bold">Notifications</span>
            </h1>
            <p
              className="text-sm mt-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Toggle system emails for onboarding, approvals, and credit events.
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
                  <Mail
                    className="w-4 h-4"
                    style={{ color: "var(--app-muted)" }}
                  />
                  <div
                    className="text-sm font-semibold transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    Notification switches
                  </div>
                </div>
                <div
                  className="text-xs mt-1 transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-muted)" }}
                >
                  Defaults are ON. Disabling a switch prevents that email from
                  being sent.
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
                      "Failed to load email notification settings",
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <div
                    className="rounded-xl p-3 transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: "var(--app-surface)",
                      border: `1px solid ${borderColor}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className="text-sm font-semibold transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-text)" }}
                        >
                          Find a notification
                        </div>
                        <div
                          className="text-xs mt-0.5 transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          Search by name or key (e.g., “approval”, “welcome”,
                          “cto”).
                        </div>
                      </div>
                      <div
                        className="text-[11px] font-medium transition-colors duration-300 ease-out"
                        style={{ color: "var(--app-muted)" }}
                      >
                        {enabledCount} enabled • {disabledCount} disabled
                      </div>
                    </div>

                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search notifications..."
                      className="mt-3 w-full h-11 rounded-lg px-3 text-sm outline-none transition-colors duration-200 ease-out"
                      style={{
                        backgroundColor: inputBg,
                        border: `1px solid ${borderColor}`,
                        color: "var(--app-text)",
                      }}
                    />
                  </div>

                  {filteredGroups.map((group) => {
                    const Icon = group.icon || Mail;
                    return (
                      <div
                        key={group.title}
                        className="rounded-xl overflow-hidden transition-colors duration-300 ease-out"
                        style={{
                          backgroundColor: "var(--app-surface)",
                          border: `1px solid ${borderColor}`,
                        }}
                      >
                        <div
                          className="px-4 py-3 border-b transition-colors duration-300 ease-out"
                          style={{
                            backgroundColor: "var(--app-surface)",
                            borderColor: borderColor,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Icon
                              className="w-4 h-4"
                              style={{ color: "var(--app-muted)" }}
                            />
                            <div
                              className="text-sm font-semibold transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-text)" }}
                            >
                              {group.title}
                            </div>
                          </div>
                          <div
                            className="text-xs mt-1 transition-colors duration-300 ease-out"
                            style={{ color: "var(--app-muted)" }}
                          >
                            {group.description}
                          </div>
                        </div>

                        <div className="p-4 space-y-4">
                          {group.items.map((it) => (
                            <Toggle
                              key={it.key}
                              checked={Boolean(flags[it.key])}
                              disabled={isSaving}
                              onChange={(v) => setOne(it.key, v)}
                              label={it.label}
                              hint={
                                <>
                                  {it.hint}{" "}
                                  <span style={{ color: "var(--app-muted)" }}>
                                    ({it.key})
                                  </span>
                                </>
                              }
                              borderColor={borderColor}
                              theme={resolvedTheme}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <SoftNotice
                    icon={effectiveIcon}
                    tone={effectiveTone}
                    title="Effective behavior"
                    theme={resolvedTheme}
                  >
                    {disabledCount
                      ? `Some emails are disabled (${disabledCount}). Disabled emails will be skipped by the backend.`
                      : "All email notifications are enabled."}
                  </SoftNotice>

                  <SoftNotice
                    icon={Info}
                    tone="blue"
                    title="Tip"
                    theme={resolvedTheme}
                  >
                    If you add new notification keys later, they’ll appear
                    enabled by default.
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
                          You have unsaved changes ({changedKeys.length}).
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
                  Quick view of enabled/disabled notifications.
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
                    Status
                  </div>
                  <div
                    className="mt-1 text-sm font-semibold transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    {disabledCount ? "Partially enabled" : "All enabled"}
                  </div>
                  <div
                    className="mt-1 text-xs transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {enabledCount} enabled • {disabledCount} disabled
                  </div>
                </div>

                <div
                  className="rounded-xl p-4 transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Disabled
                  </div>

                  {disabledList.length ? (
                    <div className="mt-2 space-y-2">
                      {disabledList.slice(0, 6).map((it) => (
                        <div
                          key={it.key}
                          className="flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div
                              className="text-xs font-semibold transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-text)" }}
                            >
                              {it.label}
                            </div>
                            <div
                              className="text-[11px] truncate transition-colors duration-300 ease-out"
                              style={{ color: "var(--app-muted)" }}
                            >
                              {it.key}
                            </div>
                          </div>
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors duration-300 ease-out"
                            style={{
                              backgroundColor:
                                resolvedTheme === "dark"
                                  ? "rgba(245,158,11,0.12)"
                                  : "rgba(245,158,11,0.08)",
                              color:
                                resolvedTheme === "dark"
                                  ? "#fcd34d"
                                  : "#b45309",
                              border: `1px solid ${
                                resolvedTheme === "dark"
                                  ? "rgba(245,158,11,0.20)"
                                  : "rgba(245,158,11,0.16)"
                              }`,
                            }}
                          >
                            OFF
                          </span>
                        </div>
                      ))}
                      {disabledList.length > 6 ? (
                        <div
                          className="text-[11px] transition-colors duration-300 ease-out"
                          style={{ color: "var(--app-muted)" }}
                        >
                          +{disabledList.length - 6} more disabled
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div
                      className="mt-2 text-xs transition-colors duration-300 ease-out"
                      style={{ color: "var(--app-text)" }}
                    >
                      No disabled notifications.
                    </div>
                  )}
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
