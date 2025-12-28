// Debug Email Link Format
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugEmailLink() {
  console.log('🔍 Debugging Email Link Format\n');

  try {
    // Test 1: Send password reset email
    console.log('1. Sending password reset email...');
    const testEmail = 'rayhan@wagyutech.app';
    const redirectUrl = 'http://localhost:8083/auth/reset';
    
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
        return;
      }
    } else {
      console.log('✅ Password reset email sent successfully');
    }

    // Test 2: Show what the actual Supabase URL structure looks like
    console.log('\n2. Supabase Auth URL Structure:');
    console.log('   Base URL:', supabaseUrl);
    console.log('   Auth endpoint:', `${supabaseUrl}/auth/v1/verify`);
    
    // Test 3: Show different possible URL formats
    console.log('\n3. Possible URL Formats in Email:');
    console.log('   Format 1 (with token):');
    console.log(`   ${supabaseUrl}/auth/v1/verify?token=abc123&type=recovery&redirect_to=${encodeURIComponent(redirectUrl)}`);
    
    console.log('\n   Format 2 (with code):');
    console.log(`   ${supabaseUrl}/auth/v1/verify?code=abc123&type=recovery&redirect_to=${encodeURIComponent(redirectUrl)}`);
    
    console.log('\n   Format 3 (direct redirect):');
    console.log(`   ${redirectUrl}?token=abc123&type=recovery`);
    
    console.log('\n   Format 4 (direct redirect with code):');
    console.log(`   ${redirectUrl}?code=abc123&type=recovery`);

    // Test 4: Test URL parsing for different formats
    console.log('\n4. Testing URL Parsing:');
    const testUrls = [
      `${supabaseUrl}/auth/v1/verify?token=test123&type=recovery&redirect_to=${encodeURIComponent(redirectUrl)}`,
      `${supabaseUrl}/auth/v1/verify?code=test123&type=recovery&redirect_to=${encodeURIComponent(redirectUrl)}`,
      `${redirectUrl}?token=test123&type=recovery`,
      `${redirectUrl}?code=test123&type=recovery`,
      `${redirectUrl}?token=test123`,
      `${redirectUrl}?code=test123`,
    ];

    testUrls.forEach((url, index) => {
      console.log(`\n   Test ${index + 1}: ${url}`);
      try {
        const urlObj = new URL(url);
        const token = urlObj.searchParams.get('token');
        const code = urlObj.searchParams.get('code');
        const type = urlObj.searchParams.get('type');
        const redirect_to = urlObj.searchParams.get('redirect_to');
        const resetToken = token || code;
        
        console.log(`   Token: ${token || 'None'}`);
        console.log(`   Code: ${code || 'None'}`);
        console.log(`   Type: ${type || 'None'}`);
        console.log(`   Redirect_to: ${redirect_to || 'None'}`);
        console.log(`   Reset Token: ${resetToken || 'None'}`);
        console.log(`   Valid: ${resetToken ? '✅' : '❌'}`);
        
        // Check if this would redirect to our handler
        if (redirect_to && redirect_to.includes('/auth/reset')) {
          console.log(`   Would redirect to: ${redirect_to}`);
        }
      } catch (e) {
        console.log(`   Error parsing URL: ${e.message}`);
      }
    });

    console.log('\n5. What to Check in Your Email:');
    console.log('   📧 Open your email and look for the reset link');
    console.log('   🔍 Copy the entire URL from the email');
    console.log('   📋 Check if it contains:');
    console.log('      - A "token" parameter');
    console.log('      - A "code" parameter');
    console.log('      - A "type" parameter');
    console.log('      - Your redirect URL');
    console.log('   🧪 Test the URL by visiting it in your browser');

    console.log('\n6. Common Issues:');
    console.log('   ❌ Email client modifying the URL');
    console.log('   ❌ URL being truncated');
    console.log('   ❌ Wrong redirect URL configuration');
    console.log('   ❌ Supabase email template issues');

    console.log('\n🎯 Next Steps:');
    console.log('1. Check your email for the reset link');
    console.log('2. Copy the exact URL from the email');
    console.log('3. Visit the URL in your browser');
    console.log('4. Check what parameters are in the URL');
    console.log('5. Share the actual URL format if it\'s different');

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Run the debug
debugEmailLink();
