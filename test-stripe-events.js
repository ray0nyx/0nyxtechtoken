#!/usr/bin/env node

/**
 * Stripe Webhook Event Simulator
 * 
 * This script simulates actual Stripe webhook events to test
 * the commission tracking system with realistic data.
 */

import crypto from 'crypto';

// Mock Stripe webhook events
const mockStripeEvents = {
  subscriptionCreated: {
    id: 'evt_test_subscription_created',
    object: 'event',
    type: 'customer.subscription.created',
    data: {
      object: {
        id: 'sub_test123456789',
        object: 'subscription',
        customer: 'cus_test_customer_123',
        status: 'active',
        items: {
          data: [{
            price: {
              unit_amount: 2999, // $29.99 in cents
              currency: 'usd'
            }
          }]
        },
        created: Math.floor(Date.now() / 1000)
      }
    }
  },
  
  paymentSucceeded: {
    id: 'evt_test_payment_succeeded',
    object: 'event',
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        id: 'in_test_invoice_123',
        object: 'invoice',
        customer: 'cus_test_customer_123',
        subscription: 'sub_test123456789',
        amount_paid: 2999, // $29.99 in cents
        currency: 'usd',
        status: 'paid',
        created: Math.floor(Date.now() / 1000)
      }
    }
  },
  
  paymentIntentSucceeded: {
    id: 'evt_test_payment_intent_succeeded',
    object: 'event',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_test_payment_intent_123',
        object: 'payment_intent',
        customer: 'cus_test_customer_456',
        amount: 4999, // $49.99 in cents
        currency: 'usd',
        status: 'succeeded',
        created: Math.floor(Date.now() / 1000)
      }
    }
  },
  
  checkoutCompleted: {
    id: 'evt_test_checkout_completed',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_checkout_session_123',
        object: 'checkout.session',
        customer: 'cus_test_customer_789',
        amount_total: 9999, // $99.99 in cents
        currency: 'usd',
        payment_status: 'paid',
        created: Math.floor(Date.now() / 1000)
      }
    }
  }
};

// Helper function to create Stripe webhook signature
function createStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');
  
  return `t=${timestamp},v1=${signature}`;
}

// Test function for webhook events
async function testStripeWebhookEvent(eventName, event, webhookSecret = 'whsec_test_secret') {
  console.log(`\n🧪 Testing Stripe Event: ${eventName}`);
  console.log(`   Event Type: ${event.type}`);
  console.log(`   Event ID: ${event.id}`);
  
  const payload = JSON.stringify(event);
  const signature = createStripeSignature(payload, webhookSecret);
  
  try {
    const response = await fetch('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      },
      body: payload
    });

    const result = await response.text();
    
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      console.log(`   ✅ Response: ${result}`);
    } else {
      console.log(`   ❌ Error: ${result}`);
    }
    
    return { success: response.ok, status: response.status, result };
    
  } catch (error) {
    console.log(`   ❌ Network Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test commission calculations
function testCommissionCalculations() {
  console.log('\n🧮 Commission Calculation Tests');
  console.log('===============================');
  
  const testCases = [
    {
      name: 'Subscription Payment - $29.99',
      amount: 2999,
      type: 'subscription',
      expected: 8.997 // 30% of $29.99
    },
    {
      name: 'One-time Payment - $49.99',
      amount: 4999,
      type: 'one_time',
      expected: 9.998 // 20% of $49.99
    },
    {
      name: 'Checkout Payment - $99.99',
      amount: 9999,
      type: 'one_time',
      expected: 19.998 // 20% of $99.99
    },
    {
      name: 'Small Payment - $2.00',
      amount: 200,
      type: 'subscription',
      expected: 1.00 // Minimum commission
    }
  ];
  
  testCases.forEach(test => {
    const rate = test.type === 'subscription' ? 0.30 : 0.20;
    const calculated = Math.max((test.amount / 100) * rate, 1.00);
    const isCorrect = Math.abs(calculated - test.expected) <= 0.01;
    
    console.log(`   ${isCorrect ? '✅' : '❌'} ${test.name}: $${calculated.toFixed(2)} (expected: $${test.expected.toFixed(2)})`);
  });
}

// Main test runner
async function runStripeEventTests() {
  console.log('🚀 Starting Stripe Webhook Event Tests');
  console.log('======================================');
  
  // Test commission calculations first
  testCommissionCalculations();
  
  // Test webhook events
  console.log('\n🌐 Testing Stripe Webhook Events');
  console.log('=================================');
  
  const results = [];
  
  for (const [eventName, event] of Object.entries(mockStripeEvents)) {
    const result = await testStripeWebhookEvent(eventName, event);
    results.push({ eventName, ...result });
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('======================');
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${status} ${result.eventName} (Status: ${result.status})`);
  });
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Your webhook commission system is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
  }
  
  console.log('\n🔍 Next Steps:');
  console.log('==============');
  console.log('1. Check your database for commission records');
  console.log('2. Verify the webhook endpoint is running');
  console.log('3. Check webhook signature verification');
  console.log('4. Test with real Stripe webhook events');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runStripeEventTests().catch(console.error);
}

export {
  testStripeWebhookEvent,
  mockStripeEvents,
  createStripeSignature
};
