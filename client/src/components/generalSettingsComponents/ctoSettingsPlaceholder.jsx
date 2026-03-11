// src/components/generalSettingsComponents/ctoSettings/CtoSettingsPlaceholder.jsx
import React, { useMemo } from "react";
import { useAuth } from "../../store/authStore";
import {
  Workflow,
  Settings2,
  MousePointerClick,
  Search,
  SlidersHorizontal,
  BadgeCheck,
  ShieldCheck,
  Building2,
  Users,
  Route,
  Info,
} from "lucide-react";

/* ------------------ Resolve theme ------------------ */
function resolveTheme(prefTheme) {
  if (prefTheme === "system") {
    const systemDark =
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return systemDark ? "dark" : "light";
  }
  return prefTheme === "dark" ? "dark" : "light";
}

const CtoSettingsPlaceholder = ({
  title = "No Designation Selected",
  description = "Choose a designation from the left panel to configure its approval routing workflow.",
  highlights = [
    { icon: Route, label: "Configure sequential approver routing (L1 → L3)" },
    { icon: Users, label: "Assign approvers per designation" },
    { icon: BadgeCheck, label: "Maintain consistent approvals & governance" },
  ],
  tips = [
    {
      icon: MousePointerClick,
      label: "Select a designation from the left panel",
    },
    { icon: Search, label: "Search designations by name" },
    { icon: SlidersHorizontal, label: "Adjust rows per page to browse faster" },
  ],
  contextBadges = [
    { icon: Workflow, label: "Workflow Settings" },
    { icon: ShieldCheck, label: "Approver Routing" },
  ],
  className = "",
}) => {
  const prefTheme = useAuth((s) => s.preferences?.theme || "system");
  const resolvedTheme = useMemo(() => resolveTheme(prefTheme), [prefTheme]);

  const borderColor = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.10)";
  }, [resolvedTheme]);

  const mutedBg = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.04)"
      : "rgba(255,255,255,0.72)";
  }, [resolvedTheme]);

  const softBg = useMemo(() => {
    return resolvedTheme === "dark"
      ? "rgba(255,255,255,0.03)"
      : "rgba(248,250,252,0.80)";
  }, [resolvedTheme]);

  const decorativeDot = useMemo(() => {
    return resolvedTheme === "dark"
      ? "radial-gradient(circle_at_1px_1px, rgba(255,255,255,0.07) 1px, transparent 0)"
      : "radial-gradient(circle_at_1px_1px, rgba(15,23,42,0.06) 1px, transparent 0)";
  }, [resolvedTheme]);

  return (
    <div
      className={[
        "relative h-full w-full min-h-[460px] overflow-hidden rounded-xl transition-colors duration-300 ease-out",
        className,
      ].join(" ")}
      style={{
        border: `1px solid ${borderColor}`,
        backgroundColor: "var(--app-surface)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
      }}
    >
      {/* Background decoration */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-28 -right-24 h-80 w-80 rounded-full blur-3xl"
          style={{
            background:
              resolvedTheme === "dark"
                ? "rgba(99,102,241,0.10)"
                : "rgba(226,232,240,0.32)",
          }}
        />
        <div
          className="absolute -bottom-24 -left-28 h-80 w-80 rounded-full blur-3xl"
          style={{
            background:
              resolvedTheme === "dark"
                ? "rgba(59,130,246,0.08)"
                : "rgba(226,232,240,0.25)",
          }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: decorativeDot,
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
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors duration-300 ease-out"
                style={{
                  border: `1px solid ${borderColor}`,
                  backgroundColor: mutedBg,
                  color: "var(--app-muted)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <Icon
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--app-muted)" }}
                />
                {b.label}
              </span>
            );
          })}
        </div>

        {/* Icon */}
        <div className="group relative mb-6">
          <div
            className="absolute inset-0 rounded-[28px] blur-xl transition-opacity group-hover:opacity-80"
            style={{
              background:
                resolvedTheme === "dark"
                  ? "rgba(99,102,241,0.18)"
                  : "rgba(99,102,241,0.15)",
            }}
          />
          <div
            className="relative flex h-20 w-20 items-center justify-center rounded-[28px] border shadow-sm transition-colors duration-300 ease-out"
            style={{
              backgroundColor: mutedBg,
              borderColor,
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              className="absolute -right-2 -bottom-2 flex h-9 w-9 items-center justify-center rounded-2xl shadow-md ring-4"
              style={{
                backgroundColor: "var(--accent)",
                color: "#fff",
                ringColor: "var(--app-surface)",
              }}
            >
              <Settings2 className="h-4 w-4 text-white" />
            </div>
            <Building2
              className="h-9 w-9 transition-colors"
              style={{ color: "var(--app-muted)" }}
            />
          </div>
        </div>

        {/* Title + description */}
        <h3
          className="text-lg sm:text-2xl font-bold transition-colors duration-300 ease-out"
          style={{ color: "var(--app-text)" }}
        >
          {title}
        </h3>
        <p
          className="mt-2 max-w-md text-sm leading-relaxed transition-colors duration-300 ease-out"
          style={{ color: "var(--app-muted)" }}
        >
          {description}
        </p>

        {/* What you'll configure */}
        <div className="mt-7 w-full max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {highlights.map((h, idx) => {
              const Icon = h.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-sm transition-colors duration-300 ease-out"
                  style={{
                    border: `1px solid ${borderColor}`,
                    backgroundColor: mutedBg,
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl border flex-none transition-colors duration-300 ease-out"
                    style={{
                      backgroundColor: "var(--accent-soft)",
                      color: "var(--accent)",
                      borderColor: "var(--accent-soft2)",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p
                    className="text-xs font-bold leading-snug transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
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
          className="mt-6 w-full max-w-xl rounded-2xl px-4 py-4 shadow-sm transition-colors duration-300 ease-out"
          style={{
            border: `1px solid ${borderColor}`,
            backgroundColor: mutedBg,
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            <span
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: "var(--app-muted)" }}
            />
            Quick tips
            <span
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: "var(--app-muted)" }}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {tips.map((t, idx) => {
              const Icon = t.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-xl px-3 py-2 text-left transition-colors duration-300 ease-out"
                  style={{
                    backgroundColor: softBg,
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <Icon
                    className="h-4 w-4 mt-0.5 flex-none"
                    style={{ color: "var(--app-muted)" }}
                  />
                  <p
                    className="text-[11px] font-semibold leading-snug transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-muted)" }}
                  >
                    {t.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center gap-2">
          <Info className="h-3.5 w-3.5" style={{ color: "var(--app-muted)" }} />
          <p
            className="text-[11px] transition-colors duration-300 ease-out"
            style={{ color: "var(--app-muted)" }}
          >
            Select a designation to load its routing workflow and approver
            configuration.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CtoSettingsPlaceholder;
