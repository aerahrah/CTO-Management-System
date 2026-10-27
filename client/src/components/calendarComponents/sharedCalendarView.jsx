import React, {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ChevronDown,
  Briefcase,
  CalendarDays,
  Clock,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Modal from "../modal";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";

// IMPORT YOUR SETTINGS FETCH FUNCTION HERE
import { fetchWorkingDaysGeneralSettings } from "../../api/generalSettings";

// ------------------ Date Setup ------------------
const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// ------------------ Helper: Formatter & Colors ------------------
const formatStatusLabel = (status) => {
  if (status === "REVOCATION_REQUESTED") return "Pending Revocation";
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

const getEventColor = (status) => {
  switch (status) {
    case "APPROVED":
      return "#16a34a"; // Green
    case "PENDING":
      return "#d97706"; // Amber
    case "REJECTED":
      return "#ef4444"; // Red
    case "CANCELLED":
      return "#94a3b8"; // Slate 400 (Lighter gray to distinguish from revoked)
    case "REVOCATION_REQUESTED":
      return "#9333ea"; // Purple
    case "REVOKED":
      return "#334155"; // Slate 700 (Dark solid gray)
    default:
      return "#3b82f6"; // Default Blue
  }
};

// ------------------ Legend / filter options ------------------
const STATUS_OPTIONS = [
  { status: "APPROVED", label: "Approved" },
  { status: "PENDING", label: "Pending" },
  { status: "REVOCATION_REQUESTED", label: "Pending Revocation" },
  { status: "REJECTED", label: "Rejected" },
  { status: "CANCELLED", label: "Cancelled" },
  { status: "REVOKED", label: "Revoked" },
];

const TYPE_OPTIONS = [
  { type: "CTO", tag: "[CTO]", label: "Time-Off" },
  { type: "Wellness", tag: "[WLN]", label: "Wellness" },
];

const NO_STATUSES = [];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--app-surface)]";

// Number of distinct applications (events are one per day)
const countApplications = (events) =>
  new Set(events.map((e) => `${e.type}:${e.id}`)).size;

// ------------------ Merge back-to-back days into one bar ------------------
const startOfLocalDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const nextLocalDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

// Joins consecutive days of the same application into one all-day event, so a
// 5-day leave is one bar instead of 5 chips. `runDates` keeps the covered days.
// Gaps (e.g. Fri + Mon) stay separate bars so weekends never look like leave.
const mergeConsecutiveDayEvents = (events) => {
  const merged = [];
  const groups = new Map();

  events.forEach((e) => {
    if (e.id == null || !(e.start instanceof Date)) {
      merged.push(e);
      return;
    }
    const key = `${e.type}:${e.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });

  groups.forEach((group) => {
    const sorted = [...group].sort((a, b) => a.start - b.start);
    let run = [];

    const flush = () => {
      if (!run.length) return;
      const first = run[0];
      const lastDay = startOfLocalDay(run[run.length - 1].start);
      merged.push({
        ...first,
        start: startOfLocalDay(first.start),
        end: nextLocalDay(lastDay), // exclusive: the bar stops after lastDay
        allDay: true,
        runDates: run.map((e) => startOfLocalDay(e.start)),
      });
      run = [];
    };

    sorted.forEach((e) => {
      const prev = run[run.length - 1];
      if (prev && dayKey(prev.start) === dayKey(e.start)) return; // same day twice
      if (prev && dayKey(nextLocalDay(prev.start)) !== dayKey(e.start)) flush();
      run.push(e);
    });
    flush();
  });

  return merged;
};

// ------------------ Event details (shown in a modal on click) ------------------
// Lets the agenda (List) view's custom event open the same modal.
const OpenEventContext = createContext(() => {});

const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const TYPE_LABEL = { CTO: "CTO · Time-Off", Wellness: "Wellness Leave" };

const toDate = (value) => {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Plain text only (some fields may be populated objects)
const textOf = (value) => {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value?.name === "string") return value.name;
  return null;
};

// Pages reshape titles ("[CTO] Juan Dela Cruz"), so prefer the raw name
const employeeNameOf = (event) =>
  textOf(event.details?.employeeName) ||
  String(event.title || "")
    .replace(/^\[(CTO|WLN)\]\s*/, "")
    .replace(/^(CTO|Wellness)\s*-\s*/, "")
    .trim() ||
  "Employee";

// Every date of the clicked application, sorted, one per day
const datesOfApplication = (event, events) => {
  const fromService = event.details?.dates;
  const raw =
    Array.isArray(fromService) && fromService.length > 0
      ? fromService
      : events
          .filter((e) => e.id === event.id && e.type === event.type)
          .map((e) => e.start ?? e.date);

  const seen = new Set();
  return raw
    .map(toDate)
    .filter(Boolean)
    .sort((a, b) => a - b)
    .filter((d) => {
      const key = dayKey(d);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const SectionLabel = ({ children }) => (
  <div
    className="text-[10px] font-bold uppercase tracking-wider mb-2"
    style={{ color: "var(--app-muted)" }}
  >
    {children}
  </div>
);

const InfoTile = ({ icon: Icon, label, value }) => (
  <div
    className="rounded-lg border p-3 min-w-0"
    style={{
      backgroundColor: "var(--app-surface-2)",
      borderColor: "var(--app-border)",
    }}
  >
    <div
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ color: "var(--app-muted)" }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
    </div>
    <div
      className="mt-1 text-sm font-bold truncate"
      style={{ color: "var(--app-text)" }}
      title={value}
    >
      {value}
    </div>
  </div>
);

// One date of the leave, tinted with the leave's status color (same color as
// its chip on the calendar). The clicked day gets a stronger tint and a ring.
const DatePill = ({ date, color, isClicked, clickedLabel }) => (
  <span
    className="inline-flex items-center gap-2 rounded-lg border py-1 pl-1 pr-3 text-sm font-semibold tabular-nums"
    style={{
      backgroundColor: `color-mix(in srgb, ${color} ${isClicked ? 18 : 9}%, var(--app-surface))`,
      borderColor: isClicked
        ? color
        : `color-mix(in srgb, ${color} 32%, var(--app-surface))`,
      boxShadow: isClicked ? `0 0 0 1px ${color}` : undefined,
      color: "var(--app-text)",
    }}
    title={isClicked ? clickedLabel : undefined}
  >
    <span
      className="inline-flex items-center justify-center min-w-[2.75rem] rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider shadow-sm"
      // Slightly deeper than the status color so white text stays readable
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 88%, #000)`,
        color: "#ffffff",
      }}
    >
      {WEEKDAY_FMT.format(date)}
    </span>
    {DATE_FMT.format(date)}
  </span>
);

