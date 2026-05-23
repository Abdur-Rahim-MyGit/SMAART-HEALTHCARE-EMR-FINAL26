const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('Testing nodemailer...');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');

try {
  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  console.log('✅ Transporter created successfully');
  console.log('Transporter type:', typeof transporter);
  console.log('Transporter sendMail method:', typeof transporter.sendMail);
  
  // Test verification
  transporter.verify((error, success) => {
    if (error) {
      console.log('❌ Verification failed:', error);
    } else {
      console.log('✅ Server is ready to take our messages');
    }
  });
  
} catch (error) {
  console.error('❌ Error creating transporter:', error);
}
