#!/usr/bin/env node

/**
 * Commission Tracking Verification Script
 * 
 * This script verifies that commissions are being properly tracked
 * in the database after webhook events are processed.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Verification functions
async function checkDatabaseTables() {
  console.log('🔍 Checking Database Tables');
  console.log('===========================');
  
  const tables = ['affiliates', 'referrals', 'commissions', 'user_subscriptions'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ ${table}: Table exists and accessible`);
      }
    } catch (err) {
      console.log(`   ❌ ${table}: ${err.message}`);
    }
  }
}

async function checkAffiliates() {
  console.log('\n👥 Checking Affiliates');
  console.log('======================');
  
  try {
    const { data: affiliates, error } = await supabase
      .from('affiliates')
      .select('*')
      .limit(5);
    
    if (error) {
      console.log(`   ❌ Error fetching affiliates: ${error.message}`);
      return;
    }
    
    if (affiliates && affiliates.length > 0) {
      console.log(`   ✅ Found ${affiliates.length} affiliates`);
      affiliates.forEach(affiliate => {
        console.log(`      - ${affiliate.name || affiliate.email} (${affiliate.status})`);
      });
    } else {
      console.log('   ⚠️  No affiliates found. You may need to create test data.');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
}

async function checkReferrals() {
  console.log('\n🔗 Checking Referrals');
  console.log('=====================');
  
  try {
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select(`
        *,
        affiliates(name, email),
        commissions(*)
      `)
      .limit(10);
    
    if (error) {
      console.log(`   ❌ Error fetching referrals: ${error.message}`);
      return;
    }
    
    if (referrals && referrals.length > 0) {
      console.log(`   ✅ Found ${referrals.length} referrals`);
      referrals.forEach(referral => {
        const affiliate = referral.affiliates;
        const commissionCount = referral.commissions ? referral.commissions.length : 0;
        console.log(`      - User: ${referral.user_id} | Affiliate: ${affiliate?.name || 'Unknown'} | Commissions: ${commissionCount}`);
      });
    } else {
      console.log('   ⚠️  No referrals found. You may need to create test data.');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
}

async function checkCommissions() {
  console.log('\n💰 Checking Commissions');
  console.log('=======================');
  
  try {
    const { data: commissions, error } = await supabase
      .from('commissions')
      .select(`
        *,
        referrals(
          affiliates(name, email)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.log(`   ❌ Error fetching commissions: ${error.message}`);
      return;
    }
    
    if (commissions && commissions.length > 0) {
      console.log(`   ✅ Found ${commissions.length} commissions`);
      
      let totalAmount = 0;
      const statusCounts = {};
      
      commissions.forEach(commission => {
        const affiliate = commission.referrals?.affiliates;
        totalAmount += parseFloat(commission.amount || 0);
        
        statusCounts[commission.status] = (statusCounts[commission.status] || 0) + 1;
        
        console.log(`      - $${commission.amount} (${commission.event_type}) - ${commission.status} | Affiliate: ${affiliate?.name || 'Unknown'}`);
      });
      
      console.log(`\n   📊 Commission Summary:`);
      console.log(`      Total Amount: $${totalAmount.toFixed(2)}`);
      console.log(`      Status Breakdown:`, statusCounts);
      
    } else {
      console.log('   ⚠️  No commissions found. This could mean:');
      console.log('      - No webhook events have been processed yet');
      console.log('      - No users have been referred by affiliates');
      console.log('      - Commission tracking is not working properly');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
}

async function checkUserSubscriptions() {
  console.log('\n💳 Checking User Subscriptions');
  console.log('===============================');
  
  try {
    const { data: subscriptions, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .limit(5);
    
    if (error) {
      console.log(`   ❌ Error fetching subscriptions: ${error.message}`);
      return;
    }
    
    if (subscriptions && subscriptions.length > 0) {
      console.log(`   ✅ Found ${subscriptions.length} user subscriptions`);
      subscriptions.forEach(sub => {
        console.log(`      - User: ${sub.user_id} | Customer: ${sub.stripe_customer_id} | Status: ${sub.status}`);
      });
    } else {
      console.log('   ⚠️  No user subscriptions found.');
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
}

async function createTestData() {
  console.log('\n🧪 Creating Test Data');
  console.log('=====================');
  
  try {
    // Create a test affiliate
    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .insert([{
        name: 'Test Affiliate',
        email: 'test@affiliate.com',
        status: 'active',
        referral_code: 'TEST123',
        commission_rate: 0.30,
        affiliate_code: 'AFF_TEST123'
      }])
      .select()
      .single();
    
    if (affiliateError) {
      console.log(`   ⚠️  Could not create test affiliate: ${affiliateError.message}`);
    } else {
      console.log(`   ✅ Created test affiliate: ${affiliate.id}`);
      
      // Create a test referral
      const { data: referral, error: referralError } = await supabase
        .from('referrals')
        .insert([{
          affiliate_id: affiliate.id,
          user_id: '00000000-0000-0000-0000-000000000000', // Dummy user ID
          email: 'testuser@example.com',
          referral_code: 'TEST123',
          status: 'active',
          commission_rate: 0.30
        }])
        .select()
        .single();
      
      if (referralError) {
        console.log(`   ⚠️  Could not create test referral: ${referralError.message}`);
      } else {
        console.log(`   ✅ Created test referral: ${referral.id}`);
      }
    }
  } catch (err) {
    console.log(`   ❌ Error creating test data: ${err.message}`);
  }
}

// Main verification function
async function verifyCommissionTracking() {
  console.log('🔍 Commission Tracking Verification');
  console.log('===================================');
  console.log(`📡 Supabase URL: ${supabaseUrl}`);
  
  await checkDatabaseTables();
  await checkAffiliates();
  await checkReferrals();
  await checkCommissions();
  await checkUserSubscriptions();
  
  console.log('\n🎯 Verification Complete');
  console.log('=======================');
  console.log('If you see warnings about missing data, you may need to:');
  console.log('1. Create test affiliates and referrals');
  console.log('2. Process some webhook events');
  console.log('3. Check your webhook endpoint configuration');
  
  console.log('\n🚀 To test the system:');
  console.log('1. Run: node test-stripe-webhook-commissions.js');
  console.log('2. Run: node test-stripe-events.js');
  console.log('3. Check this verification script again');
}

// Run verification if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyCommissionTracking().catch(console.error);
}

export {
  checkDatabaseTables,
  checkAffiliates,
  checkReferrals,
  checkCommissions,
  checkUserSubscriptions,
  createTestData
};
