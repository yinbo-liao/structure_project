// Simulate exactly what the frontend is doing
const axios = require('axios');

// Configure axios like the frontend does
axios.defaults.baseURL = 'http://localhost:8000/api/v1';
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Simulate login and get token
async function testFrontendFlow() {
  try {
    // First login
    const loginResponse = await axios.post('/login', {
      username: 'admin@mpdms.com',
      password: 'admin'
    });
    
    console.log('Login successful');
    const token = loginResponse.data.access_token;
    
    // Set up axios interceptor like frontend does
    axios.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    
    // Test the auto-sync endpoint like frontend does
    const projectId = 1;
    console.log(`\nCalling autoSyncNDTStatus for project ${projectId}...`);
    
    const response = await axios.post(`/ndt-sync/auto-sync/${projectId}`);
    console.log(`Response status: ${response.status}`);
    
    const result = response.data;
    console.log(`\nResult type: ${typeof result}`);
    console.log(`Result keys: ${Object.keys(result)}`);
    
    // Check if synced_count exists
    if ('synced_count' in result) {
      console.log(`synced_count exists: ${result.synced_count} (type: ${typeof result.synced_count})`);
    } else {
      console.log('synced_count does NOT exist in result!');
    }
    
    // Check if skipped_count exists
    if ('skipped_count' in result) {
      console.log(`skipped_count exists: ${result.skipped_count} (type: ${typeof result.skipped_count})`);
    } else {
      console.log('skipped_count does NOT exist in result!');
    }
    
    // Try to create the message like frontend does
    try {
      const message = `Auto NDT sync completed: ${result.synced_count} joints updated, ${result.skipped_count} skipped`;
      console.log(`\nMessage would be: ${message}`);
    } catch (error) {
      console.log(`\nError creating message: ${error.message}`);
      console.log(`result.synced_count: ${result.synced_count}`);
      console.log(`result.skipped_count: ${result.skipped_count}`);
      console.log(`result: ${JSON.stringify(result, null, 2)}`);
    }
    
  } catch (error) {
    console.log(`\nError: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

testFrontendFlow();