/**
 * Developer authentication bypass
 * This provides a guaranteed way for the developer to authenticate
 */

// Developer user IDs for full access
export const DEVELOPER_IDS = [
  '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
  '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
];

// Developer emails for full access
export const DEVELOPER_EMAILS = [
  'rayhan@arafatcapital.com',
  'sevemadsen18@gmail.com'
];

export const getDeveloperUserId = (): string => {
  // This is a fallback user ID that should work for development
  // In production, this would be replaced with the actual user ID
  return '00000000-0000-0000-0000-000000000000';
};

export const isDeveloperEmail = (email: string | undefined): boolean => {
  if (!email) return false;
  return DEVELOPER_EMAILS.includes(email);
};

export const isDeveloperId = (userId: string | undefined): boolean => {
  if (!userId) return false;
  return DEVELOPER_IDS.includes(userId);
};

export const getDeveloperAuth = async () => {
  // Try to get the actual user ID from Supabase
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email && isDeveloperEmail(session.user.email)) {
      return session.user.id;
    }
  } catch (error) {
    console.error('Failed to get developer auth:', error);
  }
  
  // Fallback to a known working user ID
  return getDeveloperUserId();
};




