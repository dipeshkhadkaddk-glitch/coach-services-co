const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Helper to gracefully handle missing configs
const sendEmail = async (to, subject, htmlContent) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`\n[EMAIL SKIPPED] Missing credentials in .env`);
    console.log(`To: ${to}\nSubject: ${subject}\n\n`);
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: `"Coach Services Co." <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log(`[EMAIL SENT] to ${to}: ${info.messageId}`);
  } catch (error) {
    console.error(`[EMAIL ERROR] failed to send email: ${error.message}`);
  }
};

// 1. Profile Approved
exports.emailProfileApproved = async (fullName, email) => {
  const subject = "Welcome to Coach Services Co. - Profile Approved!";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #f59e0b;">Welcome to Coach Services Co.</h2>
      <p>Hi <b>${fullName}</b>,</p>
      <p>Great news! Your profile request has been <b>approved</b> by an administrator.</p>
      <p>You can now log in to the portal and start placing bookings for the Brisbane Olympics 2032 transport network.</p>
      <br/>
      <a href="http://coachservices.local" style="background-color: #f59e0b; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold;">Log in Now</a>
    </div>
  `;
  await sendEmail(email, subject, html);
};

// 1.5 Profile Requested
exports.emailProfileRequested = async (fullName, email) => {
  const subject = "Profile Application Received - Coach Services Co.";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #6366f1;">Application Received</h2>
      <p>Hi <b>${fullName}</b>,</p>
      <p>We have successfully received your profile request for Coach Services Co.</p>
      <p>An administrator will review your details shortly. We will send you another email once your application has been processed.</p>
    </div>
  `;
  await sendEmail(email, subject, html);
};

// 2. Profile Rejected
exports.emailProfileRejected = async (fullName, email) => {
  const subject = "Update regarding your Coach Services Co. Account";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #ef4444;">Account Application Update</h2>
      <p>Hi <b>${fullName}</b>,</p>
      <p>Unfortunately, your profile application for Coach Services Co. has been <b>rejected</b>.</p>
      <p>If you believe this is a mistake, please contact support.</p>
    </div>
  `;
  await sendEmail(email, subject, html);
};

// 3. Booking Confirmed
exports.emailBookingConfirmed = async (fullName, email, bookingId, routeString) => {
  const subject = `Booking Confirmed: #${bookingId}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #10b981;">Your Booking is Confirmed!</h2>
      <p>Hi <b>${fullName}</b>,</p>
      <p>Your transport booking (ID: #${bookingId}) has been officially <b>confirmed</b>.</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="margin: 0;"><b>Route:</b> ${routeString}</p>
      </div>
      <p>We look forward to providing your transport for the Brisbane Olympics 2032!</p>
    </div>
  `;
  await sendEmail(email, subject, html);
};

// 4. Booking Cancelled
exports.emailBookingCancelled = async (fullName, email, bookingId) => {
  const subject = `Booking Cancelled: #${bookingId}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #ef4444;">Booking Cancellation notice</h2>
      <p>Hi <b>${fullName}</b>,</p>
      <p>This is a notification that your transport booking (ID: #${bookingId}) has been <b>cancelled</b> by an administrator.</p>
      <p>If you need further assistance, please contact our administrative team or place a new booking request.</p>
    </div>
  `;
  await sendEmail(email, subject, html);
};

exports.sendEmailRaw = sendEmail;
