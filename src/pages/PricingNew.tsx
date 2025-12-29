import { useState, useEffect } from 'react';
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

const plans = [
  {
    name: 'Monthly',
    price: '$19.99',
    description: 'Perfect for All traders',
    features: [
      'Unlimited trades',
      'Advanced analytics',
      'Trade journaling',
      'Performance metrics',
      'Email support'
    ],
    priceId: 'price_1QzZqQK9cein1vEZExkBcl89', // Monthly subscription price ID
    interval: 'month'
  },
  {
    name: 'Pro',
    price: '$39.99',
    description: 'Advanced copy trading features',
    features: [
      'All Monthly features',
      'Copy Trading',
      'Mentor Assistance',
      'Automatic Broker Sync',
      'Priority Support'
    ],
    interval: 'month',
    comingSoon: true
  },
  {
    name: 'Yearly',
    price: '$199.99',
    description: 'Best value for serious traders',
    features: [
      'All Monthly features',
      'Priority support',
      'Beta access',
      'Custom metrics',
      '2 months free'
    ],
    priceId: 'price_1R0eqXK9cein1vEZJ35QwGMR', // Yearly subscription price ID
    interval: 'year'
  }
];

export default function Pricing() {
  const supabase = createClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Get subscription status
  const {
    status,
    updateSubscriptionStatus,
    isLoading: subscriptionLoading,
    isAuthenticated
  } = useSubscriptionStatus();

  // Check if user is coming from forced redirect
  const [isForced, setIsForced] = useState(false);

  useEffect(() => {
    // Check if the user was redirected from the dashboard
    if (location.state && location.state.fromDashboard) {
      setIsForced(true);
    }
  }, [location]);

  const handleSubscribe = async (priceId: string) => {
    try {
      setIsLoading(priceId);

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Redirect to signup instead of signin
        toast({
          title: "Authentication Required",
          description: "Please create an account to subscribe",
        });
        navigate('/signup', { state: { returnToPricing: true } });
        return;
      }

      // Create a Stripe checkout session
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId,
          userId: user.id,
          email: user.email,
          returnUrl: `${window.location.origin}/app/analytics`
        }
      });

      if (error) throw error;

      // When the checkout is successful, update the subscription status
      if (data?.url) {
        // Update subscription status to 'active' after successful checkout
        // (this will be properly updated by webhook later, but gives immediate UI feedback)
        await updateSubscriptionStatus('active', 'basic');

        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast({
        title: "Error",
        description: "Failed to start subscription process. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  // Get user info to personalize the page
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const getUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        // Extract name from email (everything before @)
        const name = user.email.split('@')[0];
        setUserName(name);
      }
    };

    getUserInfo();
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white flex h-16 items-center px-6 border-b border-gray-200">
        <div className="font-extrabold text-xl relative flex items-center">
          <a href="/" className="flex items-center">
            <span className="relative z-10 text-purple-500">0nyx</span>
          </a>
          <div className="absolute -bottom-1 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 via-purple-600 to-blue-500 rounded-full"></div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              {userName && <span className="text-gray-600">Welcome, {userName}</span>}
              <button
                onClick={() => navigate('/app/analytics')}
                className="px-4 py-2 rounded text-gray-800 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 hover:scale-105 bg-transparent"
              >
                Analytics
              </button>
              <button
                onClick={async () => {
                  try {
                    await supabase.auth.signOut();
                    navigate('/signin');
                  } catch (error) {
                    console.error('Error signing out:', error);
                    toast({
                      title: "Error",
                      description: "Failed to sign out. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
                className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => navigate('/signin')}
                className="px-4 py-2 rounded text-gray-800 hover:text-transparent hover:bg-clip-text hover:bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 hover:scale-105 bg-transparent"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-4 py-2 rounded bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      <main className="container mx-auto pt-24 pb-16 px-4">
        <div className="w-full py-12 md:py-24 lg:py-32 bg-white">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                {isForced && (
                  <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg mb-6">
                    <p>Please select a subscription plan to continue using 0nyx.</p>
                  </div>
                )}

                {status === 'pending' && (
                  <div className="bg-blue-100 text-blue-800 p-4 rounded-lg mb-6">
                    <p>Your account is ready! Choose a subscription plan to start journaling your trades.</p>
                  </div>
                )}

                {status === 'unauthenticated' && (
                  <div className="bg-blue-100 text-blue-800 p-4 rounded-lg mb-6">
                    <p>Create an account to get started with 0nyx Trading. Select a plan below.</p>
                    <div className="mt-4 flex justify-center gap-4">
                      <Button onClick={() => navigate('/signup')} className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20">
                        Sign Up
                      </Button>
                      <Button variant="outline" onClick={() => navigate('/signin')} className="border-purple-500 text-purple-500 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-purple-600/10">
                        Sign In
                      </Button>
                    </div>
                  </div>
                )}

                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                  Simple, transparent pricing
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-700 md:text-xl">
                  Choose the plan that's right for you and start improving your trading today.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl gap-6 py-12 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${plan.name === 'Yearly' ? 'relative' : ''
                    } ${plan.name === 'Pro' ? 'relative' : ''
                    }`}
                >
                  <div className="p-6">
                    {plan.comingSoon && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        Coming Soon
                      </div>
                    )}
                    <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                    <p className="text-gray-600 mt-1">{plan.description}</p>
                    <div className="flex items-baseline gap-1 mt-4">
                      <span className={`text-3xl font-bold ${plan.name === 'Yearly' ? 'text-purple-500' :
                          plan.name === 'Pro' ? 'text-blue-500' : 'text-purple-500'
                        }`}>
                        {plan.price}
                      </span>
                      <span className="text-gray-600">/{plan.interval}</span>
                    </div>

                    <ul className="grid gap-4 mt-6">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className={`h-4 w-4 ${plan.name === 'Yearly' ? 'text-purple-500' :
                              plan.name === 'Pro' ? 'text-blue-500' : 'text-purple-500'
                            }`} />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      className={`w-full mt-6 px-4 py-2 rounded ${plan.name === 'Yearly'
                          ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/20' :
                          plan.name === 'Pro'
                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/20'
                        } ${(!!isLoading || subscriptionLoading || plan.comingSoon) ? 'opacity-70 cursor-not-allowed' : ''}`}
                      onClick={() => {
                        if (plan.comingSoon) {
                          toast({
                            title: "Coming Soon",
                            description: "This subscription tier will be available soon!",
                          });
                          return;
                        }

                        if (!isAuthenticated) {
                          navigate('/signup', { state: { returnToPricing: true } });
                        } else {
                          handleSubscribe(plan.priceId);
                        }
                      }}
                      disabled={!!isLoading || subscriptionLoading || plan.comingSoon}
                    >
                      {plan.comingSoon
                        ? "Coming Soon"
                        : isLoading === plan.priceId
                          ? "Loading..."
                          : !isAuthenticated
                            ? "Sign Up & Subscribe"
                            : "Get Started"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer with subtle animation */}
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
            <p className="text-gray-600 text-sm">© 2026 0nyxTech. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
