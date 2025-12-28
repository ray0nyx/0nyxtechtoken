// Check Supabase Configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSupabaseConfig() {
  console.log('🔍 Checking Supabase Configuration\n');

  try {
    // Test 1: Check if we can send a password reset email
    console.log('1. Testing password reset email with different redirect URLs...\n');
    
    const testEmail = 'test@example.com';
    const redirectUrls = [
      'http://localhost:8083/auth/reset',
      'http://localhost:8083/reset-password',
      'https://www.wagyutech.app/auth/reset',
      'https://www.wagyutech.app/reset-password',
      'http://localhost:3000/auth/reset',
      'http://localhost:3000/reset-password'
    ];

    for (const redirectUrl of redirectUrls) {
      console.log(`Testing redirect URL: ${redirectUrl}`);
      
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
      
      // Wait a bit to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test 2: Check current session
    console.log('\n2. Checking current session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log(`  ⚠️  Session error: ${sessionError.message}`);
    } else if (session) {
      console.log(`  ✅ Active session found for: ${session.user?.email}`);
    } else {
      console.log(`  ℹ️  No active session (normal for test)`);
    }

    // Test 3: Check if we can access the auth endpoint
    console.log('\n3. Testing Supabase Auth endpoint...');
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });
      
      if (response.ok) {
        const settings = await response.json();
        console.log('  ✅ Supabase Auth endpoint accessible');
        console.log('  📋 Auth settings:', JSON.stringify(settings, null, 2));
      } else {
        console.log(`  ❌ Auth endpoint error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`  ❌ Auth endpoint error: ${error.message}`);
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Check which redirect URLs work (✅ above)');
    console.log('2. Update Supabase Auth settings to include working URLs');
    console.log('3. Test password reset with working redirect URL');
    console.log('4. Check email for reset link and verify it contains code parameter');

  } catch (error) {
    console.error('❌ Configuration check failed:', error.message);
  }
}

// Run the check
checkSupabaseConfig();
