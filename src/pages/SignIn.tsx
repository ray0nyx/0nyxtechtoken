import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { DEVELOPER_IDS } from '@/hooks/useSubscription';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { SolanaSignInButton } from '@/components/auth/SolanaSignInButton';

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const supabase = createClient();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check if we should return to pricing after signin
  const [returnToPricing, setReturnToPricing] = useState(false);
  
  useEffect(() => {
    // Check if we came from pricing page
    if (location.state && location.state.returnToPricing) {
      setReturnToPricing(true);
    }
  }, [location]);

  // Reset states when component mounts
  useEffect(() => {
    setIsLoading(false);
    setShowResetDialog(false);
    setResetEmail('');
    setIsResetting(false);
    setError(null);
  }, []);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Store tokens explicitly
          localStorage.setItem('sb-access-token', session.access_token);
          localStorage.setItem('sb-refresh-token', session.refresh_token);
          
          // Check if user is a developer
          const developerIds = DEVELOPER_IDS;
          
          if (developerIds.includes(session.user.id)) {
            console.log('Developer user detected, navigating to analytics');
          }
          
          // Always navigate to analytics for logged in users
          navigate('/app/analytics');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      }
    };
    checkAuth();
  }, [navigate, supabase.auth]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    // Explicitly ensure reset dialog is closed on sign in attempt
    setShowResetDialog(false);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user && data.session) {
        console.log('SignIn: User signed in successfully');
        
        // Store tokens explicitly to ensure they're available
        if (data.session.access_token) {
          localStorage.setItem('sb-access-token', data.session.access_token);
        }
        if (data.session.refresh_token) {
          localStorage.setItem('sb-refresh-token', data.session.refresh_token);
        }
        
        toast({
          title: "Success",
          description: "Successfully signed in",
        });
        
        // Small delay to ensure auth state is propagated
        setTimeout(() => {
          console.log('SignIn: Navigating to /app/analytics');
          navigate('/app/analytics');
        }, 500);
      }
    } catch (error) {
      console.error('Signin error:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to sign in. Please check your credentials.",
        variant: "destructive",
      });
      // Explicitly ensure reset dialog stays closed on error
      setShowResetDialog(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: 'https://wagyutech.app/reset-password',
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password reset instructions have been sent to your email",
      });
      setShowResetDialog(false);
      setResetEmail('');
    } catch (error) {
      console.error('Reset password error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send reset instructions",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: returnToPricing 
            ? `${window.location.origin}/app/pricing` 
            : `${window.location.origin}/app/analytics`
        }
      });

      if (error) throw error;
      
      // Google OAuth will redirect the user, so no need to manually redirect here
    } catch (error) {
      console.error('Google signin error:', error);
      setError(error instanceof Error ? error.message : 'Failed to sign in with Google');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to sign in with Google",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Clean up function
  useEffect(() => {
    return () => {
      setIsLoading(false);
      setShowResetDialog(false);
      setResetEmail('');
      setIsResetting(false);
      setError(null);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col light">
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-white shadow-2xl border-0 rounded-2xl">
          <CardHeader className="text-center pb-6">
            <div 
              className="font-extrabold text-2xl mb-4 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center"
              onClick={() => navigate('/')}
            >
              <span className="text-purple-500 font-extrabold text-2xl">0nyx</span>
              <span className="text-gray-600 font-extrabold text-2xl">Tech</span>
            </div>
            <CardTitle className="text-gray-900 text-xl font-bold">Sign In</CardTitle>
            <CardDescription className="text-gray-600 text-sm">
              {returnToPricing 
                ? "Sign in to continue with your subscription" 
                : "Welcome back to 0nyx!"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            {returnToPricing && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
                After signing in, you'll be redirected back to choose your subscription plan.
              </div>
            )}
          
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    required 
                    placeholder="Enter your email"
                    autoComplete="email"
                    disabled={isLoading}
                    className="pl-10 h-12 rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500 bg-white text-black placeholder:text-gray-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <Input 
                    id="password" 
                    name="password" 
                    type="password" 
                    required 
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="pl-10 h-12 rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500 bg-white text-black placeholder:text-gray-500"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  type="button"
                  variant="link" 
                  className="px-0 h-auto text-sm" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowResetDialog(true);
                  }}
                  disabled={isLoading}
                >
                  Forgot password?
                </Button>
              </div>
              <Button type="submit" className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/20 text-white font-medium rounded-lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Please wait
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or continue with</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              type="button" 
              className="w-full bg-white text-black border-gray-300 hover:bg-gray-50"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait
                </>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Sign in with Google
                </>
              )}
            </Button>

            <SolanaSignInButton 
              variant="outline"
              className="w-full bg-white text-black border-gray-300 hover:bg-gray-50"
              label="Sign in with Solana"
            />

            <div className="mt-4 text-center text-sm">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/signup', returnToPricing ? { state: { returnToPricing: true } } : {})}
                className="text-purple-500 hover:text-purple-600 hover:underline font-medium transition-colors"
                disabled={isLoading}
              >
                Sign Up
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer from Index page */}
      <footer className="w-full py-8 bg-white border-t border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-6">
              <a 
                href="https://x.com/WagyuTech" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-gray-600 hover:text-purple-500 transition-colors duration-300"
                aria-label="X (Twitter)"
              >
                <img 
                  src="images/x-logo.png" 
                  alt="X (Twitter)" 
                  className="h-5 w-5 opacity-80 hover:opacity-100 transition-opacity"
                />
              </a>
              <a 
                href="https://www.instagram.com/wagyutech.app/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-gray-600 hover:text-purple-500 transition-colors duration-300"
                aria-label="Instagram"
              >
                <img 
                  src="images/instagram-logo.png" 
                  alt="Instagram" 
                  className="h-5 w-5 opacity-80 hover:opacity-100 transition-opacity"
                />
              </a>
              <a href="/affiliates" className="text-purple-500 hover:text-purple-600 transition-colors duration-300">Become An Affiliate</a>
              <a href="/terms" className="text-gray-600 hover:text-purple-500 transition-colors duration-300">Terms</a>
              <a href="/privacy" className="text-gray-600 hover:text-purple-500 transition-colors duration-300">Privacy</a>
              <a href="#" className="text-gray-600 hover:text-purple-500 transition-colors duration-300">Contact</a>
            </div>
            <p className="text-gray-600 text-sm">© {new Date().getFullYear()} 0nyx. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="bg-white border-0 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-xl font-bold">Reset Password</DialogTitle>
            <DialogDescription className="text-gray-600 text-sm">
              Enter your email address and we'll send you instructions to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="reset-email" className="text-gray-900 font-medium">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={isResetting}
                  required
                  className="pl-10 h-12 rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500 bg-white text-black placeholder:text-gray-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowResetDialog(false)}
                disabled={isResetting}
                className="h-12 px-6 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isResetting}
                className="h-12 px-6 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg"
              >
                {isResetting ? "Sending..." : "Send Instructions"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 