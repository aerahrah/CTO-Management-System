// pages/settings/GeneralSettings.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Breadcrumbs from "../breadCrumbs";
import {
  fetchGeneralSettings,
  updateGeneralSettings,
} from "../../api/generalSettings";
import {
  RotateCcw,
  Save,
  ShieldAlert,
  Clock,
  Zap,
  Info,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-toastify";

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

const formatDuration = (minutes) => {
  const m = toInt(minutes, 0);
  if (!m) return "-";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const hours = m / 60;
  if (hours < 24) {
    const h = Math.round(hours * 10) / 10;
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const days = m / (60 * 24);
  const d = Math.round(days * 10) / 10;
  return `${d} day${d === 1 ? "" : "s"}`;
};

/* =========================
   UI primitives (match ProjectSettings typography)
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

const SoftNotice = ({ icon: Icon, tone = "amber", title, children }) => {
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

const Toggle = ({ checked, disabled, onChange, label, hint }) => (
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      {hint ? (
        <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
          {hint}
        </div>
      ) : null}
    </div>

    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={[
        "relative inline-flex h-7 w-12 items-center rounded-full transition border",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        checked ? "bg-blue-600 border-blue-600" : "bg-gray-100 border-gray-200",
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
   Main Page
========================= */
const QK = ["generalSettings"];

const presets = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "4h", value: 240 },
  { label: "8h", value: 480 },
  { label: "1d", value: 1440 },
  { label: "7d", value: 10080 },
];

