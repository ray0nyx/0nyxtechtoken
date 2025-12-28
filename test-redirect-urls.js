// Test Redirect URL Configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRedirectUrls() {
  console.log('🔍 Testing Redirect URL Configuration\n');

  try {
    // Test different redirect URLs to see which ones work
    const testEmail = 'rayhan@wagyutech.app';
    const redirectUrls = [
      'http://localhost:8083/auth/reset',
      'http://localhost:8083/reset-password',
      'https://www.wagyutech.app/auth/reset',
      'https://www.wagyutech.app/reset-password',
      'http://localhost:3000/auth/reset',
      'http://localhost:3000/reset-password'
    ];

    console.log('Testing different redirect URLs...\n');

    for (const redirectUrl of redirectUrls) {
      console.log(`Testing: ${redirectUrl}`);
      
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(testEmail, {
          redirectTo: redirectUrl,
        });

        if (error) {
          if (error.message.includes('30 seconds') || 
              error.message.includes('31 seconds') || 
              error.message.includes('For security purposes')) {
            console.log(`  ✅ Rate limiting (expected): ${error.message}`);
          } else if (error.message.includes('Invalid redirect URL') || 
                     error.message.includes('redirect')) {
            console.log(`  ❌ Invalid redirect URL: ${error.message}`);
          } else {
            console.log(`  ⚠️  Other error: ${error.message}`);
          }
        } else {
          console.log(`  ✅ Password reset email sent successfully`);
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
      }
      
      // Wait to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Check your email for the reset links');
    console.log('2. Look at the actual URLs in the emails');
    console.log('3. Check if they contain the expected parameters');
    console.log('4. Test the URLs by clicking them');
    console.log('5. Use the debug tools to analyze the parameters');

    console.log('\n📧 What to Check in Your Email:');
    console.log('- Does the link contain a "token" parameter?');
    console.log('- Does the link contain a "code" parameter?');
    console.log('- Does the link contain "type=recovery"?');
    console.log('- What is the exact format of the link?');
    console.log('- Does the link go to the right domain and path?');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testRedirectUrls();
