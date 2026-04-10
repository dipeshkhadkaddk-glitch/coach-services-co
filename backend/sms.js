const twilio = require('twilio');

let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

exports.sendSMS = async (to, body) => {
  if (!client) {
    console.log(`\n[SMS SKIPPED] Missing Twilio credentials in .env`);
    console.log(`To: ${to}\nMessage: ${body}\n`);
    return;
  }
  try {
    const info = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log(`[SMS SENT] to ${to}: ${info.sid}`);
  } catch (error) {
    console.error(`[SMS ERROR] failed to send SMS to ${to}: ${error.message}`);
  }
};