export default function GeneralSettings() {
  const queryClient = useQueryClient();

  const [inlineError, setInlineError] = useState("");

  // form state
  const [sessionTimeoutEnabled, setSessionTimeoutEnabled] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(1440);

  // initial snapshot for "dirty" detection
  const [initial, setInitial] = useState(null);

  const settingsQuery = useQuery({
    queryKey: QK,
    queryFn: fetchGeneralSettings,
    staleTime: 1000 * 60 * 5,
  });

  // Your API returns { ok, data } → doc is in .data
  const doc = settingsQuery.data?.data;

  useEffect(() => {
    if (!doc) return;

    const enabled = Boolean(doc.sessionTimeoutEnabled);
    const minutes = clamp(
      toInt(doc.sessionTimeoutMinutes, 1440),
      1,
      60 * 24 * 30,
    );

    setSessionTimeoutEnabled(enabled);
    setSessionTimeoutMinutes(minutes);

    setInitial({
      sessionTimeoutEnabled: enabled,
      sessionTimeoutMinutes: minutes,
    });
  }, [doc]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    return (
      initial.sessionTimeoutEnabled !== sessionTimeoutEnabled ||
      initial.sessionTimeoutMinutes !== sessionTimeoutMinutes
    );
  }, [initial, sessionTimeoutEnabled, sessionTimeoutMinutes]);

  const refetch = useCallback(async () => {
    setInlineError("");
    await settingsQuery.refetch();
    toast.info("Settings refreshed");
  }, [settingsQuery]);

  const saveMutation = useMutation({
    mutationFn: (payload) => updateGeneralSettings(payload),
    onSuccess: async () => {
      setInlineError("");
      toast.success("Settings saved");
      await queryClient.invalidateQueries({ queryKey: QK });
      setInitial({
        sessionTimeoutEnabled,
        sessionTimeoutMinutes,
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

    const minutes = clamp(toInt(sessionTimeoutMinutes, NaN), 1, 60 * 24 * 30);
    if (!Number.isFinite(minutes)) {
      const msg = "Session timeout must be a valid number of minutes.";
      setInlineError(msg);
      toast.error(msg);
      return;
    }

    saveMutation.mutate({
      sessionTimeoutEnabled: Boolean(sessionTimeoutEnabled),
      sessionTimeoutMinutes: minutes,
    });
  };

  const onResetToDefault = () => {
    setInlineError("");
    setSessionTimeoutEnabled(true);
    setSessionTimeoutMinutes(1440);
    toast.info("Default values applied (not saved yet)");
  };

  const effectiveText = useMemo(() => {
    if (!sessionTimeoutEnabled) return "Tokens will NOT expire (no expiresIn).";
    return `Tokens expire after ${formatDuration(sessionTimeoutMinutes)}.`;
  }, [sessionTimeoutEnabled, sessionTimeoutMinutes]);

  const isRefreshing = settingsQuery.isRefetching;
  const isSaving = saveMutation.isPending;

  return (
    <div className="w-full flex-1 flex h-full flex-col bg-gray-50/50">
      <div className="px-1 w-full mx-auto py-2 pb-2">
        <Breadcrumbs items={[{ label: "SETTINGS", to: "/app/settings" }]} />

        {/* Header (match ProjectSettings typography) */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              Session <span className="font-bold">Settings</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage security defaults like session timeout and token expiry
              behavior.
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
          {/* Main card */}
          <div className="lg:col-span-2">
            <Card>
              <div className="px-4 py-3 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-600" />
                  <div className="text-sm font-semibold text-gray-900">
                    Session timeout
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Control whether JWT tokens expire, and how long sessions last.
                </div>
              </div>

              {settingsQuery.isLoading ? (
                <SkeletonBlock />
              ) : settingsQuery.isError ? (
                <div className="p-4">
                  <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700 font-medium">
                    {getErrMsg(settingsQuery.error, "Failed to load settings")}
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <Toggle
                    checked={sessionTimeoutEnabled}
                    disabled={isSaving}
                    onChange={(v) => setSessionTimeoutEnabled(v)}
                    label="Enable session timeout"
                    hint="If disabled, the backend will sign JWT tokens without expiresIn (they won’t expire)."
                  />

                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                          Timeout duration (minutes)
                        </div>
                        {/* <div className="text-xs text-gray-500 mt-0.5">
                          Input minutes
                        </div> */}
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border bg-gray-50 border-gray-200 text-gray-700">
                        <Zap className="w-4 h-4" />
                        {formatDuration(sessionTimeoutMinutes)}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-center">
                      <div className="flex-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={60 * 24 * 30}
                          value={sessionTimeoutMinutes}
                          disabled={isSaving || !sessionTimeoutEnabled}
                          onChange={(e) => {
                            const next = toInt(e.target.value, 0);
                            if (!Number.isFinite(next)) return;
                            setSessionTimeoutMinutes(
                              clamp(next, 1, 60 * 24 * 30),
                            );
                          }}
                          className={[
                            "w-full h-11 rounded-lg border px-3 text-sm text-gray-900 outline-none transition",
                            !sessionTimeoutEnabled
                              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                              : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                            isSaving ? "opacity-70" : "",
                          ].join(" ")}
                          placeholder="e.g. 60"
                        />
                        <div className="mt-2 text-[11px] text-gray-500">
                          Range: 1 minute to 30 days (43,200 minutes)
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {presets.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            disabled={isSaving || !sessionTimeoutEnabled}
                            onClick={() => setSessionTimeoutMinutes(p.value)}
                            className={[
                              "px-3 py-2 rounded-full text-xs font-bold border transition",
                              sessionTimeoutMinutes === p.value
                                ? "bg-blue-50 text-blue-700 border-blue-100"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300",
                              !sessionTimeoutEnabled
                                ? "opacity-50 cursor-not-allowed"
                                : "",
                            ].join(" ")}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <SoftNotice
                    icon={sessionTimeoutEnabled ? CheckCircle2 : ShieldAlert}
                    tone={sessionTimeoutEnabled ? "green" : "amber"}
                    title="Effective behavior"
                  >
                    {effectiveText}
                  </SoftNotice>

                  <SoftNotice icon={Info} tone="blue" title="Security note">
                    Disabling expiry can be risky (stolen tokens remain valid).
                    If you need long sessions, consider enabling expiry and
                    using refresh tokens later.
                  </SoftNotice>

                  <InlineError message={inlineError} />

                  <div className="pt-1 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                    <div className="text-xs text-gray-500">
                      {isDirty ? (
                        <span className="font-medium text-gray-700">
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
                  Quick view of your current configuration.
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Session timeout
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {sessionTimeoutEnabled ? "Enabled" : "Disabled"}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {sessionTimeoutEnabled
                      ? `Expires after ${formatDuration(sessionTimeoutMinutes)}`
                      : "Tokens do not expire"}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Limits
                  </div>
                  <div className="mt-2 text-xs text-gray-600 leading-relaxed">
                    • Minimum: 1 minute
                    <br />
                    • Maximum: 30 days
                    <br />
                  </div>
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
