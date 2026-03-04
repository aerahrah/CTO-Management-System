// src/pages/settings/UserPreferencesSettings.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Breadcrumbs from "../breadCrumbs";
import {
  fetchMyPreferences,
  updateMyPreferences,
  resetMyPreferences,
  fetchPreferenceOptions,
} from "../../api/userPreferences";
import {
  RotateCcw,
  Save,
  Palette,
  Moon,
  Sun,
  Laptop,
  CheckCircle2,
  ShieldAlert,
  Info,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../store/authStore";
import ScrollbarsSync from "../../components/scrollbarSync";

/* =========================
   Helpers
========================= */
const getErrMsg = (err, fallback = "Failed") =>
  err?.response?.data?.message || err?.message || fallback;

const hoverSurfaceIn = (e) => {
  e.currentTarget.style.backgroundColor = "var(--app-surface-2)";
};
const hoverSurfaceOut = (e) => {
  e.currentTarget.style.backgroundColor = "var(--app-surface)";
};

/* =========================
   UI primitives (theme-var based)
========================= */
const Card = ({ children, className = "" }) => (
  <div
    className={["rounded-xl border shadow-sm overflow-hidden", className].join(
      " ",
    )}
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: "var(--app-border)",
      color: "var(--app-text)",
      transition: "background-color 150ms, border-color 150ms, color 150ms",
    }}
  >
    {children}
  </div>
);

const InlineError = ({ message }) => {
  if (!message) return null;
  return (
    <div
      className="mt-3 rounded-lg px-3 py-2 text-xs font-medium"
      style={{
        border: "1px solid rgba(244,63,94,0.25)",
        backgroundColor: "rgba(244,63,94,0.10)",
        color: "rgba(244,63,94,0.95)",
      }}
    >
      {message}
    </div>
  );
};

const SoftNotice = ({ icon: Icon, tone = "neutral", title, children }) => {
  const tones = {
    amber: { accent: "rgba(245,158,11,0.9)" },
    blue: { accent: "var(--accent)" },
    green: { accent: "rgba(16,185,129,0.9)" },
    neutral: { accent: "var(--app-muted)" },
  };
  const t = tones[tone] || tones.neutral;

  return (
    <div
      className="rounded-xl border px-4 py-3 flex gap-3"
      style={{
        backgroundColor: "var(--app-surface-2)",
        borderColor: "var(--app-border)",
        color: "var(--app-text)",
      }}
    >
      <div className="mt-0.5">
        <Icon className="w-4 h-4" style={{ color: t.accent }} />
      </div>
      <div className="min-w-0">
        {title ? (
          <div
            className="text-xs font-semibold"
            style={{ color: "var(--app-text)" }}
          >
            {title}
          </div>
        ) : null}
        <div
          className="text-xs leading-relaxed"
          style={{ color: "var(--app-muted)" }}
        >
          {children}
        </div>
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
      "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold border transition",
      disabled ? "cursor-not-allowed opacity-60" : "",
      className,
    ].join(" ")}
    style={{
      backgroundColor: disabled ? "var(--app-surface-2)" : "var(--accent)",
      borderColor: disabled ? "var(--app-border)" : "var(--accent)",
      color: disabled ? "var(--app-muted)" : "#fff",
    }}
    onMouseEnter={(e) => {
      if (disabled) return;
      e.currentTarget.style.filter = "brightness(0.94)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.filter = "none";
    }}
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
      "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold border transition",
      disabled ? "cursor-not-allowed opacity-60" : "",
      className,
    ].join(" ")}
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: "var(--app-border)",
      color: "var(--app-text)",
    }}
    onMouseEnter={(e) => {
      if (disabled) return;
      hoverSurfaceIn(e);
    }}
    onMouseLeave={(e) => {
      if (disabled) return;
      hoverSurfaceOut(e);
    }}
  >
    {children}
  </button>
);

const SkeletonBlock = () => (
  <div className="p-4 space-y-3">
    <div
      className="h-4 w-1/3 rounded"
      style={{ backgroundColor: "var(--app-surface-2)" }}
    />
    <div
      className="h-11 w-full rounded-lg"
      style={{ backgroundColor: "var(--app-surface-2)" }}
    />
    <div
      className="h-24 w-full rounded-xl"
      style={{ backgroundColor: "var(--app-surface-2)" }}
    />
    <div
      className="h-24 w-full rounded-xl"
      style={{ backgroundColor: "var(--app-surface-2)" }}
    />
    <div className="flex gap-2">
      <div
        className="h-10 w-32 rounded-lg"
        style={{ backgroundColor: "var(--app-surface-2)" }}
      />
      <div
        className="h-10 w-32 rounded-lg"
        style={{ backgroundColor: "var(--app-surface-2)" }}
      />
    </div>
  </div>
);

