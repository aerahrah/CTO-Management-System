const { isSmsEnabled } = require("../utils/emailNotificationSettings");

async function sendNotificationSms(to, message, clientRef) {
  // 1. Check if SMS is enabled in DB / .env
  const enabled = await isSmsEnabled();

  if (!enabled) {
    console.log(`[SMS Disabled] Skipped sending to ${to}.`);
    return { ok: true, id: "simulated-skip-id" };
  }

  try {
    // 2. Read the credentials directly from your .env file
    // .replace(/\/$/, '') removes any accidental trailing slash from the URL
    const baseUrl = (process.env.SMS_API_URL || "").replace(/\/$/, "");
    const key = process.env.SMS_API_KEY || "";

    if (!baseUrl || !key) {
      throw new Error("Missing SMS_API_URL or SMS_API_KEY in .env");
    }

    // 3. Make a direct HTTP POST request to the JE Lite API
    const response = await fetch(`${baseUrl}/api/v1/sms/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: to,
        message: message,
        client_ref: clientRef,
      }),
    });

    const data = await response.json();

    // 4. Handle success (202 Accepted or 200 OK)
    if (response.status === 202 || response.status === 200) {
      console.log(`[SMS Queued] ID: ${data.id}`);
      return { ok: true, id: data.id };
    }

    // Handle failure
    throw new Error(`API returned ${response.status}: ${JSON.stringify(data)}`);
  } catch (error) {
    console.error(`[SMS Error] Failed to send:`, error.message);
    return { ok: false, error: "sms_unavailable" };
  }
}

module.exports = { sendNotificationSms };
