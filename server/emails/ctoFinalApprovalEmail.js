const ctoFinalApprovalEmail = ({ employeeName, requestedHours }) => `
  <div style="font-family: Arial, sans-serif">
    <p>Good day <strong>${employeeName}</strong>,</p>

    <p>Your CTO application has been <strong>fully approved</strong>.</p>

    <p><strong>Requested Hours:</strong> ${requestedHours}</p>

    <br />
    <p>Thank you.</p>
    <p>CTO Management System</p>
  </div>
`;

module.exports = ctoFinalApprovalEmail;
