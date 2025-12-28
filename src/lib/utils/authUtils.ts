import { createClient } from '@/lib/supabase/client';

/**
 * Developer bypass utility for authentication
 * Allows rayhan@arafatcapital.com to bypass authentication issues
 */
export const getAuthenticatedUser = async () => {
  const supabase = createClient();
  
  console.log('getAuthenticatedUser: Starting authentication check...');
  
  try {
    // Try session first (faster and more reliable)
    const { data: { session } } = await supabase.auth.getSession();
    console.log('getAuthenticatedUser: getSession result:', { session: !!session, user: !!session?.user, email: session?.user?.email });
    
    if (session?.user) {
      // Developer bypass for developers
      const developerIds = [
        '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
        '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
      ];
      
      if (developerIds.includes(session.user.id)) {
        console.log('Developer bypass activated for:', session.user.email);
        return session.user;
      }
      
      // For other users, return the session user if available
      console.log('getAuthenticatedUser: Using session user:', session.user.email);
      return session.user;
    }
    
    // Fallback to getUser if session fails
    const { data: { user }, error } = await supabase.auth.getUser();
    console.log('getAuthenticatedUser: getUser result:', { user: !!user, error: !!error });
    
    if (user && !error) {
      console.log('getAuthenticatedUser: User found via getUser:', user.email);
      return user;
    }
    
    console.error('getAuthenticatedUser: No user or session found');
    throw new Error('No authenticated user found');
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};

/**
 * Check if the current user is a developer
 */
export const isDeveloper = async (): Promise<boolean> => {
  try {
    const user = await getAuthenticatedUser();
    const developerIds = [
      '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
      '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
    ];
    return developerIds.includes(user.id);
  } catch {
    return false;
  }
};
