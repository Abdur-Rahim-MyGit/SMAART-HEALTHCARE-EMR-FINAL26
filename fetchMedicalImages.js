const axios = require('axios');
require('dotenv').config();

// Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN'; // Replace with a valid auth token

// Function to fetch medical images
async function fetchMedicalImages(patientId) {
  try {
    console.log(`Fetching medical images for patient: ${patientId}`);
    
    const response = await axios.get(`${API_BASE_URL}/medical-images/patient/${patientId}`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        status: 'Active' // Only fetch active images
      }
    });

    console.log('\n=== Medical Images ===');
    console.log(`Found ${response.data.count} images`);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log('\nSample Image Data:');
      const sample = response.data.data[0];
      console.log({
        id: sample._id,
        title: sample.title,
        imageType: sample.imageType,
        bodyPart: sample.bodyPart,
        imageUrl: sample.imageUrl.substring(0, 50) + '...', // Truncate URL for display
        uploadedAt: sample.createdAt,
        uploadedBy: sample.uploadedBy?.fullName || 'System'
      });
      
      console.log('\nAll Image Types:');
      const types = {};
      response.data.data.forEach(img => {
        types[img.imageType] = (types[img.imageType] || 0) + 1;
      });
      console.log(types);
      
    } else {
      console.log('No medical images found for this patient.');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching medical images:', {
      message: error.message,
      response: error.response?.data || 'No response data',
      status: error.response?.status
    });
    throw error;
  }
}

// Example usage
const patientId = 'YOUR_PATIENT_ID'; // Replace with actual patient ID
fetchMedicalImages(patientId)
  .then(data => console.log('\nData fetch complete!'))
  .catch(err => console.error('Failed to fetch data:', err));
