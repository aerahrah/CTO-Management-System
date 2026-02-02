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

  switch (endpoint) {
    // Employee Routes
    case "Update My Profile":
      summary = `${actor} updated own profile`;
      break;

    case "Update Employee Role":
      summary = `${actor} updated role for employee ${targetUser} from "${before?.role || "N/A"}" to "${body.role}"`;
      break;

    case "Create Employee":
      summary = `${actor} created new employee ${body.username} (ID: ${body.id || "N/A"})`;
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

    // CTO Credit Routes
    case "Add CTO Credit Request":
      const hours = body.duration?.hours || 0;
      const minutes = body.duration?.minutes || 0;
      const totalDuration = hours + minutes / 60;

      summary = `${actor} added CTO credit request for ${targetUser} (${totalDuration || "N/A"} hrs)`;
      break;

    case "Rollback CTO Credit":
      summary = `${actor} rolled back CTO credit for ${targetUser}`;
      break;

    case "View All Credit Requests":
    case "View My Credits":
    case "View Employee Credit History":
      summary = `${actor} viewed CTO credit info${targetUser ? ` for ${targetUser}` : ""}`;
      break;

    // CTO Application Routes
    case "Apply for CTO":
      summary = `${actor} submitted CTO application for ${targetUser} (${body.requestedHours} hrs)`;
      break;

    case "Approve CTO Application":
      if (body.level) {
        summary = `${actor} approved step ${body.level} for ${targetUser}`;
      } else {
        summary = `${actor} approved CTO application for ${targetUser}`;
      }
      break;

    case "Reject CTO Application":
      summary = `${actor} rejected CTO application for ${targetUser}`;
      break;

    // CTO Settings
    case "View CTO Settings":
    case "View CTO Setting By Designation":
      summary = `${actor} viewed CTO settings${params.id ? ` for designation ${params.id}` : ""}`;
      break;

    case "Upsert CTO Approver Setting":
      summary = `${actor} upserted CTO approver settings`;
      break;

    case "Delete CTO Approver Setting":
      summary = `${actor} deleted CTO approver setting for designation ${params.id}`;
      break;

    // Designation routes
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

    // Default fallback
    default:
      summary = `${actor} performed ${endpoint} on ${targetUser || params.id || "N/A"}`;
      break;
  }

  return { summary };
};

module.exports = buildAuditDetails;
