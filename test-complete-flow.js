// Test Complete Password Reset Flow
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCompleteFlow() {
  console.log('🔄 Testing Complete Password Reset Flow\n');

  try {
    // Step 1: Send fresh password reset email
    console.log('1. Sending fresh password reset email...');
    const testEmail = 'rayhan@wagyutech.app';
    const redirectUrl = 'http://localhost:8080/auth/reset';
    
    console.log('   Email:', testEmail);
    console.log('   Redirect URL:', redirectUrl);
    
    const { error } = await supabase.auth.resetPasswordForEmail(testEmail, {
      redirectTo: redirectUrl,
    });

    if (error) {
      if (error.message.includes('30 seconds') || 
          error.message.includes('31 seconds') || 
          error.message.includes('For security purposes')) {
        console.log('   ⏰ Rate limiting (expected):', error.message);
        console.log('   Please wait 30 seconds before trying again');
        return;
      } else {
        console.log('   ❌ Error:', error.message);
        return;
      }
    } else {
      console.log('   ✅ Fresh password reset email sent successfully');
    }

    console.log('\n2. Expected Email Link Format:');
    console.log('   The email should contain a link like:');
    console.log(`   ${supabaseUrl}/auth/v1/verify?token=abc123&type=recovery&redirect_to=${encodeURIComponent(redirectUrl)}`);
    
    console.log('\n3. Debug Steps:');
    console.log('   📧 Check your email for the reset link');
    console.log('   🔍 Copy the EXACT URL from the email');
    console.log('   📋 Check what parameters it contains:');
    console.log('      - Does it have a "token" parameter?');
    console.log('      - Does it have a "code" parameter?');
    console.log('      - Does it have "type=recovery"?');
    console.log('      - What is the redirect_to value?');

    console.log('\n4. URL Modification Test:');
    console.log('   If the redirect_to points to wagyu-orcin.vercel.app:');
    console.log('   Replace it with: http%3A%2F%2Flocalhost%3A8080%2Fauth%2Freset');
    console.log('   Example:');
    console.log('   Original: ...&redirect_to=https://wagyu-orcin.vercel.app');
    console.log('   Modified: ...&redirect_to=http%3A%2F%2Flocalhost%3A8080%2Fauth%2Freset');

    console.log('\n5. Test the Modified URL:');
    console.log('   🧪 Visit the modified URL in your browser');
    console.log('   🔍 Check the URL debugger: http://localhost:8080/debug/url');
    console.log('   🔍 Check the diagnostic tool: http://localhost:8080/debug/password-reset-diagnostic');

    console.log('\n6. What to Look For:');
    console.log('   ✅ URL debugger should show:');
    console.log('      - Has Reset Parameters: Yes');
    console.log('      - Is Password Reset Type: Yes');
    console.log('      - Has Valid Reset Token: Yes');
    console.log('   ✅ Diagnostic tool should show:');
    console.log('      - Reset Token Present: Yes');
    console.log('      - Correct Type: Yes');
    console.log('      - Code Exchange: Yes');

    console.log('\n7. Common Issues:');
    console.log('   ❌ Using expired token (request fresh one)');
    console.log('   ❌ Wrong redirect URL (modify the link)');
    console.log('   ❌ Email client modifying the URL');
    console.log('   ❌ Service worker interference (clear cache)');

    console.log('\n8. Quick Test Links:');
    console.log('   Test with fake token: http://localhost:8080/auth/reset?token=test123&type=recovery');
    console.log('   Test with fake code: http://localhost:8080/auth/reset?code=test123&type=recovery');
    console.log('   Test with no params: http://localhost:8080/auth/reset');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testCompleteFlow();
