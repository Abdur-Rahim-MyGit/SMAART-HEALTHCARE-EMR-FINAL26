const nodemailer = require("nodemailer");

// Create email transporter
const createTransporter = () => {
  try {
    // If EMAIL_USER or EMAIL_PASS not provided, fall back to a safe jsonTransport
    // so local development and CI won't fail when sending emails.
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      console.warn(
        "⚠️ EMAIL_USER or EMAIL_PASS not set — using jsonTransport fallback (development mode)."
      );
      const transporter = nodemailer.createTransport({ jsonTransport: true });
      return transporter;
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_PORT === "465", // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    console.log("✅ Email transporter created successfully (SMTP)");
    return transporter;
  } catch (error) {
    console.error("❌ Failed to create email transporter:", error);
    // In case createTransport throws for unexpected reasons, fall back to jsonTransport
    try {
      console.warn(
        "⚠️ Falling back to jsonTransport due to transporter creation error."
      );
      return nodemailer.createTransport({ jsonTransport: true });
    } catch (err) {
      console.error("❌ Failed to create fallback transporter:", err);
      throw err;
    }
  }
};

// Send OTP email for registration
const sendRegistrationOTP = async (email, otp, firstName = "User") => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: "Smaart Healthcare System",
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: "Email Verification - Your OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50; margin: 0;">Smaart Healthcare</h1>
              <p style="color: #7f8c8d; margin: 5px 0;">Email Verification Required</p>
            </div>
            
            <h2 style="color: #34495e; margin-bottom: 20px;">Hello ${firstName}!</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Thank you for registering with Smaart Healthcare System. To complete your registration, please verify your email address using the OTP code below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background-color: #3498db; color: white; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
                ${otp}
              </div>
            </div>
            
            <div style="background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="color: #e74c3c; font-weight: bold; margin: 0 0 10px 0;">⚠️ Important:</p>
              <ul style="color: #555; margin: 0; padding-left: 20px;">
                <li>This OTP will expire in <strong>10 minutes</strong></li>
                <li>Do not share this code with anyone</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
            </div>
            
            <p style="color: #555; font-size: 14px; margin-top: 30px;">
              If you have any questions or need assistance, please contact our support team.
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1;">
              <p style="color: #95a5a6; font-size: 12px; margin: 0;">
                © 2024 Smaart Healthcare System. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
        Hello ${firstName}!
        
        Thank you for registering with Smaart Healthcare System.
        
        Your OTP verification code is: ${otp}
        
        This code will expire in 10 minutes. Please do not share this code with anyone.
        
        If you didn't request this, please ignore this email.
        
        Best regards,
        Smaart Healthcare Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Registration OTP email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send registration OTP email:", error);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

// Send OTP email for password reset
const sendPasswordResetOTP = async (email, otp, firstName = "User") => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: "Smaart Healthcare System",
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: "Password Reset - Your OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50; margin: 0;">Smaart Healthcare</h1>
              <p style="color: #e74c3c; margin: 5px 0;">Password Reset Request</p>
            </div>
            
            <h2 style="color: #34495e; margin-bottom: 20px;">Hello ${firstName}!</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              We received a request to reset your password for your Smaart Healthcare account. Use the OTP code below to proceed with password reset:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background-color: #e74c3c; color: white; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
                ${otp}
              </div>
            </div>
            
            <div style="background-color: #fdf2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
              <p style="color: #e74c3c; font-weight: bold; margin: 0 0 10px 0;">🔒 Security Notice:</p>
              <ul style="color: #555; margin: 0; padding-left: 20px;">
                <li>This OTP will expire in <strong>10 minutes</strong></li>
                <li>Only use this code if you requested a password reset</li>
                <li>If you didn't request this, please secure your account immediately</li>
              </ul>
            </div>
            
            <p style="color: #555; font-size: 14px; margin-top: 30px;">
              If you didn't request a password reset, please contact our support team immediately.
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1;">
              <p style="color: #95a5a6; font-size: 12px; margin: 0;">
                © 2024 Smaart Healthcare System. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
        Hello ${firstName}!
        
        We received a request to reset your password for your Smaart Healthcare account.
        
        Your password reset OTP code is: ${otp}
        
        This code will expire in 10 minutes. Only use this code if you requested a password reset.
        
        If you didn't request this, please contact our support team immediately.
        
        Best regards,
        Smaart Healthcare Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Password reset OTP email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send password reset OTP email:", error);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("✅ Email configuration is valid");
    return { success: true, message: "Email configuration is valid" };
  } catch (error) {
    console.error("❌ Email configuration error:", error);
    return { success: false, error: error.message };
  }
};

