import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase service role environment variables. Check your .env file.');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'defined' : 'undefined');
  console.error('VITE_SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'defined' : 'undefined');
}

// Create Supabase client with service role key for admin operations
export const supabaseService = createClient<Database>(
  supabaseUrl, 
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper function to check if service role is working
export const testServiceConnection = async () => {
  try {
    console.log('Testing Supabase service role connection...');
    const { data, error } = await supabaseService.from('affiliate_applications').select('count').limit(1);
    
    if (error) {
      console.error('Service role connection error:', error);
      return false;
    } else {
      console.log('Service role connection successful');
      return true;
    }
  } catch (error) {
    console.error('Failed to test service role connection:', error);
    return false;
  }
};
