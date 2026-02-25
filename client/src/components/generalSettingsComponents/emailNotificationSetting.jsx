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

/* =========================
   Helpers
========================= */
const getErrMsg = (err, fallback = "Failed") =>
  err?.response?.data?.message || err?.message || fallback;

/* =========================
   UI primitives (match your GeneralSettings style)
========================= */
const Card = ({ children, className = "" }) => (
  <div
    className={[
      "bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);

const InlineError = ({ message }) => {
  if (!message) return null;
  return (
    <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700 font-medium">
      {message}
    </div>
  );
};

const SoftNotice = ({ icon: Icon, tone = "neutral", title, children }) => {
  const tones = {
    amber: {
      wrap: "border-amber-100 bg-amber-50",
      title: "text-amber-900",
      text: "text-amber-800",
      icon: "text-amber-700",
    },
    blue: {
      wrap: "border-blue-100 bg-blue-50",
      title: "text-blue-900",
      text: "text-blue-800",
      icon: "text-blue-700",
    },
    green: {
      wrap: "border-emerald-100 bg-emerald-50",
      title: "text-emerald-900",
      text: "text-emerald-800",
      icon: "text-emerald-700",
    },
    neutral: {
      wrap: "border-gray-200 bg-gray-50",
      title: "text-gray-900",
      text: "text-gray-700",
      icon: "text-gray-700",
    },
  };
  const t = tones[tone] || tones.neutral;

  return (
    <div className={`rounded-xl border ${t.wrap} px-4 py-3 flex gap-3`}>
      <div className="mt-0.5">
        <Icon className={`w-4 h-4 ${t.icon}`} />
      </div>
      <div className="min-w-0">
        {title ? (
          <div className={`text-xs font-semibold ${t.title}`}>{title}</div>
        ) : null}
        <div className={`text-xs leading-relaxed ${t.text}`}>{children}</div>
      </div>
    </div>
  );
};

const PrimaryButton = ({ children, disabled, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={[
      "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2",
      "text-sm font-bold border transition",
      disabled
        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
        : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700",
      className,
    ].join(" ")}
  >
    {children}
  </button>
);

const GhostButton = ({ children, disabled, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={[
      "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2",
      "text-sm font-bold border transition",
      disabled
        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300",
      className,
    ].join(" ")}
  >
    {children}
  </button>
);

/* ✅ Toggle (same behavior as your basis) */
const Toggle = ({ checked, disabled, onChange, label, hint }) => (
  <div className="flex items-start gap-3">
    <div className="min-w-0 flex-1">
      <div className="text-sm font-semibold text-gray-900 break-words">
        {label}
      </div>
      {hint ? (
        <div className="text-xs text-gray-500 mt-0.5 leading-relaxed break-words">
          {hint}
        </div>
      ) : null}
    </div>

    <div className="flex-none shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={[
          "relative inline-flex h-7 w-12 items-center rounded-full transition border",
          "flex-none shrink-0",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          checked
            ? "bg-blue-600 border-blue-600"
            : "bg-gray-100 border-gray-200",
        ].join(" ")}
        aria-pressed={checked}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  </div>
);

const SkeletonBlock = () => (
  <div className="p-4 space-y-3">
    <div className="h-4 w-1/3 bg-gray-100 rounded" />
    <div className="h-10 w-full bg-gray-100 rounded-lg" />
    <div className="h-20 w-full bg-gray-100 rounded-xl" />
    <div className="flex gap-2">
      <div className="h-10 w-32 bg-gray-100 rounded-lg" />
      <div className="h-10 w-32 bg-gray-100 rounded-lg" />
    </div>
  </div>
);

/* =========================
   Settings definition (keys must match backend)
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

  const [inlineError, setInlineError] = useState("");
  const [search, setSearch] = useState("");

  // form state (flags object)
  const [flags, setFlags] = useState(() =>
    Object.fromEntries(ALL_KEYS.map((k) => [k, true])),
  );

  // snapshot for dirty detection
  const [initial, setInitial] = useState(null);

  const settingsQuery = useQuery({
    queryKey: QK,
    queryFn: fetchEmailNotificationSettings,
    staleTime: 1000 * 60 * 5,
  });

  // API returns { ok, data } where data is flags object
  const doc = settingsQuery.data?.data;

  useEffect(() => {
    if (!doc) return;

    // normalize: missing keys default to true
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

      // update only changed keys (backend updates one key per request)
      // sequential (stable logs), you can switch to Promise.all if you prefer
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
    <div className="w-full flex-1 flex h-full flex-col bg-gray-50/50">
      <div className="px-1 w-full mx-auto py-2 pb-2">
        <Breadcrumbs items={[{ label: "SETTINGS", to: "/app/settings" }]} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              Email <span className="font-bold">Notifications</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Toggle system emails for onboarding, approvals, and credit events.
            </p>
          </div>

          <button
            onClick={refetch}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 bg-white border border-gray-200 text-sm font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition disabled:opacity-40"
            type="button"
          >
            <RotateCcw className="w-4 h-4" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main */}
          <div className="lg:col-span-2">
            <Card>
              <div className="px-4 py-3 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-600" />
                  <div className="text-sm font-semibold text-gray-900">
                    Notification switches
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Defaults are ON. Disabling a switch prevents that email from
                  being sent.
                </div>
              </div>

              {settingsQuery.isLoading ? (
                <SkeletonBlock />
              ) : settingsQuery.isError ? (
                <div className="p-4">
                  <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700 font-medium">
                    {getErrMsg(
                      settingsQuery.error,
                      "Failed to load email notification settings",
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Search */}
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                          Find a notification
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Search by name or key (e.g., “approval”, “welcome”,
                          “cto”).
                        </div>
                      </div>
                      <div className="text-[11px] font-medium text-gray-500">
                        {enabledCount} enabled • {disabledCount} disabled
                      </div>
                    </div>

                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search notifications..."
                      className="mt-3 w-full h-11 rounded-lg border px-3 text-sm text-gray-900 outline-none transition bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Groups */}
                  {filteredGroups.map((group) => {
                    const Icon = group.icon || Mail;
                    return (
                      <div
                        key={group.title}
                        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-gray-100 bg-white">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-gray-600" />
                            <div className="text-sm font-semibold text-gray-900">
                              {group.title}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
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
                                  <span className="text-gray-400">
                                    ({it.key})
                                  </span>
                                </>
                              }
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
                  >
                    {disabledCount
                      ? `Some emails are disabled (${disabledCount}). Disabled emails will be skipped by the backend.`
                      : "All email notifications are enabled."}
                  </SoftNotice>

                  <SoftNotice icon={Info} tone="blue" title="Tip">
                    If you add new notification keys later, they’ll appear
                    enabled by default.
                  </SoftNotice>

                  <InlineError message={inlineError} />

                  <div className="pt-1 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                    <div className="text-xs text-gray-500">
                      {isDirty ? (
                        <span className="font-medium text-gray-700">
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
                      >
                        Reset defaults
                      </GhostButton>

                      <PrimaryButton
                        onClick={onSave}
                        disabled={!isDirty || isSaving}
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
            <Card>
              <div className="px-4 py-3 border-b border-gray-100 bg-white">
                <div className="text-sm font-semibold text-gray-900">
                  Summary
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Quick view of enabled/disabled notifications.
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Status
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {disabledCount ? "Partially enabled" : "All enabled"}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {enabledCount} enabled • {disabledCount} disabled
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
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
                            <div className="text-xs font-semibold text-gray-900">
                              {it.label}
                            </div>
                            <div className="text-[11px] text-gray-500 truncate">
                              {it.key}
                            </div>
                          </div>
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold border bg-amber-50 text-amber-700 border-amber-100">
                            OFF
                          </span>
                        </div>
                      ))}
                      {disabledList.length > 6 ? (
                        <div className="text-[11px] text-gray-500">
                          +{disabledList.length - 6} more disabled
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-gray-600">
                      No disabled notifications.
                    </div>
                  )}
                </div>

                <button
                  onClick={refetch}
                  disabled={isRefreshing}
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-40"
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
