const ctoApprovalEmail = ({
  approverName,
  employeeName,
  requestedHours,
  reason,
  level,
  link,
}) => `
  <div style="font-family: Arial, sans-serif">
    <h2>CTO Approval Request (Level ${level})</h2>

    <p>Good day <strong>${approverName}</strong>,</p>

    <p>
      You have a pending CTO application awaiting your approval.
    </p>

    <ul>
      <li><strong>Employee:</strong> ${employeeName}</li>
      <li><strong>Requested Hours:</strong> ${requestedHours}</li>
      <li><strong>Reason:</strong> ${reason}</li>
    </ul>

    <p>
      <a href="${link}" target="_blank">
        👉 Review Application
      </a>
    </p>

    <br />
    <p>CTO Management System</p>
  </div>
`;

module.exports = ctoApprovalEmail;
