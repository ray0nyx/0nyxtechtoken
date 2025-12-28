#!/usr/bin/env node

/**
 * Simple Webhook Test (No Database Required)
 * 
 * This script tests the webhook commission calculation logic
 * without requiring database connections or environment variables.
 */

// Commission calculation function (matches webhook logic)
function calculateCommission(amount, type) {
  const rates = {
    subscription: 0.30, // 30% for subscription payments
    one_time: 0.20,     // 20% for one-time payments
    trial: 0.00,        // 0% for trial periods
  };
  
  const rate = rates[type];
  const commission = (amount / 100) * rate; // Stripe amounts are in cents
  
  // Only apply minimum commission for non-trial payments
  if (type === 'trial') {
    return commission; // $0 for trials
  }
  
  return Math.max(commission, 1.00); // $1 minimum for other types
}

// Test cases
const testCases = [
  {
    name: 'Subscription Payment - $29.99',
    amount: 2999, // $29.99 in cents
    type: 'subscription',
    expected: 8.997 // 30% of $29.99
  },
  {
    name: 'One-time Payment - $49.99',
    amount: 4999, // $49.99 in cents
    type: 'one_time',
    expected: 9.998 // 20% of $49.99
  },
  {
    name: 'Trial Payment - $0',
    amount: 0, // $0 in cents
    type: 'trial',
    expected: 0.00 // 0% for trials
  },
  {
    name: 'Small Payment - $2.00',
    amount: 200, // $2.00 in cents
    type: 'subscription',
    expected: 1.00 // Minimum commission
  },
  {
    name: 'Large Subscription - $199.99',
    amount: 19999, // $199.99 in cents
    type: 'subscription',
    expected: 59.997 // 30% of $199.99
  },
  {
    name: 'Large One-time - $999.99',
    amount: 99999, // $999.99 in cents
    type: 'one_time',
    expected: 199.998 // 20% of $999.99
  }
];

// Test function
function testCommissionCalculation() {
  console.log('🧮 Testing Commission Calculation Logic');
  console.log('======================================');
  console.log('Commission Rates:');
  console.log('  - Subscription: 30%');
  console.log('  - One-time: 20%');
  console.log('  - Trial: 0%');
  console.log('  - Minimum: $1.00');
  console.log('');

  let passed = 0;
  let total = testCases.length;

  testCases.forEach((test, index) => {
    const calculated = calculateCommission(test.amount, test.type);
    const isCorrect = Math.abs(calculated - test.expected) <= 0.01; // Allow 1 cent difference
    
    if (isCorrect) {
      passed++;
      console.log(`✅ Test ${index + 1}: ${test.name}`);
      console.log(`   Amount: $${(test.amount / 100).toFixed(2)}`);
      console.log(`   Type: ${test.type}`);
      console.log(`   Commission: $${calculated.toFixed(2)}`);
    } else {
      console.log(`❌ Test ${index + 1}: ${test.name}`);
      console.log(`   Amount: $${(test.amount / 100).toFixed(2)}`);
      console.log(`   Type: ${test.type}`);
      console.log(`   Expected: $${test.expected.toFixed(2)}`);
      console.log(`   Got: $${calculated.toFixed(2)}`);
    }
    console.log('');
  });

  console.log('📊 Test Results');
  console.log('===============');
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (passed === total) {
    console.log('🎉 All commission calculations are correct!');
  } else {
    console.log('⚠️  Some calculations are incorrect. Check the logic above.');
  }

  return passed === total;
}

// Test webhook endpoint availability
async function testWebhookEndpoint() {
  console.log('\n🌐 Testing Webhook Endpoint');
  console.log('============================');
  
  const testUrl = 'http://localhost:3000/api/webhooks/test-stripe';
  
  try {
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'subscription',
        customer_id: 'cus_test123',
        amount: 2999,
        subscription_id: 'sub_test123',
        invoice_id: 'in_test123'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook endpoint is accessible');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(result, null, 2)}`);
      return true;
    } else {
      console.log('❌ Webhook endpoint returned error');
      console.log(`   Status: ${response.status}`);
      const error = await response.text();
      console.log(`   Error: ${error}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook endpoint is not accessible');
    console.log(`   Error: ${error.message}`);
    console.log('   Make sure your development server is running: npm run dev');
    return false;
  }
}

// Main test runner
async function runSimpleTests() {
  console.log('🚀 Simple Webhook Commission Tests');
  console.log('==================================');
  console.log('This test verifies commission calculation logic without requiring database access.\n');

  // Test commission calculations
  const calculationPassed = testCommissionCalculation();

  // Test webhook endpoint
  const endpointAccessible = await testWebhookEndpoint();

  console.log('\n🎯 Summary');
  console.log('==========');
  console.log(`Commission Logic: ${calculationPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Webhook Endpoint: ${endpointAccessible ? '✅ ACCESSIBLE' : '❌ NOT ACCESSIBLE'}`);

  if (calculationPassed && endpointAccessible) {
    console.log('\n🎉 All basic tests passed! Your webhook system is ready for full testing.');
    console.log('\nNext steps:');
    console.log('1. Set up your environment variables');
    console.log('2. Run: npm run verify:commissions');
    console.log('3. Run: npm run test:webhook');
  } else {
    console.log('\n⚠️  Some tests failed. Please fix the issues above before proceeding.');
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSimpleTests().catch(console.error);
}

export {
  calculateCommission,
  testCommissionCalculation,
  testWebhookEndpoint
};
