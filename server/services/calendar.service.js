const CtoApplication = require("../models/ctoApplicationModel");
const WellnessApplication = require("../models/wellnessApplicationModel");

const plural = (n, unit) => `${n} ${unit}${Number(n) === 1 ? "" : "s"}`;

/**
 * Turns one application into one calendar event per leave date.
 * `details` carries everything the calendar's details modal shows, including
 * every date of the application (so clicking one day can show the whole leave).
 */
const toCalendarEvents = (app, type, duration) => {
  const snap = app.applicantSnapshot || {};
  const employeeName =
    [snap.firstName, snap.lastName].filter(Boolean).join(" ") || "Employee";

  const dates = [...(app.inclusiveDates || [])].sort(
    (a, b) => new Date(a) - new Date(b),
  );

  const details = {
    employeeName,
    // Only sent when the snapshot stores it as plain text
    position: typeof snap.position === "string" ? snap.position : null,
    division: snap.division,
    reason: app.reason,
    duration,
    dates,
    filedAt: app.createdAt || null,
    revocationReason: app.revocationRequest?.reason || null,
    revokeRemarks: app.revokeReason || null,
  };

  return dates.map((date) => ({
    id: app._id.toString(),
    type,
    title: `${type} - ${employeeName}`,
    date,
    status: app.overallStatus,
    details,
  }));
};

/**
 * Fetches and formats CTO and Wellness applications for a frontend calendar.
 * @param {Object} queryOptions - Filters for MongoDB (e.g., specific employee, status)
 * @returns {Array} Array of standardized calendar event objects
 */
const getCalendarEvents = async (queryOptions = {}) => {
  const [ctos, wellness] = await Promise.all([
    CtoApplication.find(queryOptions)
      .select(
        "inclusiveDates overallStatus applicantSnapshot reason requestedHours revocationRequest revokeReason createdAt",
      )
      .lean(),
    WellnessApplication.find(queryOptions)
      .select(
        "inclusiveDates overallStatus applicantSnapshot reason totalDays revocationRequest revokeReason createdAt",
      )
      .lean(),
  ]);

  return [
    ...ctos.flatMap((app) =>
      toCalendarEvents(app, "CTO", plural(app.requestedHours ?? 0, "hour")),
    ),
    ...wellness.flatMap((app) =>
      toCalendarEvents(app, "Wellness", plural(app.totalDays ?? 0, "day")),
    ),
  ];
};

module.exports = {
  getCalendarEvents,
};