const LeaveEventDetails = ({ event, events, applicationHref }) => {
  const details = event.details || {};
  const name = employeeNameOf(event);
  const subtitle = [textOf(details.position), textOf(details.division)]
    .filter(Boolean)
    .join(" · ");
  const dates = datesOfApplication(event, events);
  // Day(s) the user clicked: one day, or every day of a merged bar
  const clickedKeys = new Set(
    (event.runDates?.length
      ? event.runDates
      : [toDate(event.start ?? event.date)]
    )
      .filter(Boolean)
      .map(dayKey),
  );
  const filedAt = toDate(details.filedAt);
  const reason = textOf(details.reason);
  const revocationReason = textOf(details.revocationReason);
  const revokeRemarks = textOf(details.revokeRemarks);
  const statusColor = getEventColor(event.status);
  // Only worth pointing out when it's part of the leave, not all of it
  const showClicked = clickedKeys.size > 0 && clickedKeys.size < dates.length;
  const clickedLabel =
    clickedKeys.size === 1 ? "Day you clicked" : "Days you clicked";

  return (
    <div className="space-y-5 p-1 sm:p-2">
      {/* Who + status */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-lg font-bold leading-tight [overflow-wrap:anywhere]"
            style={{ color: "var(--app-text)" }}
          >
            {name}
          </div>
          {subtitle && (
            <div
              className="mt-0.5 text-sm [overflow-wrap:anywhere]"
              style={{ color: "var(--app-muted)" }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm flex-none"
          style={{
            backgroundColor: statusColor,
            color: "#ffffff",
          }}
        >
          {formatStatusLabel(event.status)}
        </span>
      </div>

      {/* Key facts */}
      <div
        className={`grid grid-cols-2 gap-2 ${filedAt ? "sm:grid-cols-3" : ""}`}
      >
        <InfoTile
          icon={Briefcase}
          label="Leave type"
          value={TYPE_LABEL[event.type] || event.type || "—"}
        />
        <InfoTile
          icon={Clock}
          label="Duration"
          value={textOf(details.duration) || "—"}
        />
        {filedAt && (
          <InfoTile
            icon={CalendarDays}
            label="Filed"
            value={DATE_FMT.format(filedAt)}
          />
        )}
      </div>

      {/* Every date of this leave; the clicked day is highlighted */}
      {dates.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--app-muted)" }}
            >
              Dates covered ({dates.length}{" "}
              {dates.length === 1 ? "day" : "days"})
            </span>
            {showClicked && (
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-medium"
                style={{ color: "var(--app-muted)" }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-[3px]"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${statusColor} 18%, var(--app-surface))`,
                    boxShadow: `0 0 0 1.5px ${statusColor}`,
                  }}
                />
                {clickedLabel}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {dates.map((date) => (
              <DatePill
                key={dayKey(date)}
                date={date}
                color={statusColor}
                isClicked={showClicked && clickedKeys.has(dayKey(date))}
                clickedLabel={clickedLabel}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reason */}
      <div>
        <SectionLabel>Reason</SectionLabel>
        <p
          className="rounded-lg border px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]"
          style={{
            backgroundColor: "var(--app-surface-2)",
            borderColor: "var(--app-border)",
            color: reason ? "var(--app-text)" : "var(--app-muted)",
          }}
        >
          {reason || "No reason provided."}
        </p>
      </div>

      {/* Revocation info, when there is any */}
      {(revocationReason || revokeRemarks) && (
        <div
          className="rounded-lg border px-3 py-2.5 space-y-2.5"
          style={{
            backgroundColor: "color-mix(in srgb, #9333ea 8%, transparent)",
            borderColor: "color-mix(in srgb, #9333ea 30%, transparent)",
          }}
        >
          {[
            ["Revocation reason", revocationReason],
            ["HR note", revokeRemarks],
          ]
            .filter(([, text]) => text)
            .map(([label, text]) => (
              <div key={label}>
                <div
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    color: "color-mix(in srgb, #9333ea 80%, var(--app-text))",
                  }}
                >
                  {label}
                </div>
                <p
                  className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]"
                  style={{ color: "var(--app-text)" }}
                >
                  {text}
                </p>
              </div>
            ))}
        </div>
      )}

      {/* Straight to the application (only where the viewer owns it) */}
      {applicationHref && (
        <div className="flex justify-end pt-1">
          <Link
            to={applicationHref}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold text-white cursor-pointer select-none shadow-sm bg-[color:var(--accent)] hover:brightness-90 active:brightness-[0.82] active:scale-95 transition-[filter,transform] duration-150 ease-out ${FOCUS_RING}`}
          >
            Open application
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
};

// ------------------ Custom Agenda Event Component ------------------
const CustomAgendaEvent = ({ event }) => {
  const openEvent = useContext(OpenEventContext);
  const backgroundColor = getEventColor(event.status);

  // If this is a revocation or revoked event, we might want to prioritize the revocation reason
  const displayReason =
    event.details?.revocationReason || event.details?.reason;

  return (
    <div className="flex flex-col items-start justify-center">
      <button
        type="button"
        onClick={(e) => {
          // The row may also select the event; open once
          e.stopPropagation();
          openEvent(event);
        }}
        title="View details"
        className="px-2.5 py-1 rounded-md text-xs font-bold tracking-wide shadow-sm cursor-pointer transition-[filter,transform] duration-150 ease-out hover:brightness-90 active:brightness-[0.82] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-surface)]"
        style={{ backgroundColor, color: "#ffffff" }}
      >
        {event.title}
      </button>
      {displayReason && (
        <span
          className="text-xs mt-1 opacity-70"
          style={{ color: "var(--app-text)" }}
        >
          {displayReason}
        </span>
      )}
    </div>
  );
};

// ------------------ Month / week / day event label ------------------
// Phones: first name only in the narrow day cells ("Ana" for "Ana Cruz")
const shortNameOf = (event) => {
  const parts = employeeNameOf(event).split(/\s+/).filter(Boolean);
  // Keep abbreviations readable ("Ma. Cristina", "Jo Ann")
  if (parts.length > 1 && (/\.$/.test(parts[0]) || parts[0].length <= 2)) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] || "Leave";
};

// Calendar events aren't focusable on their own; this makes each one
// reachable by Tab and opens the details with Enter or Space.
const CalendarEventLabel = ({ event, title }) => {
  const openEvent = useContext(OpenEventContext);
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`View details: ${title}`}
      className="outline-none"
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        openEvent(event);
      }}
    >
      <span className="cal-label-full">{title}</span>
      <span className="cal-label-short">{shortNameOf(event)}</span>
    </span>
  );
};

// ------------------ Full-day block (fillDayCells, Month view) ------------------
// For single-person calendars: the leave fills the day under the date number
// and shows what it is (type · duration) and its status, instead of a name.
const FullDayEventLabel = ({ event }) => {
  const openEvent = useContext(OpenEventContext);
  const color = getEventColor(event.status);
  const typeLabel =
    event.type === "CTO"
      ? "CTO"
      : event.type === "Wellness"
        ? "Wellness"
        : event.type || "Leave";
  const duration = textOf(event.details?.duration);
  const status = formatStatusLabel(event.status);

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`View details: ${typeLabel}${duration ? `, ${duration}` : ""}, ${status}`}
      className="flex h-full min-h-0 flex-col justify-between gap-1 overflow-hidden outline-none"
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        openEvent(event);
      }}
    >
      <span className="flex min-w-0 items-center gap-1">
        {/* Shown instead of the badge when the block is short or narrow */}
        <span
          className="cal-fill-dot w-2 h-2 rounded-full flex-none"
          style={{ backgroundColor: color }}
        />
        <span className="cal-fill-type font-bold truncate">{typeLabel}</span>
        <span className="cal-fill-short text-[10px] font-bold tracking-wide">
          {event.type === "CTO" ? "CTO" : "WLN"}
        </span>
        {duration && (
          <span
            className="cal-fill-duration truncate font-semibold"
            style={{ color: "var(--app-muted)" }}
          >
            · {duration}
          </span>
        )}
      </span>
      <span
        className="cal-fill-badge self-start max-w-full truncate rounded-full px-1.5 text-[9px] font-bold uppercase leading-4 tracking-wider"
        style={{ backgroundColor: color, color: "#ffffff" }}
      >
        {status}
      </span>
    </span>
  );
};

// Month view weekday headers: full names, or "Sun"-style names on phones
const WeekdayHeader = ({ date, label, localizer }) => (
  <span role="columnheader" aria-sort="none">
    <span className="cal-label-full">{label}</span>
    <span className="cal-label-short">{localizer.format(date, "EEE")}</span>
  </span>
);

// Stable object so the calendar doesn't re-create its views every render
const CALENDAR_COMPONENTS = {
  event: CalendarEventLabel,
  month: { header: WeekdayHeader },
  agenda: {
    event: CustomAgendaEvent,
  },
};

const FILL_COMPONENTS = {
  event: FullDayEventLabel,
  month: { header: WeekdayHeader },
  agenda: {
    event: CustomAgendaEvent,
  },
};

// ------------------ "On leave today" strip ------------------
const TODAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

// `events` are the visible one-per-day events; clicking a name opens details.
// Large calendars show the first `limit` names and expand inline for the rest.
const OnLeaveToday = ({ events, onOpen, limit = 12 }) => {
  const [expanded, setExpanded] = useState(false);
  const today = new Date();
  const todayKey = dayKey(today);

  const seen = new Set();
  const people = events
    .filter((e) => e.start instanceof Date && dayKey(e.start) === todayKey)
    .filter((e) => {
      const key = `${e.type}:${e.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => employeeNameOf(a).localeCompare(employeeNameOf(b)));

  const hiddenCount = Math.max(people.length - limit, 0);
  const shownPeople = expanded ? people : people.slice(0, limit);

  return (
    <div
      className="w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border p-3 sm:p-4"
      style={{
        backgroundColor: "var(--app-surface)",
        borderColor: "var(--app-border)",
      }}
    >
      <div
        className="flex items-center gap-3 shrink-0 sm:pr-4 sm:border-r"
        style={{ borderColor: "var(--app-border)" }}
      >
        <span
          className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-lg"
          style={{
            backgroundColor: "var(--accent-soft)",
            color: "var(--accent)",
          }}
        >
          <Users className="w-4 h-4" />
        </span>
        <div className="flex flex-wrap items-baseline gap-x-2 sm:block">
          <div
            className="text-sm font-bold"
            style={{ color: "var(--app-text)" }}
          >
            On leave today
            {people.length > 0 && (
              <span className="ml-1.5" style={{ color: "var(--app-muted)" }}>
                · {people.length}
              </span>
            )}
          </div>
          <div className="text-xs" style={{ color: "var(--app-muted)" }}>
            {TODAY_FMT.format(today)}
          </div>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="text-sm" style={{ color: "var(--app-muted)" }}>
          No one is on leave today.
        </div>
      ) : (
        <div className="cal-scroll-x flex flex-nowrap sm:flex-wrap gap-1.5 min-w-0 overflow-x-auto sm:overflow-visible -mx-3 px-3 sm:mx-0 sm:px-0">
          {shownPeople.map((e) => {
            const color = getEventColor(e.status);
            return (
              <button
                key={`${e.type}:${e.id}`}
                type="button"
                onClick={() => onOpen(e)}
                title={`${formatStatusLabel(e.status)} · ${TYPE_LABEL[e.type] || e.type} — view details`}
                className={`inline-flex shrink-0 items-center gap-1.5 max-w-full rounded-full border pl-2 pr-2.5 py-0.5 text-xs font-semibold cursor-pointer select-none bg-[color:var(--chip-bg)] hover:bg-[color:var(--chip-hover)] active:scale-95 transition-[background-color,transform] duration-150 ease-out ${FOCUS_RING}`}
                style={{
                  "--chip-bg": `color-mix(in srgb, ${color} 8%, var(--app-surface))`,
                  "--chip-hover": `color-mix(in srgb, ${color} 18%, var(--app-surface))`,
                  borderColor: `color-mix(in srgb, ${color} 35%, var(--app-surface))`,
                  color: "var(--app-text)",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-none"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate">{employeeNameOf(e)}</span>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider flex-none"
                  style={{ color: "var(--app-muted)" }}
                >
                  {e.type === "CTO" ? "CTO" : "WLN"}
                </span>
              </button>
            );
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-bold cursor-pointer select-none bg-[color:var(--app-surface)] hover:bg-[color:var(--accent-soft)] active:scale-95 transition-[background-color,transform] duration-150 ease-out ${FOCUS_RING}`}
              style={{
                borderColor: "var(--app-border)",
                color: "var(--accent)",
              }}
            >
              {expanded ? "Show less" : `+${hiddenCount} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ------------------ Legend chip (a filter toggle when filterable) ------------------
const FilterChip = ({ active, onToggle, label, dotColor, tag, count }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onToggle}
    title={active ? `Hide ${label}` : `Show ${label}`}
    className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs sm:text-sm cursor-pointer select-none bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-2)] active:scale-95 transition-[background-color,opacity,transform] duration-150 ease-out ${FOCUS_RING}`}
    style={{
      borderColor:
        active && dotColor
          ? `color-mix(in srgb, ${dotColor} 40%, var(--app-border))`
          : "var(--app-border)",
      opacity: active ? 1 : 0.55,
    }}
  >
    {dotColor && (
      <span
        className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-none"
        style={
          active
            ? { backgroundColor: dotColor }
            : { boxShadow: `inset 0 0 0 2px ${dotColor}` }
        }
      />
    )}
    {tag && (
      <span className="font-bold" style={{ color: "var(--app-text)" }}>
        {tag}
      </span>
    )}
    <span
      className={`font-medium ${active ? "" : "line-through"}`}
      style={{ color: tag ? "var(--app-muted)" : "var(--app-text)" }}
    >
      {label}
    </span>
    {count != null && (
      <span
        className="text-xs tabular-nums"
        style={{ color: "var(--app-muted)" }}
      >
        {count}
      </span>
    )}
  </button>
);

// ------------------ "+N more" label in month cells ------------------
// Colored dots preview the statuses of the hidden leaves; hover lists them.
const ShowMoreLabel = ({ count, hidden }) => {
  const colors = [...new Set(hidden.map((e) => getEventColor(e.status)))].slice(
    0,
    4,
  );
  return (
    <span
      className="flex flex-1 items-center gap-1.5 min-w-0"
      title={hidden.length ? hidden.map((e) => e.title).join("\n") : undefined}
    >
      {colors.length > 0 && (
        <span className="cal-more-dots inline-flex items-center -space-x-0.5 flex-none">
          {colors.map((color) => (
            <span
              key={color}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: color,
                boxShadow: "0 0 0 1.5px var(--app-surface)",
              }}
            />
          ))}
        </span>
      )}
      <span className="truncate">
        +{count}
        <span className="cal-more-word"> more</span>
      </span>
    </span>
  );
};

// ------------------ Calendar Theme Overrides ------------------
const CalendarThemeStyles = () => (
  <style>
    {`
      .rbc-calendar {
        font-family: inherit;
        color: var(--app-text);
        height: 650px; 
      }

      /* Month view: every week gets the same fixed height, sized so each day
         shows up to 3 leaves and then "+N more". The calendar grows to fit. */
      .rbc-calendar.cal-month-fit {
        height: auto;
      }
      .cal-month-fit .rbc-month-view {
        flex: none;
        height: auto;
      }
      .cal-month-fit .rbc-month-row {
        flex: none;
        /* date row 24px + 4 rows x 20px (3 leaves + "+N more") + slack.
           For 5 names use 150px; each extra name needs +20px. */
        height: 110px;
      }
      .rbc-month-view .rbc-date-cell {
        padding: 4px 8px 2px;
        line-height: 18px;
      }
      .rbc-month-view .rbc-row-segment {
        padding: 0 3px 2px;
      }
      .rbc-month-view .rbc-event {
        height: 18px;
        padding: 0 6px;
        font-size: 11px;
        line-height: 18px;
        box-sizing: border-box;
      }
      
      .rbc-overlay {
        background-color: var(--app-surface);
        border: 1px solid var(--app-border);
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        padding: 0.5rem;
        z-index: 40; /* stays under the details modal */
        min-width: 220px;
        max-height: 340px;
        overflow-y: auto;
      }
      .rbc-overlay > * + * {
        margin-top: 3px;
      }
      .rbc-overlay-header {
        font-weight: 700;
        border-bottom: 1px solid var(--app-border);
        padding: 0.5rem 0;
        margin: -0.5rem 0 0.5rem;
        color: var(--app-text);
        position: sticky;
        top: -0.5rem;
        z-index: 1;
        background-color: var(--app-surface);
      }
      
      /* Headers (Sun, Mon, Tue...) */
      .rbc-header {
        border-bottom: 1px solid var(--app-border) !important;
        border-left: 1px solid var(--app-border) !important;
        padding: 10px 0;
        font-weight: 700;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--app-muted);
        background-color: var(--app-surface);
      }
      .rbc-header + .rbc-header {
        border-left: 1px solid var(--app-border) !important;
      }

      .rbc-month-view, .rbc-time-view, .rbc-day-view {
        border: 1px solid var(--app-border) !important;
        background-color: var(--app-surface);
        border-radius: 0.5rem;
        overflow: hidden;
      }

      .rbc-agenda-view {
        border: 1px solid var(--app-border) !important;
        background-color: var(--app-surface);
        border-radius: 0.5rem;
        overflow-y: auto !important; 
      }

      .rbc-day-bg, .rbc-month-row, .rbc-time-header-content {
        border-color: var(--app-border) !important;
      }
      .rbc-day-bg + .rbc-day-bg {
        border-left: 1px solid var(--app-border) !important;
      }
      
      /* Off-range (Days from previous/next month) */
      .rbc-off-range-bg {
        background-color: var(--app-surface-2);
      }
      .rbc-off-range .rbc-date-cell {
        color: var(--app-muted);
        opacity: 0.5;
      }

      /* Today */
      .rbc-today {
        background-color: var(--accent-soft) !important;
      }

      /* Dates */
      .rbc-date-cell {
        padding: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--app-text);
      }

      /* Toolbar */
      .rbc-toolbar {
        margin-bottom: 1.25rem;
      }
      .rbc-toolbar button {
        color: var(--app-text);
        border: 1px solid var(--app-border);
        background-color: var(--app-surface);
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 0.2s;
      }
      .rbc-toolbar button:active, .rbc-toolbar button.rbc-active {
        background-color: var(--accent);
        color: white;
        border-color: var(--accent);
        box-shadow: none;
      }
      .rbc-toolbar button:hover:not(.rbc-active) {
        background-color: var(--app-surface-2);
      }
      .rbc-toolbar-label {
        font-weight: 700;
        font-size: 1.125rem;
        color: var(--app-text);
      }

      /* Events */
      .rbc-event {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        border: none !important;
        cursor: pointer;
        transition: transform 0.15s ease-out, filter 0.15s ease-out;
      }
      .rbc-event:hover {
        transform: scale(1.02);
        filter: brightness(0.9);
        z-index: 10;
      }
      .rbc-event:active {
        filter: brightness(0.82);
      }
      /* Keyboard focus ring only (no outline on mouse click) */
      .rbc-event:focus {
        outline: none;
      }
      .rbc-event:focus-visible,
      .rbc-event:has(:focus-visible) {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .rbc-show-more {
        cursor: pointer;
      }
      /* fillDayCells: each leave fills its day (Month view). Rows that hold
         real leaves stretch to the cell height; rbc's hidden measuring row
         has no .cal-fill-event, so the "+N more" math is unaffected. */
      .cal-fill .rbc-month-row .rbc-row-content {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .cal-fill .rbc-month-row .rbc-row-content > .rbc-row:has(.cal-fill-event) {
        flex: 1 1 0;
        min-height: 0;
      }
      .cal-fill .rbc-month-row .rbc-row:has(.cal-fill-event) > .rbc-row-segment {
        display: flex;
        flex-direction: column;
        padding: 0 4px 4px;
      }
      .cal-fill .rbc-month-view .rbc-event.cal-fill-event {
        flex: 1 1 auto;
        height: auto;
        min-height: 0;
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 12px;
        line-height: 1.25;
      }
      .cal-fill .rbc-event.cal-fill-event .rbc-event-content {
        height: 100%;
        white-space: normal;
        container-type: size;
      }
      .cal-fill-dot,
      .cal-fill-short {
        display: none;
      }
      @media (max-width: 640px) {
        .cal-fill .rbc-month-view .rbc-event.cal-fill-event {
          padding: 4px 4px 4px 6px;
        }
      }
      /* Short blocks (two leaves on one day): status dot instead of badge */
      @container (max-height: 40px) {
        .cal-fill-badge {
          display: none !important;
        }
        .cal-fill-dot {
          display: inline-block;
        }
      }
      /* Narrow cells (phones): just a short type tag; the block's tint and
         colored edge already show the status */
      @container (max-width: 72px) {
        .cal-fill-badge,
        .cal-fill-duration,
        .cal-fill-type,
        .cal-fill-dot {
          display: none !important;
        }
        .cal-fill-short {
          display: inline;
        }
      }
      .cal-fill .rbc-event.cal-fill-event:hover {
        transform: none;
        filter: brightness(0.96);
      }

      .rbc-month-view .rbc-show-more {
        display: flex;
        align-items: center;
        width: 100%;
        height: 18px;
        padding: 0 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        line-height: 18px;
        color: var(--accent);
        background-color: var(--accent-soft);
        white-space: nowrap;
        overflow: hidden;
        transition: background-color 0.15s ease-out, transform 0.15s ease-out;
      }
      .rbc-month-view .rbc-show-more:hover,
      .rbc-month-view .rbc-show-more:focus {
        color: var(--accent);
        text-decoration: none;
        background-color: color-mix(in srgb, var(--accent) 22%, var(--app-surface));
      }
      .rbc-month-view .rbc-show-more:active {
        transform: scale(0.97);
      }
      .rbc-show-more:focus {
        outline: none;
      }
      .rbc-show-more:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
      .rbc-agenda-event-cell {
        cursor: pointer;
      }

      /* =========================================
         AGENDA (LIST) VIEW OVERRIDES
      ========================================= */
      .rbc-agenda-view table.rbc-agenda-table {
        border: none !important;
        background-color: var(--app-surface);
      }
      
      .rbc-agenda-view table.rbc-agenda-table thead > tr > th {
        border-bottom: 1px solid var(--app-border) !important;
        padding: 12px 16px;
        text-align: left;
        font-weight: 700;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--app-muted);
        background-color: var(--app-surface); 
        border-right: none !important;
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
        padding: 14px 16px;
        border-bottom: 1px solid var(--app-border) !important;
        border-right: none !important;
        vertical-align: middle;
        background-color: var(--app-surface) !important; 
        transition: background-color 0.2s ease;
      }

      .rbc-agenda-view table.rbc-agenda-table tbody > tr:hover td {
        background-color: var(--app-surface-2) !important;
      }

      .rbc-agenda-date-cell {
        font-weight: 600;
        color: var(--app-text) !important;
        font-size: 0.875rem;
        white-space: nowrap;
      }

      .rbc-agenda-time-cell {
        font-weight: 500;
        color: var(--app-muted) !important;
        font-size: 0.875rem;
        white-space: nowrap;
      }

      .rbc-agenda-empty {
        color: var(--app-muted);
        font-weight: 500;
        padding: 2rem;
        background-color: var(--app-surface);
      }

      /* Horizontal scroller without a visible scrollbar */
      .cal-scroll-x {
        scrollbar-width: none;
      }
      .cal-scroll-x::-webkit-scrollbar {
        display: none;
      }

      /* Short labels are only used on phones */
      .cal-label-short {
        display: none;
      }

      /* =========================================
         PHONES / SMALL TABLETS
      ========================================= */
      @media (max-width: 767px) {
        /* Toolbar: month on its own line, buttons on one row below */
        .rbc-toolbar {
          flex-direction: row;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .rbc-toolbar .rbc-toolbar-label {
          order: -1;
          flex: 1 0 100%;
          padding: 0;
          text-align: left;
          font-size: 1rem;
        }
      }
      @media (max-width: 640px) {
        .rbc-toolbar button {
          padding: 0.3rem 0.65rem;
          font-size: 0.8rem;
        }
        .rbc-header {
          padding: 6px 0;
          font-size: 0.625rem;
          letter-spacing: 0;
        }
        .rbc-month-view .rbc-date-cell {
          padding: 3px 5px 1px;
          font-size: 0.75rem;
        }
        .rbc-month-view .rbc-row-segment {
          padding: 0 1px 2px;
        }
        .rbc-month-view .rbc-event {
          padding: 0 4px;
          font-size: 10px;
        }
        /* First names in the narrow day cells; full titles in the popup */
        .cal-label-full {
          display: none;
        }
        .cal-label-short {
          display: inline;
        }
        .rbc-overlay .cal-label-full {
          display: inline;
        }
        .rbc-overlay .cal-label-short {
          display: none;
        }
        /* "+3" instead of "+3 more" */
        .rbc-month-view .rbc-show-more {
          justify-content: center;
          padding: 0 2px;
        }
        .cal-more-word,
        .cal-more-dots {
          display: none !important;
        }
        /* List view: drop the Time column ("All Day") and tighten cells */
        .rbc-agenda-view table.rbc-agenda-table thead > tr > th:nth-child(2),
        .rbc-agenda-view table.rbc-agenda-table tbody > tr > td.rbc-agenda-time-cell {
          display: none;
        }
        .rbc-agenda-view table.rbc-agenda-table thead > tr > th,
        .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
          padding: 10px;
        }
        .rbc-agenda-date-cell {
          font-size: 0.8rem;
        }
      }
    `}
  </style>
);

/**
 * Optional features (all off by default, so existing calendars look the same):
 *  - filterable:            legend chips toggle statuses/types, plus a name search
 *  - defaultHiddenStatuses: statuses hidden until toggled on (with filterable)
 *  - showOnLeaveToday:      strip of who's on leave today, above the calendar
 *  - mergeConsecutiveDays:  back-to-back days of one leave show as one bar
 *  - searchable:            show the name search (with filterable; default on)
 *  - applicationLinkFor:    (event) => url; adds "Open application" to the modal
 *  - expandMonthRows:       Month view fits up to 3 leaves per day before
 *                           "+N more" (calendar grows taller). Default on;
 *                           false keeps the compact 650px month.
 *  - fillDayCells:          Month view: each leave fills its day (type ·
 *                           duration + status) instead of a name bar. For
 *                           single-person calendars like My Calendar.
 */
const SharedCalendarView = ({
  events = [],
  isLoading,
  variant = "all",
  filterable = false,
  defaultHiddenStatuses = NO_STATUSES,
  showOnLeaveToday = false,
  mergeConsecutiveDays = false,
  searchable = true,
  applicationLinkFor,
  expandMonthRows = true,
  fillDayCells = false,
}) => {
  const { data: settingsData } = useQuery({
    queryKey: ["workingDaysSettings"],
    queryFn: fetchWorkingDaysGeneralSettings,
    staleTime: 1000 * 60 * 5,
  });

  const activeWorkingDays = settingsData?.data?.activeWorkingDays || [
    1, 2, 3, 4, 5,
  ];

  const formattedEvents = useMemo(() => {
    return events.map((event) => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
    }));
  }, [events]);

  // Clicked event for the details modal. The event is kept after closing so
  // the modal doesn't empty out while it animates away.
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const openEvent = useCallback((event) => {
    setSelectedEvent(event);
    setIsDetailsOpen(true);
  }, []);

  const closeDetails = useCallback(() => setIsDetailsOpen(false), []);

  const eventPropGetter = (event) => {
    const color = getEventColor(event.status);
    // Full-day blocks: soft status tint with a colored edge
    if (fillDayCells && view === "month") {
      return {
        className: "cal-fill-event",
        style: {
          backgroundColor: `color-mix(in srgb, ${color} 16%, var(--app-surface))`,
          color: "var(--app-text)",
          boxShadow: `inset 3px 0 0 ${color}`,
        },
      };
    }
    return {
      style: {
        backgroundColor: color,
        color: "#ffffff",
      },
    };
  };

  const dayPropGetter = (date) => {
    // Full-day mode: tint the whole cell of a leave day in its status color
    const leaveColor = fillDayCells ? leaveDayColors.get(dayKey(date)) : null;
    if (leaveColor) {
      return {
        style: {
          backgroundColor: `color-mix(in srgb, ${leaveColor} 7%, var(--app-surface))`,
        },
      };
    }
    const day = date.getDay();
    if (!activeWorkingDays.includes(day)) {
      return {
        style: {
          backgroundColor: "var(--app-surface-2)",
        },
      };
    }
    return {};
  };

  const calendarMessages = {
    agenda: "List",
    noEventsInRange: "No events found in this date range.",
    showMore: (count, remainingEvents) => (
      <ShowMoreLabel
        count={count}
        hidden={Array.isArray(remainingEvents) ? remainingEvents : []}
      />
    ),
  };

  // With expandMonthRows, Month view grows to fit its fixed-height weeks;
  // other views (and compact calendars) keep 650px
  const [view, setView] = useState("month");

  const allowedViews =
    variant === "personal"
      ? ["month", "agenda"]
      : ["month", "week", "day", "agenda"];

  /* ---------- Filters (only when filterable) ---------- */
  const [hiddenStatuses, setHiddenStatuses] = useState(
    () => new Set(defaultHiddenStatuses),
  );
  const [hiddenTypes, setHiddenTypes] = useState(() => new Set());
  const [search, setSearch] = useState("");
  // Phones: the status/type chips stay folded behind a "Filters" button
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterPanelId] = useState(
    () => `cal-filters-${Math.random().toString(36).slice(2, 8)}`,
  );
  const query = useDeferredValue(search).trim().toLowerCase();

  const toggleIn = (setter, value) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const resetFilters = () => {
    setHiddenStatuses(new Set(defaultHiddenStatuses));
    setHiddenTypes(new Set());
    setSearch("");
  };

  const isFiltered =
    filterable &&
    (search.trim() !== "" ||
      hiddenTypes.size > 0 ||
      hiddenStatuses.size !== defaultHiddenStatuses.length ||
      defaultHiddenStatuses.some((s) => !hiddenStatuses.has(s)));

  // Type + name search; the status counts reflect these
  const facetEvents = useMemo(() => {
    if (!filterable) return formattedEvents;
    return formattedEvents.filter(
      (e) =>
        !hiddenTypes.has(e.type) &&
        (!searchable ||
          !query ||
          employeeNameOf(e).toLowerCase().includes(query)),
    );
  }, [filterable, searchable, formattedEvents, hiddenTypes, query]);

  // One event per day, after every filter (used by the strip and the calendar)
  const visibleDayEvents = useMemo(
    () =>
      filterable
        ? facetEvents.filter((e) => !hiddenStatuses.has(e.status))
        : formattedEvents,
    [filterable, facetEvents, formattedEvents, hiddenStatuses],
  );

  // Day -> status color of the (first) visible leave that day, for tinting
  const leaveDayColors = useMemo(() => {
    const colors = new Map();
    if (!fillDayCells) return colors;
    visibleDayEvents.forEach((e) => {
      if (!(e.start instanceof Date)) return;
      const key = dayKey(e.start);
      if (!colors.has(key)) colors.set(key, getEventColor(e.status));
    });
    return colors;
  }, [fillDayCells, visibleDayEvents]);

  const calendarEvents = useMemo(
    () =>
      mergeConsecutiveDays
        ? mergeConsecutiveDayEvents(visibleDayEvents)
        : visibleDayEvents,
    [mergeConsecutiveDays, visibleDayEvents],
  );

  const statusCounts = useMemo(() => {
    const counts = {};
    STATUS_OPTIONS.forEach(({ status }) => {
      counts[status] = countApplications(
        facetEvents.filter((e) => e.status === status),
      );
    });
    return counts;
  }, [facetEvents]);

  const totalApplications = useMemo(
    () => countApplications(formattedEvents),
    [formattedEvents],
  );
  const visibleApplications = useMemo(
    () => countApplications(visibleDayEvents),
    [visibleDayEvents],
  );

  // Search box (rendered in the phone toolbar and in the tablet/desktop row)
  const renderSearch = (className) => (
    <label className={className}>
      <span className="sr-only">Search employee</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
        style={{ color: "var(--app-muted)" }}
      />
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search employee…"
        className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm bg-[color:var(--app-surface)] border-[color:var(--app-border)] text-[color:var(--app-text)] placeholder:text-[color:var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent"
      />
    </label>
  );

  const resultSummary = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-xs" style={{ color: "var(--app-muted)" }}>
        Showing{" "}
        <b style={{ color: "var(--app-text)" }}>{visibleApplications}</b> of{" "}
        {totalApplications} {totalApplications === 1 ? "leave" : "leaves"}
      </span>
      {isFiltered && (
        <button
          type="button"
          onClick={resetFilters}
          className={`text-xs font-semibold cursor-pointer rounded px-1 hover:underline ${FOCUS_RING}`}
          style={{ color: "var(--accent)" }}
        >
          Reset filters
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col w-full gap-3 sm:gap-4">
      <CalendarThemeStyles />

      {/* =========================================
          TOP BAR: LEGEND & INFO
      ========================================= */}
      <div
        className="w-full flex flex-col gap-3 rounded-xl border p-3 sm:p-4 transition-colors duration-300 ease-out"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: "var(--app-border)",
        }}
      >
        {filterable ? (
          <>
            {/* Phones: search + Filters toggle in one row; chips open below */}
            <div className="flex items-center gap-2 sm:hidden">
              {searchable ? (
                renderSearch("relative flex-1 min-w-0")
              ) : (
                <div className="flex-1 min-w-0">{resultSummary}</div>
              )}
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                aria-controls={filterPanelId}
                className={`inline-flex flex-none items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold cursor-pointer select-none bg-[color:var(--app-surface)] border-[color:var(--app-border)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-2)] active:scale-95 transition-[background-color,transform] duration-150 ease-out ${FOCUS_RING}`}
              >
                <SlidersHorizontal
                  className="w-4 h-4"
                  style={{ color: "var(--app-muted)" }}
                />
                Filters
                {isFiltered && (
                  <>
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: "var(--accent)" }}
                    />
                    <span className="sr-only">(changed)</span>
                  </>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${filtersOpen ? "rotate-180" : ""}`}
                  style={{ color: "var(--app-muted)" }}
                />
              </button>
            </div>
            {searchable && <div className="sm:hidden">{resultSummary}</div>}

            {/* Status + type chips: always shown from tablets up; on phones
                only while Filters is open */}
            <div
              id={filterPanelId}
              className={`${filtersOpen ? "flex" : "hidden"} sm:flex flex-col gap-3 border-t pt-3 sm:border-t-0 sm:pt-0`}
              style={{ borderColor: "var(--app-border)" }}
            >
              {/* Row 1: every status as a toggle */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider mr-1"
                  style={{ color: "var(--app-muted)" }}
                >
                  Status:
                </span>
                {STATUS_OPTIONS.map(({ status, label }) => (
                  <FilterChip
                    key={status}
                    active={!hiddenStatuses.has(status)}
                    onToggle={() => toggleIn(setHiddenStatuses, status)}
                    label={label}
                    dotColor={getEventColor(status)}
                    count={statusCounts[status]}
                  />
                ))}
              </div>

              {/* Types (+ search and result count from tablets up) */}
              <div
                className="flex flex-col lg:flex-row lg:items-center gap-3 border-t pt-3"
                style={{ borderColor: "var(--app-border)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider mr-1"
                    style={{ color: "var(--app-muted)" }}
                  >
                    Types:
                  </span>
                  {TYPE_OPTIONS.map(({ type, tag, label }) => (
                    <FilterChip
                      key={type}
                      active={!hiddenTypes.has(type)}
                      onToggle={() => toggleIn(setHiddenTypes, type)}
                      label={label}
                      tag={tag}
                    />
                  ))}
                </div>

                {searchable &&
                  renderSearch(
                    "relative hidden sm:block w-full lg:w-64 lg:ml-2",
                  )}
                <div className="hidden sm:flex lg:ml-auto">{resultSummary}</div>
              </div>
            </div>
          </>
        ) : (
          /* Plain legend (original look) */
          <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out mr-2"
                style={{ color: "var(--app-muted)" }}
              >
                Status:
              </span>
              {STATUS_OPTIONS.map(({ status, label }) => (
                <div key={status} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3 h-3 rounded-full border border-black/10 shadow-sm"
                    style={{ backgroundColor: getEventColor(status) }}
                  />
                  <span
                    className="font-medium transition-colors duration-300 ease-out"
                    style={{ color: "var(--app-text)" }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4"
              style={{ borderColor: "var(--app-border)" }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ease-out"
                style={{ color: "var(--app-muted)" }}
              >
                Types:
              </span>
              {TYPE_OPTIONS.map(({ type, tag, label }) => (
                <div key={type} className="flex items-center gap-1.5 text-sm">
                  <span
                    className="font-bold"
                    style={{ color: "var(--app-text)" }}
                  >
                    {tag}
                  </span>
                  <span style={{ color: "var(--app-muted)" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showOnLeaveToday && !isLoading && (
        <OnLeaveToday events={visibleDayEvents} onOpen={openEvent} />
      )}

      {/* =========================================
          MAIN CALENDAR AREA
      ========================================= */}
      <div className="w-full">
        {isLoading ? (
          <div
            className="w-full h-[650px] flex items-center justify-center rounded-xl border transition-colors duration-300 ease-out"
            style={{
              backgroundColor: "var(--app-surface-2)",
              borderColor: "var(--app-border)",
            }}
          >
            <div
              className="animate-pulse text-sm font-semibold transition-colors duration-300 ease-out"
              style={{ color: "var(--app-muted)" }}
            >
              Loading calendar events...
            </div>
          </div>
        ) : (
          <OpenEventContext.Provider value={openEvent}>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              eventPropGetter={eventPropGetter}
              dayPropGetter={dayPropGetter}
              views={allowedViews}
              view={view}
              onView={setView}
              className={
                [
                  expandMonthRows && view === "month" && "cal-month-fit",
                  fillDayCells && "cal-fill",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              messages={calendarMessages}
              popup={true}
              length={90}
              onSelectEvent={openEvent}
              components={fillDayCells ? FILL_COMPONENTS : CALENDAR_COMPONENTS}
              tooltipAccessor={(event) => {
                // Construct a tooltip prioritizing revocation info if applicable
                const baseTip = `${event.title}\nStatus: ${formatStatusLabel(event.status)}`;
                const reasonTip = `\nReason: ${event.details?.reason || "N/A"}`;
                const revokeTip = event.details?.revocationReason
                  ? `\nRevocation Reason: ${event.details.revocationReason}`
                  : "";
                const hrNoteTip = event.details?.revokeRemarks
                  ? `\nHR Note: ${event.details.revokeRemarks}`
                  : "";

                return (
                  baseTip +
                  reasonTip +
                  revokeTip +
                  hrNoteTip +
                  "\n\nClick to view details"
                );
              }}
            />
          </OpenEventContext.Provider>
        )}
      </div>

      {/* Details of the clicked leave */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={closeDetails}
        title="Leave Details"
        maxWidth="max-w-2xl"
        closeLabel="Close"
      >
        {selectedEvent && (
          <LeaveEventDetails
            event={selectedEvent}
            events={formattedEvents}
            applicationHref={applicationLinkFor?.(selectedEvent) || null}
          />
        )}
      </Modal>
    </div>
  );
};

export default SharedCalendarView;
