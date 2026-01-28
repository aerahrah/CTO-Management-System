const ctoRejectionEmail = ({ employeeName, remarks }) => `
  <div style="font-family: Arial, sans-serif">
    <p>Good day <strong>${employeeName}</strong>,</p>

    <p>Your CTO application has been <strong>rejected</strong>.</p>

    <p><strong>Reason for rejection:</strong> ${remarks || "No remarks provided"}</p>

    <br />
    <p>Thank you.</p>
    <p>CTO Management System</p>
  </div>
`;

module.exports = ctoRejectionEmail;
