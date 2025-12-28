import { supabase } from './supabase';

/**
 * Initializes authentication and handles token validation
 * Call this function early in your app bootstrap process
 */
export const initAuth = async (): Promise<boolean> => {
  try {
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    
    // If no session found, check localStorage for tokens
    if (!session) {
      const accessToken = localStorage.getItem('sb-access-token');
      const refreshToken = localStorage.getItem('sb-refresh-token');
      
      // If we have tokens in localStorage, try to set them manually
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (error) {
          console.error('Failed to restore session from localStorage:', error);
          // Clean up invalid tokens
          localStorage.removeItem('sb-access-token');
          localStorage.removeItem('sb-refresh-token');
          return false;
        }
        
        return !!data.session;
      }
      
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing auth:', error);
    return false;
  }
}; 