// Test Email Link Format
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testEmailLink() {
  console.log('🔍 Testing Email Link Format\n');

  try {
    // Test with a real email to see the actual link format
    const testEmail = 'rayhan@wagyutech.app'; // Use a real email you can check
    const redirectUrl = 'http://localhost:8083/auth/reset';
    
    console.log('📧 Sending password reset email...');
    console.log('   Email:', testEmail);
    console.log('   Redirect URL:', redirectUrl);
    console.log('   Supabase URL:', supabaseUrl);
    
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
      }
    } else {
      console.log('✅ Password reset email sent successfully');
      console.log('\n📧 Check your email for the reset link');
      console.log('🔍 Look for a link that should contain:');
      console.log('   - A "code" parameter');
      console.log('   - A "type" parameter (should be "recovery")');
      console.log('   - Your redirect URL');
    }

    // Show what the expected link format should look like
    console.log('\n📋 Expected Link Format:');
    console.log(`${supabaseUrl}/auth/v1/verify?token=abc123&type=recovery&redirect_to=${encodeURIComponent(redirectUrl)}`);
    console.log('\nOr:');
    console.log(`${supabaseUrl}/auth/v1/verify?token=abc123&type=recovery&redirect_to=${encodeURIComponent(redirectUrl)}&email=${encodeURIComponent(testEmail)}`);

    console.log('\n🔍 What to Check in Your Email:');
    console.log('1. Does the link contain a "token" parameter?');
    console.log('2. Does the link contain a "type" parameter?');
    console.log('3. Does the link contain your redirect URL?');
    console.log('4. What is the actual format of the link?');

    console.log('\n🎯 If the link is missing parameters:');
    console.log('1. Check Supabase Auth email templates');
    console.log('2. Verify redirect URL configuration');
    console.log('3. Check if email client is modifying the link');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testEmailLink();
