/*
 * This middleware uses Next.js APIs (NextRequest, NextResponse) which are not compatible 
 * with the current Vite/React Router setup. This file has been temporarily disabled.
 * 
 * TODO: Reimplement subscription checks using React Router or a custom middleware solution compatible with Vite.
 */

/*
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export async function middleware(request: NextRequest) {
  try {
    // Get session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Check if user has active subscription
    const { data, error } = await supabase
      .rpc('has_active_subscription', { user_uuid: session.user.id })

    if (error || !data) {
      // Redirect to pricing page if no active subscription
      return NextResponse.redirect(new URL('/pricing', request.url))
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Subscription check error:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    '/app/:path*',
    '/api/:path*',
  ]
} 
*/ 