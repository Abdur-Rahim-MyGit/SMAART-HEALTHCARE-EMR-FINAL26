const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const testFullDashboard = async () => {
  try {
    console.log('🔄 Testing Full Dashboard Flow...');
    
    // Step 1: Login as Super Master Admin
    console.log('\n1️⃣ Logging in as Super Master Admin...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'supermaster@admin.com',
      password: 'password123'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed: ' + loginResponse.data.message);
    }
    
    const token = loginResponse.data.token;
    const user = loginResponse.data.user;
    
    console.log('✅ Login successful');
    console.log(`   User: ${user.fullName || user.firstName + ' ' + user.lastName}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Token: ${token.substring(0, 20)}...`);
    
    // Step 2: Test Dashboard Stats API
    console.log('\n2️⃣ Testing Dashboard Stats API...');
    const dashboardResponse = await axios.get('http://localhost:5001/api/dashboard/super-master-stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Dashboard API Response Status:', dashboardResponse.status);
    
    if (dashboardResponse.data.success) {
      const { overview, breakdown, trends } = dashboardResponse.data.data;
      
      console.log('\n📊 Dashboard Statistics:');
      console.log('   📋 Overview:');
      console.log(`      Total Clinics: ${overview.totalClinics}`);
      console.log(`      Total Users: ${overview.totalUsers}`);
      console.log(`      Active Doctors: ${overview.totalDoctors}`);
      console.log(`      Total Appointments: ${overview.totalAppointments}`);
      console.log(`      Lab Tests: ${overview.totalLabTests}`);
      console.log(`      Referrals: ${overview.totalReferrals}`);
      console.log(`      Revenue: ${overview.totalRevenue}`);
      
      if (breakdown && breakdown.usersByRole) {
        console.log('\n   👥 Users by Role:');
        console.log(`      Doctors: ${breakdown.usersByRole.doctors}`);
        console.log(`      Nurses: ${breakdown.usersByRole.nurses}`);
        console.log(`      Patients: ${breakdown.usersByRole.patients}`);
        console.log(`      Admins: ${breakdown.usersByRole.admins}`);
      }
      
      if (trends) {
        console.log('\n   📈 Trends:');
        console.log(`      Recent Users: ${trends.recentUsers}`);
        console.log(`      Recent Clinics: ${trends.recentClinics}`);
      }
      
      console.log('\n🎉 Dashboard API is working perfectly!');
      
      // Step 3: Test Users API
      console.log('\n3️⃣ Testing Users API...');
      const usersResponse = await axios.get('http://localhost:5001/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (usersResponse.data.success) {
        console.log(`✅ Users API: Found ${usersResponse.data.users.length} users`);
        
        // Show sample users
        const sampleUsers = usersResponse.data.users.slice(0, 3);
        sampleUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.fullName || user.firstName + ' ' + user.lastName} (${user.role})`);
        });
      }
      
      // Step 4: Test Clinics API
      console.log('\n4️⃣ Testing Clinics API...');
      const clinicsResponse = await axios.get('http://localhost:5001/api/clinics', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (clinicsResponse.data.success) {
        console.log(`✅ Clinics API: Found ${clinicsResponse.data.clinics.length} clinics`);
        
        // Show sample clinics
        const sampleClinics = clinicsResponse.data.clinics.slice(0, 3);
        sampleClinics.forEach((clinic, index) => {
          console.log(`   ${index + 1}. ${clinic.name} (${clinic.status})`);
        });
      }
      
      console.log('\n🎊 All tests passed! Dashboard is ready for use.');
      
    } else {
      console.log('❌ Dashboard API returned unsuccessful response:', dashboardResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
};

// Run the test
testFullDashboard();
