import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file.');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'defined' : 'undefined');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'defined' : 'undefined');
}

console.log('Initializing Supabase client with URL:', supabaseUrl ? 'URL is defined' : 'URL is undefined');

// Create a custom fetch implementation that logs errors
const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
  try {
    const response = await fetch(url, options);
    
    // Log any non-2xx responses
    if (!response.ok) {
      console.error(`Supabase API error: ${response.status} ${response.statusText}`, { 
        url: typeof url === 'string' ? url : url.toString(),
        method: options?.method || 'GET'
      });
    }
    
    return response;
  } catch (error) {
    console.error('Supabase fetch error:', error);
    throw error;
  }
};

// Create the Supabase client with persistent storage options
export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      flowType: 'pkce'
    }
  }
);

// Helper function to manually refresh token if needed
export const refreshSession = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Failed to get session:', error);
      
      // Check if it's a refresh token error
      if (error.message?.includes('refresh token') || 
          error.message?.includes('Invalid refresh token') ||
          error.message?.includes('refresh token not found')) {
        console.log('Refresh token invalid or not found, clearing session');
        
        // Clear any invalid tokens from localStorage
        localStorage.removeItem('sb-access-token');
        localStorage.removeItem('sb-refresh-token');
        
        // Sign out to clear Supabase session
        await supabase.auth.signOut();
        
        return false;
      }
      
      return false;
    }
    
    if (data.session) {
      return true;
    }
    
    // No session found - try to refresh from stored tokens
    const refreshToken = localStorage.getItem('sb-refresh-token');
    if (refreshToken) {
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Failed to refresh session:', refreshError);
          // Clear invalid tokens
          localStorage.removeItem('sb-access-token');
          localStorage.removeItem('sb-refresh-token');
          await supabase.auth.signOut();
          return false;
        }
        
        if (refreshData.session) {
          return true;
        }
      } catch (refreshErr) {
        console.error('Error refreshing session:', refreshErr);
        localStorage.removeItem('sb-access-token');
        localStorage.removeItem('sb-refresh-token');
        await supabase.auth.signOut();
        return false;
      }
    }
    
    return false;
  } catch (err) {
    console.error('Error in refreshSession:', err);
    localStorage.removeItem('sb-access-token');
    localStorage.removeItem('sb-refresh-token');
    await supabase.auth.signOut();
    return false;
  }
};

// Check Supabase connection
(async () => {
  try {
    console.log('Checking Supabase connection...');
    const { error } = await supabase.from('journal_notes').select('count').limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
    } else {
      console.log('Supabase connection successful');
    }
    
    // Check authentication status
    const { data, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('Supabase auth error:', authError);
    } else {
      console.log('Auth session check:', data.session ? 'User is authenticated' : 'No active session');
    }
  } catch (error) {
    console.error('Failed to check Supabase connection:', error);
  }
})(); 