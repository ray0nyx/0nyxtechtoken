import { NextRequest, NextResponse } from 'next/server';
import { trackPageView } from '@/utils/analytics';

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  // Get response before tracking to avoid performance impact
  const response = NextResponse.next();
  
  try {
    // Get the current pathname for tracking
    const path = request.nextUrl.pathname;
    
    // Skip tracking for static assets, api routes, and admin routes for admins themselves
    if (
      path.startsWith('/_next') || 
      path.startsWith('/api') || 
      path.includes('.') ||
      path === '/favicon.ico'
    ) {
      return response;
    }
    
    // Get the authentication token
    const session = request.cookies.get('supabase-auth-token')?.value;
    const userIdMatch = session ? /,"user",{"id":"([^"]+)"/.exec(session) : null;
    const userId = userIdMatch ? userIdMatch[1] : undefined;
    
    // Track the page view client-side using a hidden iframe
    if (path && userId) {
      // Call our analytics tracking function
      try {
        await trackPageView(userId, path);
      } catch (error) {
        console.error('Failed to track page view:', error);
        // No need to fail the request if tracking fails
      }
      
      // Alternatively, we could inject a script that calls our client-side 
      // tracking function for more accuracy (device info, session time, etc.)
    }
  } catch (error) {
    console.error('Error in analytics middleware:', error);
    // Continue with the request even if tracking fails
  }
  
  return response;
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 