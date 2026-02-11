// src/components/generalSettingsComponents/ctoSettings/CtoSettingsPlaceholder.jsx
import React from "react";
import {
  Workflow,
  Settings2,
  MousePointerClick,
  Search,
  SlidersHorizontal,
  BadgeCheck,
  ShieldCheck,
  Layers,
  Building2,
  Users,
  Route,
} from "lucide-react";

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
  return (
    <div
      className={[
        "relative h-full w-full min-h-[460px] overflow-hidden rounded-xl",
        "border border-neutral-200 bg-white/90",
        "shadow-sm",
        className,
      ].join(" ")}
    >
      {/* Background decoration */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -right-24 h-80 w-80 rounded-full bg-neutral-200/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-28 h-80 w-80 rounded-full bg-neutral-200/25 blur-3xl" />
        <div className="absolute inset-0 [background:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_0)] [background-size:18px_18px] opacity-30" />
      </div>

      <div className="relative flex h-full w-full flex-col items-center justify-center px-6 py-10 text-center">
        {/* Top badges */}
        <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
          {contextBadges.map((b, idx) => {
            const Icon = b.icon;
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/70 backdrop-blur px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-600 shadow-sm"
              >
                <Icon className="h-3.5 w-3.5 text-neutral-400" />
                {b.label}
              </span>
            );
          })}
        </div>

        {/* Icon */}
        <div className="group relative mb-6">
          <div className="absolute inset-0 rounded-[28px] bg-indigo-500/15 blur-xl transition-opacity group-hover:opacity-80" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/80 backdrop-blur border border-neutral-200 shadow-sm">
            <div className="absolute -right-2 -bottom-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 shadow-md ring-4 ring-white">
              <Settings2 className="h-4 w-4 text-white" />
            </div>
            <Building2 className="h-9 w-9 text-neutral-400 transition-colors group-hover:text-indigo-600" />
          </div>
        </div>

        {/* Title + description */}
        <h3 className="text-lg sm:text-2xl font-bold text-neutral-900">
          {title}
        </h3>
        <p className="mt-2 max-w-md text-sm text-neutral-500 leading-relaxed">
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
                  className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur px-4 py-3 text-left shadow-sm"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex-none">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-neutral-700 leading-snug">
                    {h.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tips */}
        <div className="mt-6 w-full max-w-xl rounded-2xl border border-neutral-200 bg-white/60 backdrop-blur px-4 py-4 shadow-sm">
          <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">
            <span className="h-1 w-1 rounded-full bg-neutral-300" />
            Quick tips
            <span className="h-1 w-1 rounded-full bg-neutral-300" />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {tips.map((t, idx) => {
              const Icon = t.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-xl bg-neutral-50/70 border border-neutral-100 px-3 py-2 text-left"
                >
                  <Icon className="h-4 w-4 text-neutral-400 mt-0.5 flex-none" />
                  <p className="text-[11px] font-semibold text-neutral-600 leading-snug">
                    {t.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-5 text-[11px] text-neutral-400">
          Select a designation to load its routing workflow and approver
          configuration.
        </p>
      </div>
    </div>
  );
};

export default CtoSettingsPlaceholder;
