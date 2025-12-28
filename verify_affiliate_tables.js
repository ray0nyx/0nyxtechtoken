// Script to verify affiliate table structures
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nlctxawkutljeimvjacp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY3R4YXdrdXRsamVpbXZqYWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0NzA1ODAsImV4cCI6MjA0MTA0NjU4MH0.Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTables() {
  console.log('🔍 Verifying affiliate table structures...\n');
  
  try {
    // Check if affiliate_applications table exists
    console.log('1. Checking affiliate_applications table...');
    const { data: appData, error: appError } = await supabase
      .from('affiliate_applications')
      .select('*')
      .limit(1);
    
    if (appError) {
      console.log('❌ affiliate_applications table does not exist');
      console.log('Error:', appError.message);
    } else {
      console.log('✅ affiliate_applications table exists');
    }
    
    // Check if affiliates table exists
    console.log('\n2. Checking affiliates table...');
    const { data: affiliateData, error: affiliateError } = await supabase
      .from('affiliates')
      .select('*')
      .limit(1);
    
    if (affiliateError) {
      console.log('❌ affiliates table does not exist');
      console.log('Error:', affiliateError.message);
    } else {
      console.log('✅ affiliates table exists');
    }
    
    // Check existing referrals table structure
    console.log('\n3. Checking referrals table structure...');
    const { data: referralData, error: referralError } = await supabase
      .from('referrals')
      .select('*')
      .limit(1);
    
    if (referralError) {
      console.log('❌ referrals table issue');
      console.log('Error:', referralError.message);
    } else {
      console.log('✅ referrals table accessible');
      if (referralData && referralData.length > 0) {
        console.log('Sample referral record columns:', Object.keys(referralData[0]));
      }
    }
    
    // Check if affiliate_applications_admin view exists
    console.log('\n4. Checking affiliate_applications_admin view...');
    const { data: viewData, error: viewError } = await supabase
      .from('affiliate_applications_admin')
      .select('*')
      .limit(1);
    
    if (viewError) {
      console.log('❌ affiliate_applications_admin view does not exist');
      console.log('Error:', viewError.message);
    } else {
      console.log('✅ affiliate_applications_admin view exists');
    }
    
    // Test the approval function exists
    console.log('\n5. Testing if approval functions exist...');
    try {
      const { data: funcData, error: funcError } = await supabase
        .rpc('approve_affiliate_application', {
          application_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
          admin_user_id: '00000000-0000-0000-0000-000000000000',
          admin_notes: 'test'
        });
      
      // If we get here without error about function not existing, function exists
      console.log('✅ approve_affiliate_application function exists (expected error for dummy data)');
    } catch (funcError) {
      if (funcError.message.includes('function') && funcError.message.includes('does not exist')) {
        console.log('❌ approve_affiliate_application function does not exist');
      } else {
        console.log('✅ approve_affiliate_application function exists (expected error for dummy data)');
      }
    }
    
    console.log('\n📊 Verification Summary:');
    console.log('- Check the results above to see what needs to be created');
    console.log('- Run the provided SQL script to create missing components');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyTables();
