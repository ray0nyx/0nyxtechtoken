// Password Reset Debug Test Script
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  console.log('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPasswordResetDebug() {
  console.log('🧪 Password Reset Debug Test\n');

  try {
    // Test 1: Check Supabase connection
    console.log('1. Testing Supabase connection...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('user_trade_metrics')
      .select('count')
      .limit(1);

    if (healthError) {
      console.error('❌ Supabase connection failed:', healthError.message);
      return;
    }
    console.log('✅ Supabase connection successful');

    // Test 2: Test password reset email with debug logging
    console.log('\n2. Testing password reset email...');
    const testEmail = 'test@example.com';
    const redirectUrl = 'http://localhost:8083/auth/reset';
    
    console.log('📧 Sending password reset email...');
    console.log('   Email:', testEmail);
    console.log('   Redirect URL:', redirectUrl);
    
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(testEmail, {
      redirectTo: redirectUrl,
    });

    if (resetError) {
      if (resetError.message.includes('30 seconds') || 
          resetError.message.includes('31 seconds') || 
          resetError.message.includes('For security purposes')) {
        console.log('✅ Rate limiting is working (expected in test environment)');
        console.log('   Error:', resetError.message);
      } else {
        console.log('⚠️  Password reset error:', resetError.message);
      }
    } else {
      console.log('✅ Password reset email sent successfully');
    }

    // Test 3: Test URL parsing scenarios
    console.log('\n3. Testing URL parsing scenarios...');
    const testScenarios = [
      {
        name: 'Recovery Type',
        url: 'http://localhost:8080/auth/reset?code=test123&type=recovery',
        expected: { hasCode: true, hasType: true, isRecovery: true, isPasswordReset: true }
      },
      {
        name: 'No Type (should be password reset)',
        url: 'http://localhost:8080/auth/reset?code=test123',
        expected: { hasCode: true, hasType: false, isRecovery: false, isPasswordReset: true }
      },
      {
        name: 'Wrong Type',
        url: 'http://localhost:8080/auth/reset?code=test123&type=signup',
        expected: { hasCode: true, hasType: true, isRecovery: false, isPasswordReset: false }
      },
      {
        name: 'No Code',
        url: 'http://localhost:8080/auth/reset?type=recovery',
        expected: { hasCode: false, hasType: true, isRecovery: true, isPasswordReset: false }
      }
    ];

    testScenarios.forEach((scenario, index) => {
      console.log(`\n   Scenario ${index + 1}: ${scenario.name}`);
      console.log(`   URL: ${scenario.url}`);
      
      const url = new URL(scenario.url);
      const code = url.searchParams.get('code');
      const type = url.searchParams.get('type');
      const hasCode = !!code;
      const hasType = !!type;
      const isRecovery = type === 'recovery';
      const isPasswordReset = isRecovery || !hasType;
      
      console.log(`   Code: ${code || 'None'}`);
      console.log(`   Type: ${type || 'None'}`);
      console.log(`   Has Code: ${hasCode ? '✅' : '❌'} (expected: ${scenario.expected.hasCode ? '✅' : '❌'})`);
      console.log(`   Has Type: ${hasType ? '✅' : '❌'} (expected: ${scenario.expected.hasType ? '✅' : '❌'})`);
      console.log(`   Is Recovery: ${isRecovery ? '✅' : '❌'} (expected: ${scenario.expected.isRecovery ? '✅' : '❌'})`);
      console.log(`   Is Password Reset: ${isPasswordReset ? '✅' : '❌'} (expected: ${scenario.expected.isPasswordReset ? '✅' : '❌'})`);
      
      const allCorrect = 
        hasCode === scenario.expected.hasCode &&
        hasType === scenario.expected.hasType &&
        isRecovery === scenario.expected.isRecovery &&
        isPasswordReset === scenario.expected.isPasswordReset;
      
      console.log(`   Result: ${allCorrect ? '✅ PASS' : '❌ FAIL'}`);
    });

    // Test 4: Test session validation
    console.log('\n4. Testing session validation...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log('⚠️  Session error (expected for test):', sessionError.message);
    } else if (session) {
      console.log('✅ Active session found');
      console.log('   User email:', session.user?.email);
    } else {
      console.log('ℹ️  No active session (normal for unauthenticated test)');
    }

    console.log('\n🎉 Password reset debug test completed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Go to Settings and request a password reset');
    console.log('2. Check your email for the reset link');
    console.log('3. Visit /debug/password-reset-diagnostic to run full diagnostics');
    console.log('4. Check browser console for debug logs');
    console.log('5. Share the diagnostic results if issues persist');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPasswordResetDebug();
