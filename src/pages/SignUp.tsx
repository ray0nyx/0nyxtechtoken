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

  // Function to safely navigate to pricing page
  const navigateToPricing = () => {
    try {
      // Show success message
      toast({
        title: "Success",
        description: "Account created! Please select a subscription to continue.",
      });

      // Navigate to analytics page
      navigate('/app/analytics');
    } catch (navError) {
      console.error('Navigation error:', navError);
      // Fallback to window.location if react-router fails
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
      // First try to sign up with a more direct approach
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Don't rely on redirect, we'll handle navigation in the component
          data: {
            email_confirmed: false
          }
        }
      });

      if (error) {
        console.error('Signup error:', error);

        // Expanded handling for database error saving new user
        if (error.message.includes('database error saving new user')) {
          console.log('Attempting alternative sign-up flow for:', email);

          // Check if it's a ProtonMail address
          const isProtonMail = email.toLowerCase().includes('@proton.') ||
            email.toLowerCase().includes('@pm.') ||
            email.toLowerCase().includes('@protonmail.') ||
            email.toLowerCase().includes('@proton.me');

          if (isProtonMail) {
            toast({
              title: "ProtonMail Detected",
              description: "We're using an alternative signup method for ProtonMail users. Please wait...",
            });
          }

          try {
            // Show loading toast for alternative flow
            toast({
              title: "Using Alternative Registration",
              description: "Please wait while we complete your registration...",
            });

            // Call our edge function to handle registration
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
              console.error('Alternative registration error:', errorData);
              throw new Error(errorData.error || 'Failed to register user');
            }

            const registrationData = await response.json();
            console.log('Alternative registration successful:', registrationData);

            // If successful, try to sign in
            const { data: signinData, error: signinError } = await supabase.auth.signInWithPassword({
              email,
              password
            });

            if (signinError) {
              console.error('Sign-in after alternative registration failed:', signinError);
              throw signinError;
            }

            // Redirect to Stripe checkout with 14-day free trial
            try {
              const defaultPriceId = import.meta.env.VITE_STRIPE_PRICE_STARTER || 'price_1QzZqQK9cein1vEZExkBcl89';

              const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
                },
                body: JSON.stringify({
                  priceId: defaultPriceId,
                  returnUrl: `${window.location.origin}/app/analytics?session_id={CHECKOUT_SESSION_ID}`
                })
              });

              if (response.ok) {
                const { url } = await response.json();
                if (url) {
                  window.location.href = url;
                  return;
                }
              }
            } catch (checkoutError) {
              console.error('Checkout error:', checkoutError);
            }

            // Fallback navigation
            if (returnToPricing) {
              navigateToPricing();
            } else {
              navigate('/pricing');
            }
            return;
          } catch (altError) {
            console.error('Alternative flow error:', altError);
            throw new Error(altError instanceof Error ? altError.message : 'Signup failed. Please try again.');
          }
        } else {
          // Handle other auth errors
          throw error;
        }
      }

      // If we get here, signUp was successful
      if (data.user) {
        // Create Turnkey wallet for new user
        try {
          const user = data.user;
          const turnkeyService = getTurnkeyService();

          // Check if wallet already exists (unlikely for new sign up but good practice)
          const { data: existingWallet } = await supabase
            .from('user_wallets')
            .select('*')
            .eq('user_id', user.id)
            .eq('wallet_type', 'turnkey')
            .maybeSingle();

          if (!existingWallet) {
            // Create sub-organization and wallet
            const subOrg = await turnkeyService.createSubOrganization(user.id, user.email || '');

            // Save to DB
            await supabase
              .from('user_wallets')
              .upsert({
                user_id: user.id,
                wallet_address: subOrg.walletAddress,
                wallet_type: 'turnkey',
                turnkey_wallet_id: subOrg.walletId,
                turnkey_organization_id: subOrg.subOrganizationId,
                created_at: new Date().toISOString(),
                is_active: true,
              });
          }
        } catch (walletError) {
          console.error('Failed to create Turnkey wallet on signup:', walletError);
          // Don't block signup, user can create wallet later via Deposit modal
        }

        // Redirect to Stripe checkout with 14-day free trial
        try {
          // Use the starter plan priceId as default for new signups
          const defaultPriceId = import.meta.env.VITE_STRIPE_PRICE_STARTER || 'price_1QzZqQK9cein1vEZExkBcl89';

          // Create checkout session via edge function
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
            },
            body: JSON.stringify({
              priceId: defaultPriceId,
              returnUrl: `${window.location.origin}/app/analytics?session_id={CHECKOUT_SESSION_ID}`
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create checkout session');
          }

          const { url } = await response.json();

          if (url) {
            // Redirect to Stripe checkout
            window.location.href = url;
            return;
          } else {
            throw new Error('No checkout URL returned');
          }
        } catch (checkoutError) {
          console.error('Checkout error:', checkoutError);
          // Fallback: show error but don't block signup
          toast({
            title: "Account created",
            description: "Please visit the pricing page to start your subscription",
            variant: "default",
          });

          if (returnToPricing) {
            navigateToPricing();
          } else {
            navigate('/pricing');
          }
        }
      }
    } catch (error: any) {
      setError(error.message || 'An unknown error occurred');
      console.error('Final signup error:', error);
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

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/app/analytics`
        }
      });

      if (error) throw error;

      // Google OAuth will redirect the user, so no need to manually redirect here
    } catch (error) {
      console.error('Google signup error:', error);
      setError(error instanceof Error ? error.message : 'Failed to sign up with Google');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to sign up with Google",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

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
            <CardTitle className="text-gray-900 text-xl font-bold">Create an Account</CardTitle>
            <CardDescription className="text-gray-600 text-sm">
              {returnToPricing
                ? "Sign up to continue with your subscription"
                : "Get started with 0nyx today."}
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
                After signing up, you'll be redirected back to choose your subscription plan.
              </div>
            )}

            <div className="bg-purple-50 border border-purple-200 text-purple-700 px-4 py-3 rounded mb-4">
              <p className="font-semibold">🎉 Start Your 14-Day Free Trial</p>
              <p className="text-sm mt-1">No credit card required until your trial ends. Cancel anytime.</p>
            </div>

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
                    placeholder="Create a password"
                    autoComplete="new-password"
                    minLength={6}
                    disabled={isLoading}
                    className="pl-10 pr-10 h-12 rounded-lg border-gray-300 focus:border-purple-500 focus:ring-purple-500 bg-white text-black placeholder:text-gray-500"
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
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-lg"
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
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 bg-white text-gray-700 border-gray-300 hover:bg-gray-50 rounded-lg"
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
                  variant="outline"
                  className="w-full h-12 bg-white text-gray-700 border-gray-300 hover:bg-gray-50 rounded-lg"
                  label="Sign up with Solana"
                />
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-gray-500">
              By signing up, you agree to our{' '}
              <a href="/terms" className="text-purple-500 hover:text-purple-600 underline">Terms</a>
              {' '}&{' '}
              <a href="/privacy" className="text-purple-500 hover:text-purple-600 underline">Privacy Policy</a>
            </div>

            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">Already have an account?</span>{' '}
              <a
                href="/signin"
                className="font-semibold text-purple-500 hover:text-purple-600 transition-colors"
              >
                Sign in
              </a>
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
            <p className="text-gray-600 text-sm">© {new Date().getFullYear()} All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 