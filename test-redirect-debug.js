// Debug Redirect URL Issue
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugRedirectUrl() {
  console.log('🔍 Debugging Redirect URL Issue\n');

  try {
    // Test 1: Send password reset with explicit localhost URL
    console.log('1. Testing with explicit localhost URL...');
    const testEmail = 'rayhan@wagyutech.app';
    const localhostRedirect = 'http://localhost:8083/auth/reset';
    
    console.log('   Email:', testEmail);
    console.log('   Redirect URL:', localhostRedirect);
    
    const { error } = await supabase.auth.resetPasswordForEmail(testEmail, {
      redirectTo: localhostRedirect,
    });

    if (error) {
      if (error.message.includes('30 seconds') || 
          error.message.includes('31 seconds') || 
          error.message.includes('For security purposes')) {
        console.log('   ✅ Rate limiting (expected):', error.message);
      } else {
        console.log('   ❌ Error:', error.message);
      }
    } else {
      console.log('   ✅ Password reset email sent successfully');
    }

    // Test 2: Check what the actual email contains
    console.log('\n2. Expected vs Actual:');
    console.log('   Expected redirect URL:', localhostRedirect);
    console.log('   Actual redirect URL in email: https://wagyu-orcin.vercel.app');
    console.log('   Issue: Supabase is overriding the redirect URL!');

    // Test 3: Check Supabase Auth settings
    console.log('\n3. Supabase Configuration Issue:');
    console.log('   The problem is likely in Supabase Auth settings');
    console.log('   Check: Authentication > URL Configuration > Site URL');
    console.log('   Check: Authentication > URL Configuration > Redirect URLs');
    console.log('   The Site URL might be set to https://wagyu-orcin.vercel.app');

    console.log('\n4. Solutions:');
    console.log('   Option 1: Update Supabase Auth settings');
    console.log('     - Go to Supabase Dashboard > Authentication > URL Configuration');
    console.log('     - Set Site URL to: http://localhost:8083');
    console.log('     - Add Redirect URL: http://localhost:8083/auth/reset');
    
    console.log('\n   Option 2: Use the production URL for testing');
    console.log('     - Modify the email link to use localhost:8083');
    console.log('     - Replace wagyu-orcin.vercel.app with localhost:8083');
    
    console.log('\n   Option 3: Test with the production URL');
    console.log('     - Deploy the latest code to Vercel');
    console.log('     - Test the password reset on the production site');

    console.log('\n5. Quick Fix for Testing:');
    console.log('   Take the email link:');
    console.log('   https://nlctxawkutljeimvjacp.supabase.co/auth/v1/verify?token=496a84f15385c7c47fec0aa24791c15a5bffb4e8966b15b104316195&type=recovery&redirect_to=https://wagyu-orcin.vercel.app');
    console.log('   ');
    console.log('   Replace the redirect_to parameter:');
    console.log('   https://nlctxawkutljeimvjacp.supabase.co/auth/v1/verify?token=496a84f15385c7c47fec0aa24791c15a5bffb4e8966b15b104316195&type=recovery&redirect_to=http%3A%2F%2Flocalhost%3A8083%2Fauth%2Freset');
    console.log('   ');
    console.log('   Then visit the modified URL in your browser');

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Run the debug
debugRedirectUrl();
