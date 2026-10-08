'use strict';
const nodemailer = require('nodemailer');
const { config } = require('../../config');
const { getLogger } = require('../../common/logging/logger');

let transport;
function getTransport() {
  if (transport) return transport;
  const env = config();
  if (env.EMAIL_TRANSPORT === 'smtp') {
    transport = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_SECURE,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
      tls: { rejectUnauthorized: true },
    });
  } else if (env.EMAIL_TRANSPORT === 'console') {
    // Development mailbox: prints the whole message to stdout. Never allowed in production.
    transport = { sendMail: async (msg) => { process.stdout.write(`\n--- DEV EMAIL to ${msg.to} ---\n${msg.subject}\n${msg.text}\n--- end ---\n`); return { messageId: 'console' }; } };
  } else {
    transport = { sendMail: async () => ({ messageId: 'noop' }) };
  }
  return transport;
}

async function sendMail({ to, subject, text, html }) {
  const env = config();
  const info = await getTransport().sendMail({ from: env.EMAIL_FROM, to, subject, text, html });
  getLogger().info({ to, subject, transport: env.EMAIL_TRANSPORT }, 'email sent');
  return info;
}

const templates = {
  loginOtp: (name, code, minutes) => ({ subject: 'Your SMAART Healthcare login code', text: `Hello ${name},\n\nYour login verification code is ${code}. It expires in ${minutes} minutes.\n\nIf you did not try to sign in, please contact your administrator.` }),
  resetOtp: (name, code, minutes) => ({ subject: 'Reset your SMAART Healthcare password', text: `Hello ${name},\n\nYour password reset code is ${code}. It expires in ${minutes} minutes and can be used once.\n\nIf you did not request a reset, you can ignore this email.` }),
  passwordChanged: (name) => ({ subject: 'Your SMAART Healthcare password was changed', text: `Hello ${name},\n\nYour password was just changed and all other sessions were signed out. If this was not you, contact your administrator immediately.` }),
  clinicWelcome: (name, clinicName, email) => ({ subject: `Your clinic ${clinicName} is ready on SMAART Healthcare`, text: `Hello ${name},\n\nA clinic administrator account was created for ${clinicName} with the email ${email}. Sign in with the password provided by your SMAART administrator and change it after first login.` }),
};

module.exports = { sendMail, templates };
