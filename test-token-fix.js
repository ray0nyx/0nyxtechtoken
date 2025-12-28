// Test Token Parameter Fix
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTokenFix() {
  console.log('🔧 Testing Token Parameter Fix\n');

  try {
    // Test 1: Send password reset email
    console.log('1. Sending password reset email...');
    const testEmail = 'rayhan@wagyutech.app';
    const redirectUrl = 'http://localhost:8083/auth/reset';
    
    const { error } = await supabase.auth.resetPasswordForEmail(testEmail, {
      redirectTo: redirectUrl,
    });

    if (error) {
      if (error.message.includes('30 seconds') || 
          error.message.includes('31 seconds') || 
          error.message.includes('For security purposes')) {
        console.log('✅ Rate limiting (expected):', error.message);
        console.log('\n⏰ Please wait 30 seconds before trying again, or check your email now for the reset link.');
      } else {
        console.log('❌ Error:', error.message);
        return;
      }
    } else {
      console.log('✅ Password reset email sent successfully');
    }

    // Test 2: Show expected URL format
    console.log('\n2. Expected URL Format:');
    console.log('The reset link should look like:');
    console.log(`${supabaseUrl}/auth/v1/verify?token=abc123&type=recovery&redirect_to=${encodeURIComponent(redirectUrl)}`);
    
    console.log('\n3. What to Check:');
    console.log('✅ The link should contain a "token" parameter');
    console.log('✅ The link should contain "type=recovery"');
    console.log('✅ The link should contain your redirect URL');
    console.log('✅ When you click the link, it should go to /auth/reset');
    console.log('✅ The diagnostic tool should show "Reset Token Present: Yes"');

    console.log('\n4. Testing URL Parsing:');
    const testUrls = [
      `${supabaseUrl}/auth/v1/verify?token=test123&type=recovery&redirect_to=${encodeURIComponent(redirectUrl)}`,
      `${supabaseUrl}/auth/v1/verify?code=test123&type=recovery&redirect_to=${encodeURIComponent(redirectUrl)}`,
      `${supabaseUrl}/auth/v1/verify?token=test123&redirect_to=${encodeURIComponent(redirectUrl)}`,
    ];

    testUrls.forEach((url, index) => {
      console.log(`\n   Test ${index + 1}: ${url}`);
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');
      const code = urlObj.searchParams.get('code');
      const type = urlObj.searchParams.get('type');
      const resetToken = token || code;
      
      console.log(`   Token: ${token || 'None'}`);
      console.log(`   Code: ${code || 'None'}`);
      console.log(`   Type: ${type || 'None'}`);
      console.log(`   Reset Token: ${resetToken || 'None'}`);
      console.log(`   Valid: ${resetToken ? '✅' : '❌'}`);
    });

    console.log('\n🎯 Next Steps:');
    console.log('1. Check your email for the reset link');
    console.log('2. Click the link and see if it goes to /auth/reset');
    console.log('3. Visit /debug/password-reset-diagnostic to see the token parameters');
    console.log('4. Check if the password reset page loads correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testTokenFix();
