const axios = require('axios');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const testDashboardAPI = async () => {
  try {
    console.log('🔄 Testing Super Master Admin Dashboard API...');
    
    // Create a test JWT token for super_master_admin
    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key_here_change_in_production';
    console.log('🔐 Using JWT Secret:', jwtSecret.substring(0, 10) + '...');
    
    const token = jwt.sign(
      { 
        userId: 'test-super-master-admin',
        role: 'super_master_admin',
        email: 'supermaster@admin.com'
      }, 
      jwtSecret,
      { expiresIn: '1h' }
    );
    
    console.log('🔑 Generated test token for super_master_admin');
    
    // Test the dashboard stats endpoint
    const response = await axios.get('http://localhost:5001/api/dashboard/super-master-stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API Response Status:', response.status);
    console.log('📊 Dashboard Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      const { overview } = response.data.data;
      console.log('\n📈 Statistics Summary:');
      console.log(`   Total Clinics: ${overview.totalClinics}`);
      console.log(`   Total Users: ${overview.totalUsers}`);
      console.log(`   Active Doctors: ${overview.totalDoctors}`);
      console.log(`   Total Appointments: ${overview.totalAppointments}`);
      console.log(`   Lab Tests: ${overview.totalLabTests}`);
      console.log(`   Referrals: ${overview.totalReferrals}`);
      console.log(`   Revenue: ${overview.totalRevenue}`);
      
      console.log('\n🎉 Dashboard API is working correctly!');
    } else {
      console.log('❌ API returned unsuccessful response');
    }
    
  } catch (error) {
    console.error('❌ Error testing dashboard API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
};

// Run the test
testDashboardAPI();