/* =========================
   Theme + Accent meta
========================= */
const THEME_META = [
  {
    value: "system",
    label: "System",
    icon: Laptop,
    desc: "Follows your device appearance.",
  },
  { value: "light", label: "Light", icon: Sun, desc: "Bright UI theme." },
  { value: "dark", label: "Dark", icon: Moon, desc: "Dim UI theme." },
];

const ACCENT_META = {
  blue: { name: "Blue", hex: "#2563EB" },
  pink: { name: "Pink", hex: "#DB2777" },
  green: { name: "Green", hex: "#16A34A" },
  violet: { name: "Violet", hex: "#7C3AED" },
  amber: { name: "Amber", hex: "#D97706" },
  teal: { name: "Teal", hex: "#0D9488" },
  indigo: { name: "Indigo", hex: "#4F46E5" },
  rose: { name: "Rose", hex: "#E11D48" },
  cyan: { name: "Cyan", hex: "#0891B2" },
  lime: { name: "Lime", hex: "#65A30D" },
  orange: { name: "Orange", hex: "#EA580C" },
};

const normalizeTheme = (t) =>
  ["system", "light", "dark"].includes(t) ? t : "system";

const normalizeAccent = (a, allowedAccents) => {
  const allowed =
    Array.isArray(allowedAccents) && allowedAccents.length
      ? allowedAccents
      : Object.keys(ACCENT_META);
  return allowed.includes(a) && ACCENT_META[a] ? a : "blue";
};

/* =========================
   Pickers (theme-var based)
========================= */
const SectionHeader = ({ icon: Icon, title, subtitle }) => (
  <div
    className="px-4 py-3 border-b"
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: "var(--app-border)",
      transition: "background-color 150ms, border-color 150ms",
    }}
  >
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4" style={{ color: "var(--app-muted)" }} />
      <div
        className="text-sm font-semibold"
        style={{ color: "var(--app-text)" }}
      >
        {title}
      </div>
    </div>
    {subtitle ? (
      <div className="text-xs mt-1" style={{ color: "var(--app-muted)" }}>
        {subtitle}
      </div>
    ) : null}
  </div>
);

