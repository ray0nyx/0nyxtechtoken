#!/usr/bin/env node

/**
 * Test script for Stripe webhook system
 * This script tests the webhook functions to ensure they work correctly
 */

const https = require('https');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const TEST_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/test-stripe-webhook`;

// Test data
const testData = {
  event_type: 'subscription',
  customer_id: 'cus_test_123456789',
  amount: 29.99,
  subscription_id: 'sub_test_123456789',
  invoice_id: 'in_test_123456789'
};

console.log('🧪 Testing Stripe Webhook System...');
console.log('📡 Webhook URL:', TEST_WEBHOOK_URL);
console.log('📊 Test Data:', JSON.stringify(testData, null, 2));

// Make the test request
const postData = JSON.stringify(testData);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(TEST_WEBHOOK_URL, options, (res) => {
  console.log(`\n📈 Response Status: ${res.statusCode}`);
  console.log('📋 Response Headers:', res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('✅ Response Body:', JSON.stringify(response, null, 2));
      
      if (res.statusCode === 200) {
        console.log('\n🎉 Webhook test successful!');
        if (response.success) {
          console.log('✅ Commission created successfully');
          console.log(`💰 Commission Amount: $${response.calculatedAmount}`);
        } else {
          console.log('⚠️  No commission created (expected for test data)');
        }
      } else {
        console.log('\n❌ Webhook test failed');
        console.log('Error:', response.error || 'Unknown error');
      }
    } catch (error) {
      console.log('\n❌ Failed to parse response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.log('\n❌ Request failed:', error.message);
  console.log('\n💡 Make sure:');
  console.log('   1. Your Supabase project is deployed');
  console.log('   2. The webhook function is deployed');
  console.log('   3. The SUPABASE_URL environment variable is set correctly');
});

req.write(postData);
req.end();

console.log('\n⏳ Sending test request...');
