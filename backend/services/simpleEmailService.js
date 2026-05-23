const nodemailer = require('nodemailer');

const sendLoginOTP = async (email, otp, firstName = 'User') => {
  try {
    console.log('🔄 Simple email service - Starting sendLoginOTP...');
    
    // Create transporter directly
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    
    console.log('📮 Simple transporter created successfully');
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Login OTP - Smaart Healthcare',
      text: `Hello ${firstName}! Your login OTP is: ${otp}. This code will expire in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Smaart Healthcare - Login OTP</h2>
          <p>Hello ${firstName}!</p>
          <p>Your login OTP code is: <strong style="font-size: 24px; color: #27ae60;">${otp}</strong></p>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `
    };
    
    console.log('📧 Sending email to:', email);
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Simple email sent successfully:', info.messageId);
    
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Simple email service error:', error);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

module.exports = {
  sendLoginOTP
};