const ThemePicker = ({ value, onChange, disabled }) => (
  <div
    className="rounded-xl border p-4"
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: "var(--app-border)",
      transition: "background-color 150ms, border-color 150ms",
    }}
  >
    <div className="min-w-0">
      <div
        className="text-sm font-semibold"
        style={{ color: "var(--app-text)" }}
      >
        Appearance mode
      </div>
      <div className="text-xs mt-0.5" style={{ color: "var(--app-muted)" }}>
        Choose how the app looks for your account.
      </div>
    </div>

    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
      {THEME_META.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={[
              "rounded-xl border px-3 py-3 text-left transition",
              disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
            style={{
              backgroundColor: selected
                ? "var(--accent-soft, rgba(37,99,235,0.10))"
                : "var(--app-surface)",
              borderColor: selected ? "var(--accent)" : "var(--app-border)",
            }}
            onMouseEnter={(e) => {
              if (disabled || selected) return;
              hoverSurfaceIn(e);
            }}
            onMouseLeave={(e) => {
              if (disabled || selected) return;
              hoverSurfaceOut(e);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2">
                <span
                  className="h-9 w-9 rounded-xl flex items-center justify-center border"
                  style={{
                    backgroundColor: selected
                      ? "var(--app-surface)"
                      : "var(--app-surface-2)",
                    borderColor: selected
                      ? "var(--accent-soft2)"
                      : "var(--app-border)",
                    color: selected ? "var(--accent)" : "var(--app-text)",
                  }}
                >
                  <Icon className="w-4 h-4" />
                </span>

                <div className="min-w-0">
                  <div
                    className="text-sm font-bold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {opt.label}
                  </div>
                  <div
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {opt.desc}
                  </div>
                </div>
              </div>

              {selected ? (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold"
                  style={{ color: "var(--accent)" }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const AccentPicker = ({ value, onChange, disabled, allowedAccents }) => {
  const accents = useMemo(() => {
    const list =
      Array.isArray(allowedAccents) && allowedAccents.length
        ? allowedAccents
        : Object.keys(ACCENT_META);
    const order = Object.keys(ACCENT_META);
    return list
      .filter((k) => ACCENT_META[k])
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [allowedAccents]);

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: "var(--app-border)",
        transition: "background-color 150ms, border-color 150ms",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--app-text)" }}
          >
            Accent color
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--app-muted)" }}>
            Used for primary buttons, links, highlights, and badges.
          </div>
        </div>

        <span
          className="text-[11px] font-bold"
          style={{ color: "var(--app-muted)" }}
        >
          {ACCENT_META[value]?.name || value}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
        {accents.map((key) => {
          const meta = ACCENT_META[key];
          const selected = value === key;

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(key)}
              className={[
                "rounded-xl border px-3 py-2.5 transition flex items-center justify-between gap-3",
                disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
              style={{
                backgroundColor: selected
                  ? "var(--accent-soft, rgba(37,99,235,0.10))"
                  : "var(--app-surface)",
                borderColor: selected ? "var(--accent)" : "var(--app-border)",
              }}
              onMouseEnter={(e) => {
                if (disabled || selected) return;
                hoverSurfaceIn(e);
              }}
              onMouseLeave={(e) => {
                if (disabled || selected) return;
                hoverSurfaceOut(e);
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-4 w-4 rounded-full border border-black/10 flex-none"
                  style={{ backgroundColor: meta.hex }}
                />
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--app-text)" }}
                >
                  {meta.name}
                </div>
              </div>

              {selected ? (
                <span
                  className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold border"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: "var(--app-border)",
                    color: "var(--accent)",
                  }}
                >
                  Selected
                </span>
              ) : (
                <span
                  className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold border"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderColor: "var(--app-border)",
                    color: "var(--app-muted)",
                  }}
                >
                  Choose
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const PreviewCard = ({ theme, accent }) => {
  const a = ACCENT_META[accent] || ACCENT_META.blue;

  const isDarkPreview = theme === "dark";
  const bg = isDarkPreview ? "#0B1220" : "#FFFFFF";
  const panel = isDarkPreview ? "#111A2E" : "#F8FAFC";
  const text = isDarkPreview ? "#E5E7EB" : "#0F172A";
  const sub = isDarkPreview ? "#A3A3A3" : "#64748B";
  const border = isDarkPreview
    ? "rgba(255,255,255,0.08)"
    : "rgba(15,23,42,0.08)";

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: "var(--app-border)",
      }}
    >
      <div
        className="text-sm font-semibold"
        style={{ color: "var(--app-text)" }}
      >
        Preview
      </div>
      <div className="text-xs mt-0.5" style={{ color: "var(--app-muted)" }}>
        Example components using your accent (visual only).
      </div>

      <div
        className="mt-3 rounded-2xl border p-4"
        style={{ backgroundColor: bg, borderColor: border }}
      >
        <div
          className="rounded-xl border p-3"
          style={{ backgroundColor: panel, borderColor: border }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold" style={{ color: text }}>
                CTO Request
              </div>
              <div className="text-xs mt-1" style={{ color: sub }}>
                Accent applies to buttons, links, and highlights.
              </div>
            </div>

            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold border"
              style={{
                color: isDarkPreview ? "#FFFFFF" : a.hex,
                borderColor: isDarkPreview
                  ? "rgba(255,255,255,0.14)"
                  : "rgba(15,23,42,0.10)",
                backgroundColor: isDarkPreview
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(37,99,235,0.08)",
              }}
            >
              Highlight
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-xs font-bold text-white"
              style={{ backgroundColor: a.hex }}
            >
              Primary action
            </button>

            <button
              type="button"
              className="rounded-lg px-3 py-2 text-xs font-bold border"
              style={{
                color: text,
                borderColor: border,
                backgroundColor: isDarkPreview
                  ? "rgba(255,255,255,0.04)"
                  : "#FFFFFF",
              }}
            >
              Secondary
            </button>

            <span className="text-xs font-semibold" style={{ color: a.hex }}>
              Accent link
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================
   Main Page
========================= */
const QK_PREFS = ["userPreferences"];
const QK_OPTS = ["userPreferencesOptions"];

export default function UserPreferencesSettings() {
  const queryClient = useQueryClient();
  const { setPreferences } = useAuth();

  const [inlineError, setInlineError] = useState("");

  const [form, setForm] = useState({ theme: "system", accent: "blue" });
  const [initial, setInitial] = useState(null);

  const prefsQuery = useQuery({
    queryKey: QK_PREFS,
    queryFn: fetchMyPreferences,
    staleTime: 1000 * 60 * 5,
  });

  const optionsQuery = useQuery({
    queryKey: QK_OPTS,
    queryFn: fetchPreferenceOptions,
    staleTime: 1000 * 60 * 60,
  });

  const prefs = prefsQuery.data?.preferences;
  const opts = optionsQuery.data;

  const allowedAccents = opts?.accents || Object.keys(ACCENT_META);

  const defaults = useMemo(() => {
    const d = opts?.defaults || { theme: "system", accent: "blue" };
    return {
      theme: normalizeTheme(d.theme),
      accent: normalizeAccent(d.accent, allowedAccents),
    };
  }, [opts, allowedAccents]);

  useEffect(() => {
    if (!prefs) return;
    const normalized = {
      theme: normalizeTheme(prefs.theme),
      accent: normalizeAccent(prefs.accent, allowedAccents),
    };
    setForm(normalized);
    setInitial(normalized);

    setPreferences?.(normalized);
  }, [prefs, allowedAccents, setPreferences]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    return initial.theme !== form.theme || initial.accent !== form.accent;
  }, [initial, form]);

  const isRefreshing = prefsQuery.isRefetching || optionsQuery.isRefetching;

  const refetch = useCallback(async () => {
    setInlineError("");
    await Promise.all([prefsQuery.refetch(), optionsQuery.refetch()]);
    toast.info("Settings refreshed");
  }, [prefsQuery, optionsQuery]);

  const saveMutation = useMutation({
    mutationFn: () => updateMyPreferences(form),
    onSuccess: async (data) => {
      setInlineError("");
      toast.success("Preferences saved");
      await queryClient.invalidateQueries({ queryKey: QK_PREFS });

      const p = data?.preferences || form;
      const normalized = {
        theme: normalizeTheme(p.theme),
        accent: normalizeAccent(p.accent, allowedAccents),
      };

      setPreferences?.(normalized);

      setForm(normalized);
      setInitial(normalized);
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to save preferences");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetMyPreferences,
    onSuccess: async (data) => {
      setInlineError("");
      toast.success("Preferences reset to defaults");
      await queryClient.invalidateQueries({ queryKey: QK_PREFS });

      const p = data?.preferences || defaults;
      const normalized = {
        theme: normalizeTheme(p.theme),
        accent: normalizeAccent(p.accent, allowedAccents),
      };

      setPreferences?.(normalized);

      setForm(normalized);
      setInitial(normalized);
    },
    onError: (err) => {
      const msg = getErrMsg(err, "Failed to reset preferences");
      setInlineError(msg);
      toast.error(msg);
    },
  });

  const isSaving = saveMutation.isPending || resetMutation.isPending;

  const onSave = () => {
    setInlineError("");
    if (!isDirty) return toast.info("No changes to save");
    saveMutation.mutate();
  };

  const onResetLocalDefaults = () => {
    setInlineError("");
    setForm(defaults);
    toast.info("Default values applied (not saved yet)");
  };

  const onResetServerDefaults = () => {
    setInlineError("");
    resetMutation.mutate();
  };

  const tone = useMemo(() => {
    if (!initial) return "neutral";
    return isDirty ? "amber" : "green";
  }, [initial, isDirty]);

  const statusIcon = isDirty ? ShieldAlert : CheckCircle2;

  const summary = useMemo(() => {
    const themeName =
      THEME_META.find((t) => t.value === form.theme)?.label || "System";
    const accentName = ACCENT_META[form.accent]?.name || "Blue";
    return { themeName, accentName };
  }, [form]);

  return (
    // ✅ Whole page now follows ThemeSync CSS vars (not Tailwind dark class)
    <div
      className="w-full flex-1 flex h-full flex-col custom-scrollbar transition-colors duration-150"
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--app-text)",
      }}
    >
      {/* ✅ Reusable scrollbar sync (works for this page + main html/body scrollbar) */}
      <ScrollbarsSync />

      <div className="px-1 w-full mx-auto py-2 pb-2">
        <Breadcrumbs items={[{ label: "SETTINGS", to: "/app/settings" }]} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight"
              style={{ color: "var(--app-text)" }}
            >
              Appearance <span className="font-bold">Preferences</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--app-muted)" }}>
              Customize your theme mode and accent color for a premium, personal
              workspace.
            </p>
          </div>

          <button
            onClick={refetch}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold border transition disabled:opacity-40"
            type="button"
            style={{
              backgroundColor: "var(--app-surface)",
              borderColor: "var(--app-border)",
              color: "var(--accent)",
            }}
            onMouseEnter={(e) => {
              if (isRefreshing) return;
              e.currentTarget.style.backgroundColor = "var(--accent-soft)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--app-surface)";
            }}
          >
            <RotateCcw className="w-4 h-4" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main */}
          <div className="lg:col-span-2">
            <Card>
              <SectionHeader
                icon={Palette}
                title="Theme & accent"
                subtitle="Your choices are saved to your account and can sync across devices."
              />

              {prefsQuery.isLoading || optionsQuery.isLoading ? (
                <SkeletonBlock />
              ) : prefsQuery.isError || optionsQuery.isError ? (
                <div className="p-4">
                  <div
                    className="rounded-lg px-3 py-2 text-sm font-medium"
                    style={{
                      border: "1px solid rgba(244,63,94,0.25)",
                      backgroundColor: "rgba(244,63,94,0.10)",
                      color: "rgba(244,63,94,0.95)",
                    }}
                  >
                    {getErrMsg(
                      prefsQuery.error || optionsQuery.error,
                      "Failed to load preferences",
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <ThemePicker
                    value={form.theme}
                    onChange={(theme) =>
                      setForm((prev) => ({
                        ...prev,
                        theme: normalizeTheme(theme),
                      }))
                    }
                    disabled={isSaving}
                  />

                  <AccentPicker
                    value={form.accent}
                    onChange={(accent) =>
                      setForm((prev) => ({
                        ...prev,
                        accent: normalizeAccent(accent, allowedAccents),
                      }))
                    }
                    disabled={isSaving}
                    allowedAccents={allowedAccents}
                  />

                  <PreviewCard theme={form.theme} accent={form.accent} />

                  <SoftNotice icon={statusIcon} tone={tone} title="Status">
                    {isDirty
                      ? "You have unsaved changes. Save to apply your preferences across the app."
                      : "All changes saved. Your appearance preferences are up to date."}
                  </SoftNotice>

                  <SoftNotice icon={Info} tone="blue" title="Tip">
                    Use <strong>System</strong> if you want the app to match
                    your device theme automatically.
                  </SoftNotice>

                  <InlineError message={inlineError} />

                  <div className="pt-1 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                    <div
                      className="text-xs"
                      style={{ color: "var(--app-muted)" }}
                    >
                      {isDirty ? (
                        <span
                          style={{ color: "var(--app-text)" }}
                          className="font-medium"
                        >
                          You have unsaved changes.
                        </span>
                      ) : (
                        <span>All changes saved.</span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <GhostButton
                        onClick={onResetLocalDefaults}
                        disabled={isSaving}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reset defaults
                      </GhostButton>

                      <GhostButton
                        onClick={onResetServerDefaults}
                        disabled={isSaving}
                        className="sm:w-auto"
                      >
                        <Sparkles className="w-4 h-4" />
                        Reset & apply
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
              <SectionHeader
                icon={Sparkles}
                title="Summary"
                subtitle="Quick view of your selected appearance."
              />

              <div className="p-4 space-y-3">
                <div
                  className="rounded-xl border p-4"
                  style={{
                    backgroundColor: "var(--app-surface-2)",
                    borderColor: "var(--app-border)",
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Current
                  </div>
                  <div
                    className="mt-1 text-sm font-semibold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {summary.themeName} • {summary.accentName}
                  </div>
                  <div
                    className="mt-1 text-xs"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Theme: <span className="font-semibold">{form.theme}</span>{" "}
                    <span className="mx-1">•</span>
                    Accent: <span className="font-semibold">{form.accent}</span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/10"
                      style={{
                        backgroundColor:
                          ACCENT_META[form.accent]?.hex || ACCENT_META.blue.hex,
                      }}
                    />
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--app-text)" }}
                    >
                      Accent swatch
                    </span>
                  </div>
                </div>

                <div
                  className="rounded-xl border p-4"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: "var(--app-border)",
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Defaults
                  </div>
                  <div
                    className="mt-1 text-sm font-semibold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {THEME_META.find((t) => t.value === defaults.theme)
                      ?.label || "System"}{" "}
                    • {ACCENT_META[defaults.accent]?.name || "Blue"}
                  </div>
                  <div
                    className="mt-1 text-xs"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Reset defaults sets your form to these values (then save).
                  </div>
                </div>

                <button
                  onClick={refetch}
                  disabled={isRefreshing}
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold border transition disabled:opacity-40"
                  style={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: "var(--app-border)",
                    color: "var(--app-text)",
                  }}
                  onMouseEnter={(e) => {
                    if (isRefreshing) return;
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--app-surface)";
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                  {isRefreshing ? "Refreshing..." : "Reload preferences"}
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
