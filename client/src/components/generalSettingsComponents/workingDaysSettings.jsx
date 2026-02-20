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

/* =========================
   UI primitives (same style as GeneralSettings.jsx)
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

/* =========================
   ✅ Toggle (fixed for small widths)
   - prevents shrinking/collapsing
   - allows label/hint to wrap safely
========================= */
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
    <div className="w-full flex-1 flex h-full flex-col bg-gray-50/50">
      <div className="px-1 w-full mx-auto py-2 pb-2">
        <Breadcrumbs items={[{ label: "SETTINGS", to: "/app/settings" }]} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              Lead Working <span className="font-bold">Days</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure your organization’s default work-week settings.
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
                  <CalendarDays className="w-4 h-4 text-gray-600" />
                  <div className="text-sm font-semibold text-gray-900">
                    Work-week policy
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Defines the number of working days used for calculations and
                  defaults throughout the system.
                </div>
              </div>

              {settingsQuery.isLoading ? (
                <SkeletonBlock />
              ) : settingsQuery.isError ? (
                <div className="p-4">
                  <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700 font-medium">
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
                  />

                  <div className="rounded-xl border border-gray-200 bg-white p-2 md:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                          Working days per week
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Choose a value from 1–7. Common defaults are 5 or 6.
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-full min-w-16 px-3 py-1.5 text-xs font-medium border bg-gray-50 border-gray-200 text-gray-700">
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
                          className={[
                            "w-full h-11 rounded-lg border px-3 text-sm text-gray-900 outline-none transition",
                            !workingDaysEnable
                              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                              : "bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                            isSaving ? "opacity-70" : "",
                          ].join(" ")}
                          placeholder="e.g. 5"
                        />
                        <div className="mt-2 text-[11px] text-gray-500">
                          Range: 1 to 7 days
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {presets.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            disabled={isSaving || !workingDaysEnable}
                            onClick={() => setWorkingDaysValue(p.value)}
                            className={[
                              "px-3 py-2 rounded-full text-xs font-bold border transition",
                              workingDaysValue === p.value
                                ? "bg-blue-50 text-blue-700 border-blue-100"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300",
                              !workingDaysEnable
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
                    icon={workingDaysEnable ? CheckCircle2 : ShieldAlert}
                    tone={workingDaysEnable ? "green" : "amber"}
                    title="Effective behavior"
                  >
                    {effectiveText}
                  </SoftNotice>

                  <SoftNotice icon={Info} tone="blue" title="Note">
                    This setting is often used for credit calculations, SLA
                    expectations, and reporting. Keep it aligned with your HR
                    policy.
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
                    Working days
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {workingDaysEnable ? "Enabled" : "Disabled"}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {workingDaysEnable
                      ? `${workingDaysValue} day${
                          workingDaysValue === 1 ? "" : "s"
                        } per week`
                      : "Not applied"}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-2 md:p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Limits
                  </div>
                  <div className="mt-2 text-xs text-gray-600 leading-relaxed">
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
