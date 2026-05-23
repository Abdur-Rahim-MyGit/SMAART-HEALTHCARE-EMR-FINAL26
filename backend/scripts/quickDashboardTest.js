const axios = require('axios');

const quickTest = async () => {
  try {
    // Login
    const login = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'supermaster@admin.com',
      password: 'password123'
    });
    
    const token = login.data.token;
    console.log('✅ Login successful');
    
    // Test dashboard
    const dashboard = await axios.get('http://localhost:5001/api/dashboard/super-master-stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const stats = dashboard.data.data.overview;
    console.log('📊 Dashboard Stats:');
    console.log(`   Clinics: ${stats.totalClinics}`);
    console.log(`   Users: ${stats.totalUsers}`);
    console.log(`   Doctors: ${stats.totalDoctors}`);
    console.log('🎉 Dashboard API working!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

quickTest();
