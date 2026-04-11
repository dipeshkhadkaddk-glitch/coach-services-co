const twilio = require('twilio');

let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

exports.sendSMS = async (to, body) => {
  if (!client) {
    console.log(`[SMS SKIPPED] Credentials missing. To: ${to}, Msg: ${body}`);
    return;
  }

  // --- AUTO-FORMATTING LOGIC ---
  let formattedTo = to.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, brackets
  
  if (formattedTo.startsWith('0')) {
    // If it starts with 0 (like 0493...), replace it with +61
    formattedTo = '+61' + formattedTo.substring(1);
  } else if (!formattedTo.startsWith('+')) {
    // If it doesn't have a +, assume it needs +61
    formattedTo = '+61' + formattedTo;
  }
  // -----------------------------

  try {
    const info = await client.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedTo
    });
    console.log(`[SMS SENT] to ${formattedTo}. SID: ${info.sid}`);
  } catch (err) {
    console.error(`[SMS ERROR] Failed to send to ${formattedTo}: ${err.message}`);
  }
};
