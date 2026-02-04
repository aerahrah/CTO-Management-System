import React from "react";
import {
  FileText,
  MousePointerClick,
  Search,
  SlidersHorizontal,
  CalendarDays,
  ShieldCheck,
  Paperclip,
} from "lucide-react";

const EmployeePlaceholder = ({
  title = "No Request Selected",
  description = "Pick a CTO request from the list to review details, approvals, and attached documents.",
  bullets = [
    {
      icon: CalendarDays,
      label: "Requested dates & total hours",
    },
    {
      icon: ShieldCheck,
      label: "Approval progress & remarks",
    },
    {
      icon: Paperclip,
      label: "Supporting memos & attachments",
    },
  ],
  tips = [
    {
      icon: MousePointerClick,
      label: "Select a request on the left panel",
    },
    {
      icon: SlidersHorizontal,
      label: "Use the status filters to narrow results",
    },
    {
      icon: Search,
      label: "Search by applicant name for faster lookup",
    },
  ],
  className = "",
}) => {
  return (
    <div
      className={[
        "relative h-full w-full min-h-[440px] overflow-hidden rounded-xl",
        "border  border-gray-200 bg-white/90",
        "shadow-md",
        className,
      ].join(" ")}
    >
      {/* Decorative background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-neutral-200/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-neutral-200/25 blur-3xl" />
        <div className="absolute inset-0 [background:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_0)] [background-size:18px_18px] opacity-30" />
      </div>

      <div className="relative flex h-full w-full flex-col items-center justify-center px-6 py-10 text-center">
        {/* Icon */}
        <div className="group relative mb-6">
          <div className="absolute inset-0 rounded-3xl bg-blue-500/15 blur-xl transition-opacity group-hover:opacity-80" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white/80 backdrop-blur border border-gray-200 shadow-sm">
            <div className="absolute -right-2 -bottom-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 shadow-md ring-4 ring-white">
              <Search className="h-4 w-4 text-white" />
            </div>
            <FileText className="h-9 w-9 text-gray-400 transition-colors group-hover:text-blue-600" />
          </div>
        </div>

        {/* Title + description */}
        <h3 className="text-lg sm:text-xl font-black text-gray-900">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-gray-500 leading-relaxed">
          {description}
        </p>

        {/* What you'll see */}
        <div className="mt-7 w-full max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {bullets.map((b, idx) => {
              const Icon = b.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/70 backdrop-blur px-4 py-3 text-left shadow-sm"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex-none">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-gray-700 leading-snug">
                    {b.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick tips */}
        <div className="mt-6 w-full max-w-xl rounded-2xl border border-gray-200 bg-white/60 backdrop-blur px-4 py-4 shadow-sm">
          <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
            <span className="h-1 w-1 rounded-full bg-gray-300" />
            Helpful tips
            <span className="h-1 w-1 rounded-full bg-gray-300" />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {tips.map((t, idx) => {
              const Icon = t.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-xl bg-gray-50/70 border border-gray-100 px-3 py-2 text-left"
                >
                  <Icon className="h-4 w-4 text-gray-400 mt-0.5 flex-none" />
                  <p className="text-[11px] font-semibold text-gray-600 leading-snug">
                    {t.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-5 text-[11px] text-gray-400">
          Select a request to unlock approve/reject actions and view full
          details.
        </p>
      </div>
    </div>
  );
};

export default EmployeePlaceholder;
