import React, { useMemo } from "react";
import {
  Users,
  User,
  Search,
  MousePointerClick,
  SlidersHorizontal,
  BadgeCheck,
  Clock,
  FileText,
  Layers,
} from "lucide-react";

const EmployeeRecordsPlaceholder = ({
  title = "No Employee Selected",
  description = "Choose an employee from the directory to view CTO credits, applications, and summary balances.",
  highlights = [
    { icon: Layers, label: "View CTO total hours and remaining hours" },
    { icon: FileText, label: "View CTO memos & supporting files" },
    { icon: BadgeCheck, label: "View Application statuses & approvals" },
  ],
  tips = [
    {
      icon: MousePointerClick,
      label: "Select an employee from the left panel",
    },
    { icon: Search, label: "Search by name, email, role, or department" },
    { icon: SlidersHorizontal, label: "Adjust rows per page to browse faster" },
  ],
  contextBadges = [
    { icon: Users, label: "Directory View" },
    { icon: Clock, label: "CTO Records" },
  ],
  className = "",
}) => {
  // ✅ Use ThemeSync CSS vars (mounted globally in App.jsx)
  const borderColor = useMemo(
    () => `var(--app-border, rgba(15,23,42,0.10))`,
    [],
  );

  const surface = useMemo(
    () => `var(--app-surface, rgba(255,255,255,0.92))`,
    [],
  );
  const surface2 = useMemo(
    () => `var(--app-surface-2, rgba(15,23,42,0.03))`,
    [],
  );
  const text = useMemo(() => `var(--app-text, #0f172a)`, []);
  const muted = useMemo(() => `var(--app-muted, rgba(15,23,42,0.55))`, []);
  const accent = useMemo(() => `var(--accent, #2563eb)`, []);
  const accentSoft = useMemo(
    () => `var(--accent-soft, rgba(37,99,235,0.14))`,
    [],
  );
  const accentSoft2 = useMemo(
    () => `var(--accent-soft2, rgba(37,99,235,0.22))`,
    [],
  );

  return (
    <div
      className={[
        "relative h-full w-full min-h-[460px] overflow-hidden rounded-xl",
        "border shadow-sm",
        className,
      ].join(" ")}
      style={{
        backgroundColor: surface,
        borderColor,
        color: text,
      }}
    >
      {/* Background decoration */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* soft blobs */}
        <div
          className="absolute -top-28 -right-24 h-80 w-80 rounded-full blur-3xl"
          style={{
            backgroundColor: `var(--app-blob-1, rgba(148,163,184,0.22))`,
          }}
        />
        <div
          className="absolute -bottom-24 -left-28 h-80 w-80 rounded-full blur-3xl"
          style={{
            backgroundColor: `var(--app-blob-2, rgba(148,163,184,0.18))`,
          }}
        />

        {/* dotted radial grid */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle_at_1px_1px, var(--app-dot, rgba(15,23,42,0.08)) 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        />
      </div>

      <div className="relative flex h-full w-full flex-col items-center justify-center px-6 py-10 text-center">
        {/* Top badges */}
        <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
          {contextBadges.map((b, idx) => {
            const Icon = b.icon;
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm backdrop-blur"
                style={{
                  backgroundColor: surface,
                  borderColor,
                  color: muted,
                }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: muted }} />
                {b.label}
              </span>
            );
          })}
        </div>

        {/* Icon */}
        <div className="group relative mb-6">
          <div
            className="absolute inset-0 rounded-[28px] blur-xl transition-opacity group-hover:opacity-80"
            style={{ backgroundColor: accentSoft }}
          />
          <div
            className="relative flex h-20 w-20 items-center justify-center rounded-[28px] border shadow-sm backdrop-blur"
            style={{
              backgroundColor: surface,
              borderColor,
            }}
          >
            <div
              className="absolute -right-2 -bottom-2 flex h-9 w-9 items-center justify-center rounded-2xl shadow-md ring-4"
              style={{
                backgroundColor: accent,
                color: "#fff",
                // ring color should stay surface-like
                boxShadow: "0 10px 20px rgba(0,0,0,0.18)",
                border: `1px solid ${accentSoft2}`,
              }}
            >
              <Search className="h-4 w-4" style={{ color: "#fff" }} />
            </div>

            <User
              className="h-9 w-9 transition-colors"
              style={{ color: `var(--app-icon, rgba(15,23,42,0.35))` }}
            />
          </div>
        </div>

        {/* Title + description */}
        <h3 className="text-lg sm:text-2xl font-bold" style={{ color: text }}>
          {title}
        </h3>
        <p
          className="mt-2 max-w-md text-sm leading-relaxed"
          style={{ color: muted }}
        >
          {description}
        </p>

        {/* What you'll see */}
        <div className="mt-7 w-full max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {highlights.map((h, idx) => {
              const Icon = h.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm backdrop-blur"
                  style={{
                    backgroundColor: surface,
                    borderColor,
                  }}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl border flex-none"
                    style={{
                      backgroundColor: accentSoft,
                      color: accent,
                      borderColor: accentSoft2,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p
                    className="text-xs font-bold leading-snug"
                    style={{ color: `var(--app-text, #0f172a)` }}
                  >
                    {h.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tips */}
        <div
          className="mt-6 w-full max-w-xl rounded-2xl border px-4 py-4 shadow-sm backdrop-blur"
          style={{
            backgroundColor: surface,
            borderColor,
          }}
        >
          <div
            className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
            style={{ color: muted }}
          >
            <span
              className="h-1 w-1 rounded-full"
              style={{
                backgroundColor: `var(--app-dot, rgba(148,163,184,0.55))`,
              }}
            />
            Quick tips
            <span
              className="h-1 w-1 rounded-full"
              style={{
                backgroundColor: `var(--app-dot, rgba(148,163,184,0.55))`,
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {tips.map((t, idx) => {
              const Icon = t.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-xl border px-3 py-2 text-left"
                  style={{
                    backgroundColor: surface2,
                    borderColor,
                  }}
                >
                  <Icon
                    className="h-4 w-4 mt-0.5 flex-none"
                    style={{ color: muted }}
                  />
                  <p
                    className="text-[11px] font-semibold leading-snug"
                    style={{ color: muted }}
                  >
                    {t.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-5 text-[11px]" style={{ color: muted }}>
          Select an employee to load their credits, applications, and memos.
        </p>
      </div>
    </div>
  );
};

export default EmployeeRecordsPlaceholder;
