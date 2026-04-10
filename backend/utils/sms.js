const twilio = require('twilio');

// Load values from Render surroundings (Environment Variables)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client
const client = (accountSid && authToken) ? new twilio(accountSid, authToken) : null;

/**
 * Sends an SMS using Twilio
 * @param {string} to - Recipient phone number (e.g., +61400000000)
 * @param {string} body - The message content
 */
exports.sendSMS = async (to, body) => {
  // Check if credentials are set
  if (!client || !fromNumber) {
    console.log(`\n[SMS SKIPPED] Credentials missing in Render/env settings.`);
    console.log(`To: ${to}\nMessage: ${body}\n`);
    return;
  }

  try {
    const message = await client.messages.create({
      body: body,
      from: fromNumber,
      to: to
    });
    console.log(`[SMS SENT] Successfully sent to ${to}. SID: ${message.sid}`);
  } catch (err) {
    console.error(`[SMS ERROR] Failed to send to ${to}: ${err.message}`);
  }
};
