// Mock email service for testing when Gmail is not available
const sendLoginOTP = async (email, otp, firstName = 'User') => {
  try {
    console.log('📧 MOCK EMAIL SERVICE - Login OTP');
    console.log('==================================');
    console.log('To:', email);
    console.log('Name:', firstName);
    console.log('OTP Code:', otp);
    console.log('Subject: Login Verification - Your OTP Code');
    console.log('==================================');
    console.log('Email Content:');
    console.log(`Hello ${firstName}!`);
    console.log(`Your login OTP code is: ${otp}`);
    console.log('This code will expire in 5 minutes.');
    console.log('If you didn\'t request this, please ignore this message.');
    console.log('==================================');
    console.log('✅ Mock email "sent" successfully!');
    
    // Return success response
    return { 
      success: true, 
      messageId: 'mock_' + Date.now(),
      mockEmail: true,
      otp: otp // Include OTP in response for testing
    };
    
  } catch (error) {
    console.error('❌ Mock email service error:', error);
    throw new Error(`Mock email failed: ${error.message}`);
  }
};

const sendRegistrationOTP = async (email, otp, firstName = 'User') => {
  try {
    console.log('📧 MOCK EMAIL SERVICE - Registration OTP');
    console.log('=========================================');
    console.log('To:', email);
    console.log('Name:', firstName);
    console.log('OTP Code:', otp);
    console.log('Subject: Email Verification - Your OTP Code');
    console.log('=========================================');
    console.log('✅ Mock registration email "sent" successfully!');
    
    return { 
      success: true, 
      messageId: 'mock_reg_' + Date.now(),
      mockEmail: true 
    };
    
  } catch (error) {
    console.error('❌ Mock registration email error:', error);
    throw new Error(`Mock email failed: ${error.message}`);
  }
};

const sendPasswordResetOTP = async (email, otp, firstName = 'User') => {
  try {
    console.log('📧 MOCK EMAIL SERVICE - Password Reset OTP');
    console.log('==========================================');
    console.log('To:', email);
    console.log('Name:', firstName);
    console.log('OTP Code:', otp);
    console.log('Subject: Password Reset - Your OTP Code');
    console.log('==========================================');
    console.log('✅ Mock password reset email "sent" successfully!');
    
    return { 
      success: true, 
      messageId: 'mock_reset_' + Date.now(),
      mockEmail: true 
    };
    
  } catch (error) {
    console.error('❌ Mock password reset email error:', error);
    throw new Error(`Mock email failed: ${error.message}`);
  }
};

module.exports = {
  sendLoginOTP,
  sendRegistrationOTP,
  sendPasswordResetOTP
};
