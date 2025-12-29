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
import { Web3Background } from '@/components/ui/Web3Background';

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

          // Navigate to previous page or analytics
          const from = location.state?.from?.pathname || '/app/analytics';
          const search = location.state?.from?.search || '';
          console.log(`SignIn: Navigating to ${from}${search}`);
          navigate(from + search);
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
          const from = location.state?.from?.pathname || '/app/analytics';
          const search = location.state?.from?.search || '';
          console.log(`SignIn: Navigating to ${from}${search}`);
          navigate(from + search);
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
            : `${window.location.origin}${location.state?.from?.pathname || '/app/analytics'}`
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
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col relative">
      <Web3Background />
      <div className="flex-grow flex flex-col items-center justify-center p-4 relative z-10">
        <Card className="w-full max-w-sm bg-[#121218]/90 backdrop-blur-xl shadow-2xl border border-white/10 rounded-2xl">
          <CardHeader className="text-center pt-2 pb-2">
            <div
              className="mb-0 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center -mt-8"
              onClick={() => navigate('/')}
            >
              <img
                src="/images/ot white.svg"
                alt="0nyxTech Logo"
                className="h-40 w-auto"
              />
            </div>
            <CardTitle className="text-white text-xl font-bold">Sign In</CardTitle>
            <CardDescription className="text-gray-400 text-sm">
              {returnToPricing
                ? "Sign in to continue"
                : "Welcome back to 0nyx!"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded mb-4">
                {error}
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
                    className="pl-10 h-12 rounded-lg border-white/10 focus:border-slate-400 focus:ring-slate-400 bg-white/5 text-white placeholder:text-gray-500"
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
                    className="pl-10 h-12 rounded-lg border-white/10 focus:border-slate-400 focus:ring-slate-400 bg-white/5 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="px-0 h-auto text-sm text-slate-400 hover:text-slate-300 transition-colors"
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
              <Button type="submit" className="w-full h-12 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(255,255,255,0.1)] border-none" disabled={isLoading}>
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
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#121218] px-2 text-gray-400">Or continue with</span>
              </div>
            </div>

            <Button
              variant="outline"
              type="button"
              className="w-full h-12 bg-white/5 text-white border-white/10 hover:bg-white/10 rounded-lg"
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
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
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

            <div className="mt-3">
              <SolanaSignInButton
                isPhantom={true}
                className="w-full"
              />
            </div>

            <div className="mt-4 text-center text-sm text-gray-400">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="text-slate-400 hover:text-slate-300 hover:underline font-medium transition-colors"
                disabled={isLoading}
              >
                Sign Up
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="w-full py-8 bg-[#0a0a0f] border-t border-white/10 relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-6">
              <a
                href="https://x.com/0nyxTech"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-slate-300 transition-colors duration-300"
                aria-label="X (Twitter)"
              >
                <img
                  src="/images/x-logo.png"
                  alt="X (Twitter)"
                  className="h-5 w-5 opacity-60 hover:opacity-100 transition-opacity invert"
                />
              </a>
              <a
                href="https://www.instagram.com/0nyxtech/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-slate-300 transition-colors duration-300"
                aria-label="Instagram"
              >
                <img
                  src="/images/instagram-logo.png"
                  alt="Instagram"
                  className="h-5 w-5 opacity-60 hover:opacity-100 transition-opacity invert"
                />
              </a>
              <a href="/affiliates" className="text-slate-400 hover:text-slate-300 transition-colors duration-300">Become An Affiliate</a>
              <a href="/terms" className="text-gray-400 hover:text-slate-300 transition-colors duration-300">Terms</a>
              <a href="/privacy" className="text-gray-400 hover:text-slate-300 transition-colors duration-300">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-slate-300 transition-colors duration-300">Contact</a>
            </div>
            <p className="text-gray-500 text-sm">© 2026 0nyxTech. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="bg-[#121218] border border-white/10 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-bold">Reset Password</DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              Enter your email address and we'll send you instructions to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="reset-email" className="text-white font-medium">Email</label>
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
                  className="pl-10 h-12 rounded-lg border-white/10 focus:border-slate-400 focus:ring-slate-400 bg-white/5 text-white placeholder:text-gray-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowResetDialog(false)}
                disabled={isResetting}
                className="h-12 px-6 border-white/10 text-gray-300 hover:bg-white/10 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isResetting}
                className="w-full h-12 bg-slate-300 hover:bg-slate-400 text-slate-900 font-bold rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
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