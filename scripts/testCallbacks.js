const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/callback';

async function testCallbacks() {
    console.log('Testing callback routes...');

    try {
        // Test RupeeFlow Route
        console.log('\n--- Testing RupeeFlow ---');
        const rfRes = await axios.post(`${BASE_URL}/rupeeflow`, {
            status: 'credit',
            client_id: 'NON_EXISTENT_ID',
            amount: 100
        });
        console.log('RupeeFlow Response:', rfRes.data);
    } catch (e) {
        console.log('RupeeFlow Error (Expected if order not found):', e.response?.data || e.message);
    }

    try {
        // Test CGPEY Route
        console.log('\n--- Testing CGPEY ---');
        const cgRes = await axios.post(`${BASE_URL}/cgpey`, {
            status: 'SUCCESS',
            order_id: 'NON_EXISTENT_ID',
            amount: 100
        });
        console.log('CGPEY Response:', cgRes.data);
    } catch (e) {
        console.log('CGPEY Error (Expected if order not found):', e.response?.data || e.message);
    }
}

testCallbacks();
