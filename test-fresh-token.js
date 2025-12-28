// Test Fresh Password Reset Token
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFreshToken() {
  console.log('🔄 Testing Fresh Password Reset Token\n');

  try {
    // Send a fresh password reset email
    console.log('1. Sending fresh password reset email...');
    const testEmail = 'rayhan@wagyutech.app';
    const redirectUrl = 'http://localhost:8083/auth/reset';
    
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
      } else {
        console.log('   ❌ Error:', error.message);
        return;
      }
    } else {
      console.log('   ✅ Fresh password reset email sent successfully');
    }

    console.log('\n2. Token Expiration Info:');
    console.log('   ⏰ Password reset tokens expire after 1 hour');
    console.log('   🔒 This is a security feature to prevent abuse');
    console.log('   📧 Check your email for the new reset link');
    console.log('   ⚡ Use the new link immediately for best results');

    console.log('\n3. What to Do:');
    console.log('   📧 Check your email for the new reset link');
    console.log('   🔗 Copy the link from the email');
    console.log('   🔄 Replace the domain with localhost:8083 if needed');
    console.log('   🧪 Test the link by visiting it in your browser');
    console.log('   🔍 Use the diagnostic tool to verify it works');

    console.log('\n4. Expected Results:');
    console.log('   ✅ The new link should work without expiration errors');
    console.log('   ✅ The diagnostic tool should show "Reset Token Present: Yes"');
    console.log('   ✅ You should be redirected to the password reset page');

    console.log('\n5. If Still Getting Errors:');
    console.log('   🔍 Check the exact error message in the URL');
    console.log('   ⏰ Make sure you\'re using the link within 1 hour');
    console.log('   🔄 Try requesting another reset if needed');
    console.log('   🛠️ Check Supabase Auth settings for token expiration time');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testFreshToken();
