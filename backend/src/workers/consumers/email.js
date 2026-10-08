'use strict';
const { sendMail, templates } = require('../../infrastructure/email/mailer');

/** auth.* and clinic.* events that produce transactional email. Idempotent per event id. */
async function emailHandler(event) {
  switch (event.type) {
    case 'auth.password.changed':
      await sendMail({ to: event.payload.email, ...templates.passwordChanged(event.payload.name || 'there') });
      break;
    case 'clinic.created':
      await sendMail({ to: event.payload.adminEmail, ...templates.clinicWelcome(event.payload.adminName || 'Administrator', event.payload.name, event.payload.adminEmail) });
      break;
    default:
      break; // other routed events need no email
  }
}
module.exports = { emailHandler };
