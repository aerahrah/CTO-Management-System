// utils/auditActionBuilder.js

const buildAuditDetails = ({
  endpoint,
  body = {}, // usually "after" (but may be req.body OR {before,after})
  params = {},
  actor = "Someone",
  targetUser,
  before, // usually "before"
}) => {
  let summary = "";

  // normalize before (could be object or array)
  const rawBefore = Array.isArray(before) ? before[0] : before;

  // ✅ if someone accidentally passes { before, after } here, unwrap it
  const b =
    rawBefore &&
    typeof rawBefore === "object" &&
    rawBefore.before &&
    rawBefore.after
      ? rawBefore.before
      : rawBefore;

  const after =
    body && typeof body === "object" && body.before && body.after
      ? body.after
      : body;

  const safe = (v, fallback = "N/A") => {
    if (v === undefined || v === null || v === "") return fallback;
    return String(v);
  };

  const fmtUser = (u) => safe(u, "unknown user");
  const fmtId = (id) => safe(id, "N/A");

  const toNum = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const toHours = ({ hours, minutes } = {}) => {
    const h = toNum(hours, 0);
    const m = toNum(minutes, 0);
    return Math.round((h + m / 60) * 100) / 100;
  };

  const fmtBool = (v) =>
    typeof v === "boolean" ? (v ? "enabled" : "disabled") : "N/A";

  // "field: before → after" changes
  const pushChange = (changes, label, beforeVal, afterVal) => {
    const bV = safe(beforeVal);
    const aV = safe(afterVal);
    if (bV === "N/A" && aV === "N/A") return;
    if (bV !== aV) changes.push(`${label}: "${bV}" → "${aV}"`);
  };

  switch (endpoint) {
    /* =========================
       Employee Routes
    ========================= */
    case "Create Employee":
      summary = `${actor} created new employee ${safe(after.username)} (ID: ${fmtId(
        after.id,
      )})`;
      break;

    case "Employee Login":
      summary = `${actor} logged in`;
      break;

    case "View Employees":
      summary = `${actor} viewed employees`;
      break;

    case "Update Employee":
      summary = `${actor} updated employee ${targetUser || params.id || "record"}`;
      break;

    case "Update Employee Role": {
      // ✅ this now works once middleware passes TRUE before role
      const beforeRole = safe(b?.role);
      const afterRole = safe(after?.role);
      summary = `${actor} updated role for employee ${fmtUser(
        targetUser,
      )} from "${beforeRole}" to "${afterRole}"`;
      break;
    }

    case "View My Profile":
      summary = `${actor} viewed own profile`;
      break;

    case "Update My Profile":
      summary = `${actor} updated own profile`;
      break;

    case "Reset My Password":
      summary = `${actor} reset own password`;
      break;

    case "View My Memos":
      summary = `${actor} viewed own CTO memos`;
      break;

    case "View Employee Memos":
      summary = `${actor} viewed CTO memos for ${fmtUser(targetUser || params.id)}`;
      break;

    case "View Employee Details":
      summary = `${actor} viewed employee details for ${fmtUser(targetUser || params.id)}`;
      break;

    /* =========================
       CTO Credit Routes
    ========================= */
    case "Add CTO Credit Request": {
      const totalDuration = toHours(after?.duration);
      const memoNo = safe(after?.memoNo, "");
      const employeeCount = Array.isArray(after?.employees)
        ? after.employees.length
        : null;

      summary = `${actor} added CTO credit${
        employeeCount !== null ? ` to ${employeeCount} employee(s)` : ""
      }${memoNo ? ` (Memo: ${memoNo})` : ""} (${totalDuration} hrs)`;
      break;
    }

    case "Rollback CTO Credit": {
      const memoNo = safe(after?.memoNo, "");
      summary = `${actor} rolled back CTO credit${memoNo ? ` (Memo: ${memoNo})` : ""}`;
      break;
    }

    case "View All Credit Requests":
      summary = `${actor} viewed all CTO credit requests`;
      break;

    case "View My Credits":
      summary = `${actor} viewed own CTO credits`;
      break;

    case "View Employee Credit History":
      summary = `${actor} viewed CTO credit history${
        targetUser
          ? ` for ${targetUser}`
          : params.employeeId
            ? ` for ${params.employeeId}`
            : ""
      }`;
      break;

    case "View Employee Details (CTO)":
      summary = `${actor} viewed employee details (CTO)${
        targetUser
          ? ` for ${targetUser}`
          : params.employeeId
            ? ` for ${params.employeeId}`
            : ""
      }`;
      break;

    /* =========================
       CTO Application Routes
    ========================= */
    case "Apply for CTO":
      summary = `${actor} submitted CTO application${
        targetUser ? ` for ${targetUser}` : ""
      } (${safe(after.requestedHours, "N/A")} hrs)`;
      break;

    case "View All CTO Applications":
      summary = `${actor} viewed all CTO applications`;
      break;

    case "View My CTO Applications":
      summary = `${actor} viewed own CTO applications`;
      break;

    case "View Employee CTO Applications":
      summary = `${actor} viewed CTO applications${
        targetUser
          ? ` for ${targetUser}`
          : params.employeeId
            ? ` for ${params.employeeId}`
            : ""
      }`;
      break;

    case "View My CTO Approvals":
      summary = `${actor} viewed own pending/handled CTO approvals`;
      break;

    case "View CTO Application Details":
      summary = `${actor} viewed CTO application details (ID: ${fmtId(params.id)})`;
      break;

    case "Approve CTO Application":
      summary = after.level
        ? `${actor} approved CTO step ${safe(after.level)} for ${fmtUser(targetUser)}`
        : `${actor} approved CTO application for ${fmtUser(targetUser)}`;
      break;

    case "Reject CTO Application":
      summary = `${actor} rejected CTO application for ${fmtUser(targetUser)}`;
      break;

    case "Cancel CTO Application": {
      const hrs = safe(after?.requestedHours ?? b?.requestedHours, "N/A");
      const appId = params.id || after?.applicationId || after?._id;
      summary = `${actor} cancelled CTO application (ID: ${fmtId(appId)})${
        hrs !== "N/A" ? ` — ${hrs} hrs` : ""
      }`;
      break;
    }

    /* =========================
       CTO Dashboard
    ========================= */
    case "View Dashboard":
      summary = `${actor} viewed CTO dashboard`;
      break;

    /* =========================
       CTO Settings (Approver Setting)
    ========================= */
    case "View CTO Settings":
      summary = `${actor} viewed CTO settings`;
      break;

    case "View CTO Setting By Designation":
      summary = `${actor} viewed CTO settings for designation ${fmtId(
        params.designationId || params.id,
      )}`;
      break;

    case "Upsert CTO Approver Setting":
      summary = `${actor} upserted CTO approver settings${
        after.designation ? ` for designation ${after.designation}` : ""
      }`;
      break;

    case "Delete CTO Approver Setting":
      summary = `${actor} deleted CTO approver setting (ID: ${fmtId(params.id)})`;
      break;

    /* =========================
       General Settings
    ========================= */
    case "View Session Settings":
      summary = `${actor} viewed session settings`;
      break;

    case "Update Session Settings": {
      const changes = [];
      pushChange(
        changes,
        "timeout",
        fmtBool(b?.sessionTimeoutEnabled),
        fmtBool(after?.sessionTimeoutEnabled),
      );
      pushChange(
        changes,
        "minutes",
        b?.sessionTimeoutMinutes,
        after?.sessionTimeoutMinutes,
      );

      summary =
        changes.length > 0
          ? `${actor} updated session settings (${changes.join(", ")})`
          : `${actor} updated session settings`;
      break;
    }

    case "View Working Days Settings":
      summary = `${actor} viewed working days settings`;
      break;

    case "Update Working Days Settings": {
      const changes = [];
      pushChange(
        changes,
        "enabled",
        fmtBool(b?.workingDaysEnable),
        fmtBool(after?.workingDaysEnable),
      );
      pushChange(changes, "days", b?.workingDaysValue, after?.workingDaysValue);

      summary =
        changes.length > 0
          ? `${actor} updated working days settings (${changes.join(", ")})`
          : `${actor} updated working days settings`;
      break;
    }

    /* =========================
       Designations
    ========================= */
    case "Create Designation":
      summary = `${actor} created new designation "${safe(after.name)}"${
        after.status ? ` (status: ${after.status})` : ""
      }`;
      break;

    case "View All Designations":
      summary = `${actor} viewed designations`;
      break;

    case "View Designation Options":
      summary = `${actor} viewed designation options`;
      break;

    case "View Designation Details":
      summary = `${actor} viewed designation ${fmtId(params.id)}`;
      break;

    case "Update Designation": {
      const beforeName = safe(b?.name);
      const beforeStatus = safe(b?.status);

      const afterName = after?.name ?? beforeName;
      const afterStatus = after?.status ?? beforeStatus;

      const changes = [];
      if (after?.name !== undefined && afterName !== beforeName) {
        changes.push(`name: "${beforeName}" → "${afterName}"`);
      }
      if (after?.status !== undefined && afterStatus !== beforeStatus) {
        changes.push(`status: "${beforeStatus}" → "${afterStatus}"`);
      }

      summary =
        changes.length > 0
          ? `${actor} updated designation ${fmtId(params.id)} (${changes.join(", ")})`
          : `${actor} updated designation ${fmtId(params.id)}`;
      break;
    }

    case "Update Designation Status":
      summary = `${actor} updated designation ${fmtId(params.id)} status from "${safe(
        b?.status,
      )}" to "${safe(after.status)}"`;
      break;

    case "Delete Designation":
      summary = `${actor} deleted designation ${fmtId(params.id)}`;
      break;

    /* =========================
       Projects
    ========================= */
    case "Create Project":
      summary = `${actor} created new project "${safe(after.name)}"${
        after.status ? ` (status: ${after.status})` : ""
      }`;
      break;

    case "View Projects":
      summary = `${actor} viewed projects`;
      break;

    case "View Project Options":
      summary = `${actor} viewed project options`;
      break;

    case "View Project Details":
      summary = `${actor} viewed project ${fmtId(params.id)}`;
      break;

    case "Update Project": {
      const beforeName = safe(b?.name);
      const beforeStatus = safe(b?.status);

      const afterName = after?.name ?? beforeName;
      const afterStatus = after?.status ?? beforeStatus;

      const changes = [];
      if (after?.name !== undefined && afterName !== beforeName) {
        changes.push(`name: "${beforeName}" → "${afterName}"`);
      }
      if (after?.status !== undefined && afterStatus !== beforeStatus) {
        changes.push(`status: "${beforeStatus}" → "${afterStatus}"`);
      }

      summary =
        changes.length > 0
          ? `${actor} updated project ${fmtId(params.id)} (${changes.join(", ")})`
          : `${actor} updated project ${fmtId(params.id)}`;
      break;
    }

    case "Update Project Status":
      summary = `${actor} updated project ${fmtId(params.id)} status from "${safe(
        b?.status,
      )}" to "${safe(after.status)}"`;
      break;

    case "Delete Project":
      summary = `${actor} deleted project ${fmtId(params.id)}`;
      break;

    /* =========================
       CTO Backup Routes
    ========================= */
    case "List CTO Backups":
      summary = `${actor} viewed CTO backups list`;
      break;

    case "Create CTO Backup":
      summary = `${actor} created a CTO backup`;
      break;

    case "Download CTO Backup":
      summary = `${actor} downloaded CTO backup ${fmtId(params.backupId)}`;
      break;

    case "Restore CTO Backup":
      summary = `${actor} restored CTO backup`;
      break;

    case "Delete CTO Backup":
      summary = `${actor} deleted CTO backup ${fmtId(params.backupId)}`;
      break;

    /* =========================
       Default
    ========================= */
    default:
      summary = `${actor} performed ${endpoint} on ${targetUser || params.id || "N/A"}`;
      break;
  }

  return { summary };
};

module.exports = buildAuditDetails;
