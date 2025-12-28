/**
 * Institutional Access Middleware
 * Gates access to institutional backtester features for Pro plan users only
 */

import { createClient } from '@/lib/supabase/client';
import { NextRequest, NextResponse } from 'next/server';

export interface InstitutionalAccessConfig {
  requireProPlan: boolean;
  redirectTo?: string;
  customCheck?: (userId: string) => Promise<boolean>;
}

/**
 * Check if user has institutional access (Pro plan)
 */
export async function hasInstitutionalAccess(userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    
    // Get user's subscription
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          id,
          name,
          price_monthly,
          price_yearly,
          features
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !subscription) {
      console.log('No active subscription found for user:', userId);
      return false;
    }
    
    // Developer always has access
    if (subscription.is_developer) {
      console.log('User is developer, granting institutional access');
      return true;
    }
    
    // Check if subscription is Pro plan ($39.99)
    const isProPlan = subscription.subscription_plans?.price_monthly === 39.99;
    
    if (isProPlan) {
      console.log('User has Pro plan, granting institutional access');
      return true;
    }
    
    console.log('User does not have Pro plan, denying institutional access');
    return false;
    
  } catch (error) {
    console.error('Error checking institutional access:', error);
    return false;
  }
}

/**
 * Middleware function to check institutional access
 */
export async function requireInstitutionalAccess(
  request: NextRequest,
  config: InstitutionalAccessConfig = { requireProPlan: true }
): Promise<NextResponse | null> {
  
  // Skip check if not required
  if (!config.requireProPlan) {
    return null;
  }
  
  try {
    // Get user ID from request (assuming it's in headers or cookies)
    const userId = request.headers.get('x-user-id') || 
                   request.cookies.get('user-id')?.value;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check institutional access
    const hasAccess = config.customCheck 
      ? await config.customCheck(userId)
      : await hasInstitutionalAccess(userId);
    
    if (!hasAccess) {
      if (config.redirectTo) {
        return NextResponse.redirect(new URL(config.redirectTo, request.url));
      }
      
      return NextResponse.json(
        { 
          error: 'Institutional access required',
          message: 'This feature requires a Pro plan subscription ($39.99/month)',
          upgradeUrl: '/pricing'
        },
        { status: 403 }
      );
    }
    
    return null; // Access granted
    
  } catch (error) {
    console.error('Error in institutional access middleware:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * React hook for checking institutional access
 */
export function useInstitutionalAccess() {
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function checkAccess() {
      try {
        setIsLoading(true);
        setError(null);
        
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setHasAccess(false);
          return;
        }
        
        const access = await hasInstitutionalAccess(user.id);
        setHasAccess(access);
        
      } catch (err) {
        console.error('Error checking institutional access:', err);
        setError('Failed to check access');
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    }
    
    checkAccess();
  }, []);
  
  return { hasAccess, isLoading, error };
}

/**
 * Higher-order component to protect institutional routes
 */
export function withInstitutionalAccess<T extends object>(
  Component: React.ComponentType<T>,
  config: InstitutionalAccessConfig = { requireProPlan: true }
) {
  return function InstitutionalProtectedComponent(props: T) {
    const { hasAccess, isLoading, error } = useInstitutionalAccess();
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-400"></div>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      );
    }
    
    if (!hasAccess) {
      return <InstitutionalAccessDenied config={config} />;
    }
    
    return <Component {...props} />;
  };
}

/**
 * Component shown when institutional access is denied
 */
function InstitutionalAccessDenied({ config }: { config: InstitutionalAccessConfig }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Institutional Access Required
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This feature is available only to Pro plan subscribers
          </p>
        </div>
        
        <div className="mb-6 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Pro Plan Features:</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Advanced institutional backtesting</li>
            <li>• Copy trading across exchanges</li>
            <li>• OAuth exchange integration</li>
            <li>• Advanced analytics & reporting</li>
            <li>• Priority support</li>
          </ul>
        </div>
        
        <div className="space-y-3">
          <a
            href="/pricing"
            className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            Upgrade to Pro - $39.99/month
          </a>
          <a
            href="/dashboard"
            className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * API route middleware for institutional endpoints
 */
export function createInstitutionalApiHandler(
  handler: (req: NextRequest, userId: string) => Promise<NextResponse>,
  config: InstitutionalAccessConfig = { requireProPlan: true }
) {
  return async function institutionalApiHandler(req: NextRequest) {
    // Check institutional access
    const accessResponse = await requireInstitutionalAccess(req, config);
    if (accessResponse) {
      return accessResponse;
    }
    
    // Get user ID
    const userId = req.headers.get('x-user-id') || 
                   req.cookies.get('user-id')?.value;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }
    
    // Call the actual handler
    return handler(req, userId);
  };
}

/**
 * Utility function to check if a user has Pro plan
 */
export async function isProPlanUser(userId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select(`
        is_developer,
        subscription_plans (price_monthly)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!subscription) return false;
    
    // Developer or Pro plan user
    return subscription.is_developer || subscription.subscription_plans?.price_monthly === 39.99;
    
  } catch (error) {
    console.error('Error checking Pro plan status:', error);
    return false;
  }
}

/**
 * Feature flag for institutional features
 */
export function useInstitutionalFeature(feature: string): boolean {
  const { hasAccess } = useInstitutionalAccess();
  
  const features = {
    'institutional-backtester': hasAccess,
    'copy-trading': hasAccess,
    'advanced-analytics': hasAccess,
    'exchange-integration': hasAccess,
    'oauth-linking': hasAccess
  };
  
  return features[feature] || false;
}
