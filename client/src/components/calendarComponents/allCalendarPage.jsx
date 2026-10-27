import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllCalendarEvents } from "../../api/calendar";
import SharedCalendarView from "./sharedCalendarView";
import { toast } from "react-toastify";

import Breadcrumbs from "../breadCrumbs";
import ThemeSync from "../themeSync";
import ScrollbarsSync from "../../components/scrollbarSync";
import { AlertTriangle, CalendarDays, RotateCcw } from "lucide-react";

// Statuses where nobody is actually away; hidden until switched on in the legend
const HIDDEN_BY_DEFAULT = ["REJECTED", "CANCELLED", "REVOKED"];

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold cursor-pointer select-none shadow-sm " +
  "bg-[color:var(--app-surface)] border-[color:var(--app-border)] text-[color:var(--accent)] " +
  "hover:bg-[color:var(--accent-soft)] active:scale-95 transition-[background-color,transform] duration-150 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] " +
  "disabled:cursor-progress disabled:opacity-70 disabled:active:scale-100 disabled:hover:bg-[color:var(--app-surface)]";

// The service sends details.employeeName; older responses only have
// "CTO - Juan Dela Cruz" in the title.
const employeeNameOf = (item) => {
  const fromDetails = item.details?.employeeName;
  if (typeof fromDetails === "string" && fromDetails.trim()) {
    return fromDetails.trim();
  }
  const title = String(item.title || "");
  const separator = title.indexOf(" - ");
  return (
    (separator >= 0 ? title.slice(separator + 3) : "").trim() || "Employee"
  );
};

const toCalendarEvent = (item) => ({
  ...item,
  title: `[${item.type === "CTO" ? "CTO" : "WLN"}] ${employeeNameOf(item)}`,
  start: new Date(item.date),
  end: new Date(item.date),
  allDay: true,
});

/* =========================
   UI Primitives
========================= */
const Card = ({ children }) => (
  <div
    className="rounded-xl shadow-sm overflow-hidden border transition-colors duration-300 ease-out"
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: "var(--app-border)",
    }}
  >
    {children}
  </div>
);

// Shown instead of an empty calendar, which would look like "nobody's on leave"
const LoadError = ({ onRetry, isRetrying }) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center text-center gap-4 rounded-xl border border-dashed px-6 py-16"
    style={{
      borderColor: "var(--app-border)",
      backgroundColor: "var(--app-surface-2)",
    }}
  >
    <span
      className="inline-flex items-center justify-center w-11 h-11 rounded-full"
      style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#ef4444" }}
    >
      <AlertTriangle className="w-5 h-5" />
    </span>
    <div>
      <div className="text-sm font-bold" style={{ color: "var(--app-text)" }}>
        Couldn&apos;t load the company calendar
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--app-muted)" }}>
        Something went wrong while loading leave schedules. Please try again.
      </div>
    </div>
    <button
      type="button"
      onClick={onRetry}
      disabled={isRetrying}
      className={BTN_SECONDARY}
    >
      <RotateCcw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
      {isRetrying ? "Retrying..." : "Retry"}
    </button>
  </div>
);

const CompanyCalendarPage = () => {
  const {
    data: events = [],
    isLoading,
    isFetching,
    isError,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["company-calendar-events"],
    queryFn: async () => {
      const res = await getAllCalendarEvents();
      return (res?.data || []).map(toCalendarEvent);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  // Never loaded successfully (as opposed to a failed refresh of good data)
  const showLoadError = isError && !dataUpdatedAt;

  const handleRefresh = async () => {
    // refetch() doesn't throw on failure, so check the result instead
    const result = await refetch();
    if (result.isError) {
      toast.error(
        result.data
          ? "Couldn't refresh the company calendar. Showing the last loaded schedule."
          : "Still couldn't load the company calendar. Please try again.",
      );
    }
  };

  return (
    <div
      className="w-full max-w-7xl mx-auto flex-1 flex h-full flex-col transition-colors duration-300 ease-out cto-scrollbar"
      style={{
        backgroundColor: "var(--app-bg, rgba(245,245,245,0.80))",
        color: "var(--app-text, #0f172a)",
      }}
    >
      <ThemeSync />
      <ScrollbarsSync />

      <div className="px-1 w-full py-2 pb-6">
        <Breadcrumbs
          items={[
            {
              label: "COMPANY CALENDAR",
              to: "/app/company-calendar",
            },
          ]}
        />

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mt-2">
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight transition-colors duration-300 ease-out"
              style={{ color: "var(--app-text)" }}
            >
              All Personnel <span className="font-bold">Leave Calendar</span>
            </h1>

            <p
              className="text-sm mt-1 transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              View approved, pending, and upcoming leave schedules across the
              organization.
            </p>
          </div>

          <div className="flex items-center gap-3 md:flex-col md:items-end md:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isFetching}
              className={BTN_SECONDARY}
            >
              <RotateCcw
                className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
              />
              {isFetching ? "Refreshing..." : "Refresh"}
            </button>
            {dataUpdatedAt > 0 && (
              <span className="text-xs" style={{ color: "var(--app-muted)" }}>
                Updated {TIME_FMT.format(dataUpdatedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Calendar Container */}
        <div className="mt-5">
          <Card>
            <div
              className="px-4 py-3 border-b transition-colors duration-300 ease-out flex items-center gap-2.5"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "var(--app-border)",
              }}
            >
              <CalendarDays
                className="w-4 h-4 shrink-0"
                style={{ color: "var(--app-muted)" }}
              />
              <div className="min-w-0">
                <div
                  className="text-sm font-semibold transition-colors duration-300 ease-out"
                  style={{ color: "var(--app-text)" }}
                >
                  All personnel leave schedule
                </div>
                <div className="text-xs" style={{ color: "var(--app-muted)" }}>
                  Click a name to see the leave details.
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4 md:p-6">
              {showLoadError ? (
                <LoadError onRetry={handleRefresh} isRetrying={isFetching} />
              ) : (
                <SharedCalendarView
                  events={events}
                  variant="personal"
                  isLoading={isLoading}
                  filterable
                  defaultHiddenStatuses={HIDDEN_BY_DEFAULT}
                  showOnLeaveToday
                  mergeConsecutiveDays
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CompanyCalendarPage;
