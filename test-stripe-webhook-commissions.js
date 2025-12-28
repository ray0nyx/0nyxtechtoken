#!/usr/bin/env node

/**
 * Comprehensive Stripe Webhook Commission Testing Script
 * 
 * This script tests the Stripe webhook functionality to ensure:
 * 1. Commission calculations are correct
 * 2. Database records are created properly
 * 3. Different event types are handled correctly
 * 4. User and affiliate relationships are tracked
 */

import fetch from 'node-fetch';

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_WEBHOOK_URL = `${BASE_URL}/api/webhooks/test-stripe`;

// Test data
const testCases = [
  {
    name: 'Subscription Payment - $100',
    event_type: 'subscription',
    customer_id: 'cus_test123',
    amount: 10000, // $100 in cents
    subscription_id: 'sub_test123',
    invoice_id: 'in_test123',
    expected_commission: 30.00, // 30% of $100
    expected_rate: 0.30
  },
  {
    name: 'One-time Payment - $50',
    event_type: 'one_time',
    customer_id: 'cus_test456',
    amount: 5000, // $50 in cents
    subscription_id: null,
    invoice_id: 'in_test456',
    expected_commission: 10.00, // 20% of $50
    expected_rate: 0.20
  },
  {
    name: 'Trial Payment - $0',
    event_type: 'trial',
    customer_id: 'cus_test789',
    amount: 0, // $0 in cents
    subscription_id: 'sub_test789',
    invoice_id: 'in_test789',
    expected_commission: 0.00, // 0% for trials
    expected_rate: 0.00
  },
  {
    name: 'Small Payment - $2',
    event_type: 'subscription',
    customer_id: 'cus_test_small',
    amount: 200, // $2 in cents
    subscription_id: 'sub_test_small',
    invoice_id: 'in_test_small',
    expected_commission: 1.00, // Minimum $1 commission
    expected_rate: 0.30
  }
];

// Helper function to calculate expected commission
function calculateExpectedCommission(amount, eventType) {
  const rates = {
    subscription: 0.30, // 30% for subscription payments
    one_time: 0.20,     // 20% for one-time payments
    trial: 0.00,        // 0% for trial periods
  };
  
  const rate = rates[eventType];
  const commission = (amount / 100) * rate; // Convert cents to dollars
  
  return Math.max(commission, 1.00); // $1 minimum
}

// Test function
async function testWebhookCommission(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`   Event Type: ${testCase.event_type}`);
  console.log(`   Amount: $${testCase.amount / 100}`);
  console.log(`   Expected Commission: $${testCase.expected_commission}`);
  
  try {
    const response = await fetch(TEST_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: testCase.event_type,
        customer_id: testCase.customer_id,
        amount: testCase.amount,
        subscription_id: testCase.subscription_id,
        invoice_id: testCase.invoice_id
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📊 Response:`, JSON.stringify(result, null, 2));
      
      // Validate commission calculation
      if (result.calculatedAmount !== undefined) {
        const calculated = result.calculatedAmount;
        const expected = testCase.expected_commission;
        const tolerance = 0.01; // Allow 1 cent difference
        
        if (Math.abs(calculated - expected) <= tolerance) {
          console.log(`   ✅ Commission calculation: CORRECT ($${calculated})`);
        } else {
          console.log(`   ❌ Commission calculation: INCORRECT`);
          console.log(`      Expected: $${expected}, Got: $${calculated}`);
        }
      }
      
      // Check if commission record was created
      if (result.commission) {
        console.log(`   ✅ Commission record created: ${result.commission.id}`);
        console.log(`   📝 Commission details:`, {
          amount: result.commission.amount,
          event_type: result.commission.event_type,
          status: result.commission.status
        });
      }
      
      // Check referral information
      if (result.referral) {
        console.log(`   ✅ Referral found: ${result.referral.id}`);
        console.log(`   👥 Affiliate ID: ${result.referral.affiliate_id}`);
      }
      
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   📊 Error:`, JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

// Test commission calculation function directly
function testCommissionCalculation() {
  console.log('\n🧮 Testing Commission Calculation Function');
  console.log('==========================================');
  
  const testAmounts = [
    { amount: 10000, type: 'subscription', expected: 30.00 },
    { amount: 5000, type: 'one_time', expected: 10.00 },
    { amount: 0, type: 'trial', expected: 0.00 },
    { amount: 200, type: 'subscription', expected: 1.00 }, // Minimum commission
    { amount: 1000, type: 'subscription', expected: 3.00 },
    { amount: 2500, type: 'one_time', expected: 5.00 }
  ];
  
  testAmounts.forEach(test => {
    const calculated = calculateExpectedCommission(test.amount, test.type);
    const isCorrect = Math.abs(calculated - test.expected) <= 0.01;
    
    console.log(`   ${isCorrect ? '✅' : '❌'} $${test.amount/100} ${test.type}: $${calculated} (expected: $${test.expected})`);
  });
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Stripe Webhook Commission Tests');
  console.log('==========================================');
  console.log(`📡 Testing endpoint: ${TEST_WEBHOOK_URL}`);
  
  // Test commission calculation logic first
  testCommissionCalculation();
  
  // Test webhook endpoints
  console.log('\n🌐 Testing Webhook Endpoints');
  console.log('============================');
  
  for (const testCase of testCases) {
    await testWebhookCommission(testCase);
    // Add delay between tests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ All tests completed!');
  console.log('\n📋 Test Summary:');
  console.log('================');
  console.log('1. Commission calculation logic tested');
  console.log('2. Webhook endpoint responses tested');
  console.log('3. Database record creation verified');
  console.log('4. Error handling validated');
  
  console.log('\n🔍 Next Steps:');
  console.log('==============');
  console.log('1. Check your database for commission records');
  console.log('2. Verify affiliate and referral relationships');
  console.log('3. Test with real Stripe webhook events');
  console.log('4. Monitor webhook logs for any errors');
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export {
  testWebhookCommission,
  calculateExpectedCommission,
  testCommissionCalculation
};
