require("dotenv").config();
const sendEmail = require("./sendEmail");

(async () => {
  try {
    await sendEmail(
      process.env.TEST_TO || process.env.EMAIL_USER,
      "Test Email - HRMS",
      "<h3>Hello!</h3><p>This is a test email from Nodemailer.</p>",
    );
    console.log("DONE");
  } catch (e) {
    console.error("SEND FAILED:", e.message);
  }
})();
