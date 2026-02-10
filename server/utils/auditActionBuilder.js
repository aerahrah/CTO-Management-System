// utils/auditActionBuilder.js
const buildAuditDetails = ({
  endpoint,
  body,
  params,
  actor,
  targetUser,
  before,
}) => {
  let summary = "";

  // ✅ normalize before (could be object or array)
  const b = Array.isArray(before) ? before[0] : before;

  switch (endpoint) {
    /* =========================
       Employee Routes
    ========================= */
    case "Update My Profile":
      summary = `${actor} updated own profile`;
      break;

    case "Update Employee Role":
      summary = `${actor} updated role for employee ${targetUser} from "${
        b?.role || "N/A"
      }" to "${body.role}"`;
      break;

    case "Create Employee":
      summary = `${actor} created new employee ${body.username} (ID: ${
        body.id || "N/A"
      })`;
      break;

    case "Reset My Password":
      summary = `${actor} reset own password`;
      break;

    case "View My Profile":
    case "View My Memos":
    case "View Employee Memos":
    case "View Employee Details":
      summary = `${actor} viewed ${targetUser || params.id || "employee data"}`;
      break;

    /* =========================
       CTO Credit Routes
    ========================= */
    case "Add CTO Credit Request": {
      const hours = body.duration?.hours || 0;
      const minutes = body.duration?.minutes || 0;
      const totalDuration = hours + minutes / 60;
      summary = `${actor} added CTO credit request for ${targetUser} (${
        totalDuration || "N/A"
      } hrs)`;
      break;
    }

    case "Rollback CTO Credit":
      summary = `${actor} rolled back CTO credit for ${targetUser}`;
      break;

    case "View All Credit Requests":
    case "View My Credits":
    case "View Employee Credit History":
      summary = `${actor} viewed CTO credit info${
        targetUser ? ` for ${targetUser}` : ""
      }`;
      break;

    /* =========================
       CTO Application Routes
    ========================= */
    case "Apply for CTO":
      summary = `${actor} submitted CTO application for ${targetUser} (${body.requestedHours} hrs)`;
      break;

    case "Approve CTO Application":
      summary = body.level
        ? `${actor} approved step ${body.level} for ${targetUser}`
        : `${actor} approved CTO application for ${targetUser}`;
      break;

    case "Reject CTO Application":
      summary = `${actor} rejected CTO application for ${targetUser}`;
      break;

    /* =========================
       CTO Settings
    ========================= */
    case "View CTO Settings":
    case "View CTO Setting By Designation":
      summary = `${actor} viewed CTO settings${
        params.id ? ` for designation ${params.id}` : ""
      }`;
      break;

    case "Upsert CTO Approver Setting":
      summary = `${actor} upserted CTO approver settings`;
      break;

    case "Delete CTO Approver Setting":
      summary = `${actor} deleted CTO approver setting for designation ${params.id}`;
      break;

    /* =========================
       Designation routes
    ========================= */
    case "View All Designations":
      summary = `${actor} viewed all designations`;
      break;

    case "View Designation Details":
      summary = `${actor} viewed designation ${params.id}`;
      break;

    case "Create Designation":
      summary = `${actor} created new designation ${body.name || "N/A"}`;
      break;

    case "Update Designation":
      summary = `${actor} updated designation ${params.id}`;
      break;

    case "Delete Designation":
      summary = `${actor} deleted designation ${params.id}`;
      break;

    /* =========================
       ✅ Projects (NEW)
    ========================= */
    case "Create Project":
      summary = `${actor} created new project "${body.name || "N/A"}"${
        body.status ? ` (status: ${body.status})` : ""
      }`;
      break;

    case "View Projects":
      summary = `${actor} viewed projects`;
      break;

    case "View Project Options":
      summary = `${actor} viewed project options`;
      break;

    case "View Project Details":
      summary = `${actor} viewed project ${params.id}`;
      break;

    case "Update Project": {
      const beforeName = b?.name || "N/A";
      const beforeStatus = b?.status || "N/A";
      const afterName = body?.name ?? beforeName;
      const afterStatus = body?.status ?? beforeStatus;

      const changes = [];
      if (body?.name !== undefined && afterName !== beforeName) {
        changes.push(`name: "${beforeName}" → "${afterName}"`);
      }
      if (body?.status !== undefined && afterStatus !== beforeStatus) {
        changes.push(`status: "${beforeStatus}" → "${afterStatus}"`);
      }

      summary =
        changes.length > 0
          ? `${actor} updated project ${params.id} (${changes.join(", ")})`
          : `${actor} updated project ${params.id}`;
      break;
    }

    case "Update Project Status":
      summary = `${actor} updated project ${params.id} status from "${
        b?.status || "N/A"
      }" to "${body.status || "N/A"}"`;
      break;

    case "Delete Project":
      summary = `${actor} deleted project ${params.id}`;
      break;

    /* =========================
       Default fallback
    ========================= */
    default:
      summary = `${actor} performed ${endpoint} on ${
        targetUser || params.id || "N/A"
      }`;
      break;
  }

  return { summary };
};

module.exports = buildAuditDetails;
