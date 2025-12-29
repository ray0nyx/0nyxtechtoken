import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { SolanaSignInButton } from '@/components/auth/SolanaSignInButton';
import { getTurnkeyService } from '@/lib/wallet-abstraction/turnkey-service';
import { Web3Background } from '@/components/ui/Web3Background';

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const supabase = createClient();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if we should return to pricing after signup
  const [returnToPricing, setReturnToPricing] = useState(false);

  useEffect(() => {
    // Check if we came from pricing page
    if (location.state && location.state.returnToPricing) {
      setReturnToPricing(true);
    }
  }, [location]);

  // Function to navigate after successful signup
  const navigateToApp = () => {
    try {
      toast({
        title: "Success",
        description: "Account created! Welcome to 0nyx.",
      });
      navigate('/app/analytics');
    } catch (navError) {
      console.error('Navigation error:', navError);
      window.location.href = '/app/analytics';
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { email_confirmed: false }
        }
      });

      if (error) {
        if (error.message.includes('database error saving new user')) {
          const isProtonMail = email.toLowerCase().includes('@proton.') ||
            email.toLowerCase().includes('@pm.') ||
            email.toLowerCase().includes('@protonmail.') ||
            email.toLowerCase().includes('@proton.me');

          try {
            toast({
              title: "Using Alternative Registration",
              description: "Please wait while we complete your registration...",
            });

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-user`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({
                email,
                password,
                useAlternativeMethod: true,
                emailProvider: isProtonMail ? 'protonmail' : 'other'
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to register user');
            }

            await supabase.auth.signInWithPassword({ email, password });
            navigateToApp();
            return;
          } catch (altError) {
            throw new Error(altError instanceof Error ? altError.message : 'Signup failed. Please try again.');
          }
        } else {
          throw error;
        }
      }

      if (data.user) {
        navigateToApp();
        return;
      }
    } catch (error: any) {
      setError(error.message || 'An unknown error occurred');
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/app/analytics`
        }
      });

      if (error) throw error;
    } catch (error: any) {
      setError(error.message || 'Failed to sign up with Google');
      toast({
        title: "Error",
        description: error.message || "Failed to sign up with Google",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

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
            <CardTitle className="text-white text-xl font-bold">Create an Account</CardTitle>
            <CardDescription className="text-gray-400 text-sm">
              Get started with 0nyx today.
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
                    placeholder="Create a password"
                    autoComplete="new-password"
                    minLength={6}
                    disabled={isLoading}
                    className="pl-10 pr-10 h-12 rounded-lg border-white/10 focus:border-slate-400 focus:ring-slate-400 bg-white/5 text-white placeholder:text-gray-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Password must be at least 6 characters</p>
              </div>
              <Button
                type="submit"
                className="w-full h-12 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Sign Up Free'
                )}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-[#121218] text-gray-400">Or continue with</span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 bg-white/5 text-white border-white/10 hover:bg-white/10 rounded-lg"
                  onClick={handleGoogleSignUp}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
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
                  )}
                  Google
                </Button>
                <SolanaSignInButton
                  isPhantom={true}
                  className="w-full"
                  label="Sign up with Phantom"
                />
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-gray-500">
              By signing up, you agree to our{' '}
              <a href="/terms" className="text-slate-400 hover:text-slate-300 underline">Terms</a>
              {' '}&{' '}
              <a href="/privacy" className="text-slate-400 hover:text-slate-300 underline">Privacy Policy</a>
            </div>

            <div className="mt-4 text-center text-sm text-gray-400">
              Already have an account?{' '}
              <a
                href="/signin"
                className="font-semibold text-slate-400 hover:text-slate-300 transition-colors"
              >
                Sign in
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="w-full py-8 bg-[#0a0a0f] border-t border-white/10 relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-6">
              <a href="/affiliates" className="text-slate-400 hover:text-slate-300 transition-colors duration-300">Become An Affiliate</a>
              <a href="/terms" className="text-gray-400 hover:text-slate-300 transition-colors duration-300">Terms</a>
              <a href="/privacy" className="text-gray-400 hover:text-slate-300 transition-colors duration-300">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-slate-300 transition-colors duration-300">Contact</a>
            </div>
            <p className="text-gray-500 text-sm">© 2026 0nyxTech. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 