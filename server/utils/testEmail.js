// scripts/testEmail.js
// Sends one real test email through GovMail.
// Run from your project folder (where .env is):
//   node scripts/testEmail.js
//   node scripts/testEmail.js someone.else@dict.gov.ph   ← to test a different address
const sendEmail = require("../utils/sendEmail");

const TO = process.argv[2] || "diether.abad@dict.gov.ph";

(async () => {
  const sentAt = new Date().toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
  });

  try {
    const info = await sendEmail(
      TO,
      "Test email from CTO & Wellness System",
      `<p>Hello,</p>
       <p>This is a test email from the CTO &amp; Wellness System to confirm that sending through GovMail works.</p>
       <p>Sent: ${sentAt}</p>
       <p>No action is needed.</p>`,
    );

    console.log("\n✅ Google accepted the email.");
    console.log("   Message ID:", info.messageId);
    console.log(`   Now check the Inbox and Spam folder of ${TO}`);
  } catch (err) {
    console.log("\n❌ The email was NOT sent. See the error and hint above.");
    process.exitCode = 1;
  }
})();
