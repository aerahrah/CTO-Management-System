// Frontend helper (e.g. src/utils/lateFilingWindow.js)
// Feed it the response of GET /working-days/public.
// Mirrors getBackdateLimit() on the backend so the date picker and the API agree.

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * "YYYY-MM-DD" in the user's own time zone.
 * Use this instead of date.toISOString().split("T")[0], which uses UTC and
 * returns yesterday's date in Manila before 8:00 AM.
 */
export function toLocalISODate(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Earliest date the employee may pick. Use as the date picker's minDate. */
export function getEarliestFilingDate(settings = {}) {
  const limit = startOfToday();

  if (!settings.lateFilingBackdateEnabled) return limit;

  const days = Math.max(
    0,
    Math.trunc(Number(settings.lateFilingBackdateDays) || 0),
  );
  const countedDays =
    settings.computationMode === "Calendar Days"
      ? ALL_DAYS
      : settings.activeWorkingDays?.length
        ? settings.activeWorkingDays
        : WEEKDAYS;

  let counted = 0;
  let guard = 0;
  while (counted < days && guard < 366) {
    limit.setDate(limit.getDate() - 1);
    if (countedDays.includes(limit.getDay())) counted++;
    guard++;
  }

  return limit;
}

/** True if any selected date is before today, so the late filing section must be shown and required. */
export function hasBackdatedDate(dates = []) {
  const today = startOfToday();
  return dates.some((d) => {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    return day < today;
  });
}
