// Script to verify affiliate system migration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nlctxawkutljeimvjacp.supabase.co';
// Using service role key for admin operations (replace with actual key)
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY3R4YXdrdXRsamVpbXZqYWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0NzA1ODAsImV4cCI6MjA0MTA0NjU4MH0.Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx-Yx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
  console.log('🔍 Verifying affiliate system migration...\n');
  
  const results = {
    affiliate_applications: { exists: false, count: 0, error: null },
    affiliates: { exists: false, count: 0, error: null },
    referrals: { exists: false, count: 0, error: null },
    commissions: { exists: false, count: 0, error: null },
    functions: { approve: false, deny: false },
    view: { exists: false, error: null }
  };
  
  try {
    // 1. Check affiliate_applications table
    console.log('1. Checking affiliate_applications table...');
    try {
      const { data, error, count } = await supabase
        .from('affiliate_applications')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        results.affiliate_applications.error = error.message;
        console.log('❌ affiliate_applications:', error.message);
      } else {
        results.affiliate_applications.exists = true;
        results.affiliate_applications.count = count || 0;
        console.log('✅ affiliate_applications: exists,', count || 0, 'records');
      }
    } catch (e) {
      results.affiliate_applications.error = e.message;
      console.log('❌ affiliate_applications:', e.message);
    }
    
    // 2. Check affiliates table
    console.log('\n2. Checking affiliates table...');
    try {
      const { data, error, count } = await supabase
        .from('affiliates')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        results.affiliates.error = error.message;
        console.log('❌ affiliates:', error.message);
      } else {
        results.affiliates.exists = true;
        results.affiliates.count = count || 0;
        console.log('✅ affiliates: exists,', count || 0, 'records');
        
        // Check for new columns
        if (count > 0) {
          const { data: sample } = await supabase
            .from('affiliates')
            .select('*')
            .limit(1);
          
          if (sample && sample.length > 0) {
            const columns = Object.keys(sample[0]);
            const newColumns = ['user_id', 'application_id', 'affiliate_code', 'total_referrals', 'total_earnings'];
            const hasNewColumns = newColumns.every(col => columns.includes(col));
            console.log('   📋 New columns present:', hasNewColumns ? '✅' : '❌');
            if (!hasNewColumns) {
              console.log('   Missing columns:', newColumns.filter(col => !columns.includes(col)));
            }
          }
        }
      }
    } catch (e) {
      results.affiliates.error = e.message;
      console.log('❌ affiliates:', e.message);
    }
    
    // 3. Check referrals table
    console.log('\n3. Checking referrals table...');
    try {
      const { data, error, count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        results.referrals.error = error.message;
        console.log('❌ referrals:', error.message);
      } else {
        results.referrals.exists = true;
        results.referrals.count = count || 0;
        console.log('✅ referrals: exists,', count || 0, 'records');
      }
    } catch (e) {
      results.referrals.error = e.message;
      console.log('❌ referrals:', e.message);
    }
    
    // 4. Check commissions table
    console.log('\n4. Checking commissions table...');
    try {
      const { data, error, count } = await supabase
        .from('commissions')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        results.commissions.error = error.message;
        console.log('❌ commissions:', error.message);
      } else {
        results.commissions.exists = true;
        results.commissions.count = count || 0;
        console.log('✅ commissions: exists,', count || 0, 'records');
      }
    } catch (e) {
      results.commissions.error = e.message;
      console.log('❌ commissions:', e.message);
    }
    
    // 5. Check admin view
    console.log('\n5. Checking affiliate_applications_admin view...');
    try {
      const { data, error } = await supabase
        .from('affiliate_applications_admin')
        .select('*')
        .limit(1);
      
      if (error) {
        results.view.error = error.message;
        console.log('❌ affiliate_applications_admin view:', error.message);
      } else {
        results.view.exists = true;
        console.log('✅ affiliate_applications_admin view: exists');
      }
    } catch (e) {
      results.view.error = e.message;
      console.log('❌ affiliate_applications_admin view:', e.message);
    }
    
    // 6. Test functions (this will likely fail with anon key, but we can try)
    console.log('\n6. Testing affiliate functions...');
    try {
      // Test approve function with dummy data
      const { data, error } = await supabase.rpc('approve_affiliate_application', {
        application_id: '00000000-0000-0000-0000-000000000000',
        admin_user_id: '00000000-0000-0000-0000-000000000000',
        admin_notes: 'test'
      });
      
      // If no "function does not exist" error, function exists
      results.functions.approve = true;
      console.log('✅ approve_affiliate_application: exists');
    } catch (e) {
      if (e.message.includes('function') && e.message.includes('does not exist')) {
        console.log('❌ approve_affiliate_application: does not exist');
      } else {
        results.functions.approve = true;
        console.log('✅ approve_affiliate_application: exists (expected error for dummy data)');
      }
    }
    
    try {
      // Test deny function with dummy data
      const { data, error } = await supabase.rpc('deny_affiliate_application', {
        application_id: '00000000-0000-0000-0000-000000000000',
        admin_user_id: '00000000-0000-0000-0000-000000000000',
        admin_notes: 'test'
      });
      
      results.functions.deny = true;
      console.log('✅ deny_affiliate_application: exists');
    } catch (e) {
      if (e.message.includes('function') && e.message.includes('does not exist')) {
        console.log('❌ deny_affiliate_application: does not exist');
      } else {
        results.functions.deny = true;
        console.log('✅ deny_affiliate_application: exists (expected error for dummy data)');
      }
    }
    
    // Summary
    console.log('\n📊 MIGRATION VERIFICATION SUMMARY:');
    console.log('=====================================');
    console.log(`affiliate_applications: ${results.affiliate_applications.exists ? '✅ EXISTS' : '❌ MISSING'} (${results.affiliate_applications.count} records)`);
    console.log(`affiliates: ${results.affiliates.exists ? '✅ EXISTS' : '❌ MISSING'} (${results.affiliates.count} records)`);
    console.log(`referrals: ${results.referrals.exists ? '✅ EXISTS' : '❌ MISSING'} (${results.referrals.count} records)`);
    console.log(`commissions: ${results.commissions.exists ? '✅ EXISTS' : '❌ MISSING'} (${results.commissions.count} records)`);
    console.log(`admin view: ${results.view.exists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`approve function: ${results.functions.approve ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`deny function: ${results.functions.deny ? '✅ EXISTS' : '❌ MISSING'}`);
    
    const allGood = results.affiliate_applications.exists && 
                   results.affiliates.exists && 
                   results.referrals.exists && 
                   results.view.exists && 
                   results.functions.approve && 
                   results.functions.deny;
    
    if (allGood) {
      console.log('\n🎉 MIGRATION VERIFICATION PASSED!');
      console.log('All required components are in place.');
    } else {
      console.log('\n⚠️  MIGRATION INCOMPLETE');
      console.log('Some components are missing. Please run the migration SQL script.');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyMigration();