// Send welcome email after successful registration
const sendWelcomeEmail = async (email, firstName, role) => {
  try {
    const transporter = createTransporter();

    const roleDisplayName =
      {
        doctor: "Doctor",
        nurse: "Nurse",
        patient: "Patient",
        super_admin: "Super Admin",
        clinic_admin: "Clinic Admin",
      }[role] || "User";

    const mailOptions = {
      from: {
        name: "Smaart Healthcare System",
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: "Welcome to Smaart Healthcare System!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50; margin: 0;">Welcome to Smaart Healthcare!</h1>
              <p style="color: #27ae60; margin: 5px 0;">Registration Successful</p>
            </div>
            
            <h2 style="color: #34495e; margin-bottom: 20px;">Hello ${firstName}!</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              Congratulations! Your account has been successfully created and verified. You are now registered as a <strong>${roleDisplayName}</strong> in our healthcare management system.
            </p>
            
            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="color: #27ae60; margin: 0 0 15px 0;">🎉 What's Next?</h3>
              <ul style="color: #555; margin: 0; padding-left: 20px;">
                <li>Log in to your dashboard to explore features</li>
                <li>Complete your profile information</li>
                <li>Start using our healthcare management tools</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="display: inline-block; background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Access Your Dashboard
              </a>
            </div>
            
            <p style="color: #555; font-size: 14px; margin-top: 30px;">
              If you have any questions or need assistance, our support team is here to help.
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1;">
              <p style="color: #95a5a6; font-size: 12px; margin: 0;">
                © 2024 Smaart Healthcare System. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Welcome email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    // Don't throw error for welcome email as it's not critical
    return { success: false, error: error.message };
  }
};

// Send OTP email for login
const sendLoginOTP = async (email, otp, firstName = "User") => {
  try {
    console.log("🔄 Starting sendLoginOTP function...");
    console.log("📧 Email:", email, "OTP:", otp, "Name:", firstName);

    const transporter = createTransporter();
    console.log("📮 Transporter created, type:", typeof transporter);

    const mailOptions = {
      from: {
        name: "Smaart Healthcare System",
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: "Login Verification - Your OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50; margin: 0;">Smaart Healthcare</h1>
              <p style="color: #27ae60; margin: 5px 0;">Secure Login Verification</p>
            </div>
            
            <h2 style="color: #34495e; margin-bottom: 20px;">Hello ${firstName}!</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              We received a login request for your Smaart Healthcare account. To complete your secure login, please use the OTP code below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background-color: #27ae60; color: white; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
                ${otp}
              </div>
            </div>
            
            <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #27ae60;">
              <p style="color: #27ae60; font-weight: bold; margin: 0 0 10px 0;">🔐 Security Information:</p>
              <ul style="color: #555; margin: 0; padding-left: 20px;">
                <li>This OTP will expire in <strong>5 minutes</strong></li>
                <li>Only use this code if you initiated the login</li>
                <li>Never share this code with anyone</li>
                <li>If you didn't request this login, please secure your account</li>
              </ul>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p style="color: #856404; font-weight: bold; margin: 0 0 10px 0;">⚠️ Didn't request this?</p>
              <p style="color: #856404; margin: 0; font-size: 14px;">
                If you didn't try to log in, someone may be trying to access your account. Please change your password immediately and contact our support team.
              </p>
            </div>
            
            <p style="color: #555; font-size: 14px; margin-top: 30px;">
              This is an automated security message from Smaart Healthcare System.
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1;">
              <p style="color: #95a5a6; font-size: 12px; margin: 0;">
                © 2024 Smaart Healthcare System. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
        Hello ${firstName}!
        
        We received a login request for your Smaart Healthcare account.
        
        Your login verification OTP code is: ${otp}
        
        This code will expire in 5 minutes. Only use this code if you initiated the login.
        
        If you didn't request this login, please secure your account immediately.
        
        Best regards,
        Smaart Healthcare Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Login OTP email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send login OTP email:", error);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

module.exports = {
  sendRegistrationOTP,
  sendPasswordResetOTP,
  sendLoginOTP,
  sendWelcomeEmail,
  testEmailConfig,
};
