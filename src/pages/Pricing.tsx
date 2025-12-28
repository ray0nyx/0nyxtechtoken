import { useState, useEffect } from 'react';
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Zap, Shield, Wallet, TrendingUp, BarChart3, Copy, Bitcoin, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { UserDropdown } from '@/components/ui/user-dropdown';

// Stripe Price IDs - Update these after creating products in Stripe Dashboard
// To create in Stripe:
// 1. Go to https://dashboard.stripe.com/products
// 2. Create 3 products: Starter ($19.99/mo), Pro ($39.99/mo), Elite ($79.99/mo)
// 3. Copy the price IDs (starts with price_) and paste below
const STRIPE_PRICE_IDS = {
  starter: import.meta.env.VITE_STRIPE_PRICE_STARTER || 'price_1QzZqQK9cein1vEZExkBcl89',
  pro: import.meta.env.VITE_STRIPE_PRICE_PRO || 'price_1RBNSGK9cein1vEZ0UhpiPSZ',
  elite: import.meta.env.VITE_STRIPE_PRICE_ELITE || 'price_1SaQuGK9cein1vEZSXHK1gPU'
};

const plans = [
  {
    name: 'Starter',
    price: '$19.99',
    description: 'Essential crypto trading analytics',
    features: [
      'Unlimited CSV trade uploads',
      'SOL & BTC trade tracking',
      'Basic P&L analytics',
      'Trade journaling',
      'Performance metrics',
      'Email support'
    ],
    priceId: STRIPE_PRICE_IDS.starter,
    interval: 'month',
    icon: BarChart3,
    gradient: 'from-emerald-500 to-teal-500',
    popular: false
  },
  {
    name: 'Pro',
    price: '$39.99',
    description: 'Advanced analytics + broker sync',
    features: [
      'Everything in Starter',
      'Automatic broker sync',
      'Binance, Bybit, OKX integration',
      'Advanced backtesting',
      'Real-time P&L tracking',
      'Liquidation risk alerts',
      'Priority support'
    ],
    priceId: STRIPE_PRICE_IDS.pro,
    interval: 'month',
    icon: TrendingUp,
    gradient: 'from-purple-500 to-indigo-500',
    popular: true
  },
  {
    name: 'Elite',
    price: '$79.99',
    description: 'Full suite + wallet copy trading',
    features: [
      'Everything in Pro',
      'Wallet copy trading',
      'Track top SOL wallets',
      'Bitcoin on-chain analysis',
      'Whale movement alerts',
      'DEX trade analytics',
      'Finality-to-emotion analyzer',
      'Tax-ready reporting',
      'Dedicated support'
    ],
    priceId: STRIPE_PRICE_IDS.elite,
    interval: 'month',
    icon: Wallet,
    gradient: 'from-amber-500 to-orange-500',
    popular: false
  }
];

export default function Pricing() {
  const supabase = createClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  
  const { 
    status, 
    updateSubscriptionStatus, 
    isLoading: subscriptionLoading,
    isAuthenticated
  } = useSubscriptionStatus();
  
  const [isForced, setIsForced] = useState(false);
  
  useEffect(() => {
    if (location.state && location.state.fromDashboard) {
      setIsForced(true);
    }
  }, [location]);

  // NOTE: We intentionally do NOT redirect authenticated users from the pricing page
  // Users should be able to view pricing even when logged in (to upgrade, etc.)

  const handleSubscribe = async (priceId: string) => {
    try {
      setIsLoading(priceId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please create an account to subscribe",
        });
        navigate('/signup', { state: { returnToPricing: true } });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId,
          userId: user.id,
          email: user.email,
          returnUrl: `${window.location.origin}/app/analytics`
        }
      });

      if (error) throw error;

      if (data?.url) {
        await updateSubscriptionStatus('active', 'basic');
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

  const [userName, setUserName] = useState<string | null>(null);
  
  useEffect(() => {
    const getUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        const name = user.email.split('@')[0];
        setUserName(name);
      }
    };
    
    getUserInfo();
  }, []);


  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[150px]"></div>
      </div>

      <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-sm flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="font-extrabold text-xl relative flex items-center">
          <a 
            onClick={() => navigate('/')}
            className="cursor-pointer flex items-center"
          >
            <span className="text-purple-500 font-extrabold text-2xl">0nyx</span>
            <span className="text-gray-800 font-extrabold text-2xl">Tech</span>
          </a>
        </div>

        <div className="hidden md:flex items-center justify-center flex-1">
          <nav className="flex items-center space-x-8">
            <button 
              onClick={() => navigate('/pricing')} 
              className="text-purple-500 font-medium"
            >
              Pricing
            </button>
            <button 
              onClick={() => navigate('/affiliates')} 
              className="text-gray-600 hover:text-purple-500 transition-colors duration-300 font-medium"
            >
              Become An Affiliate
            </button>
          </nav>
        </div>

        <div className="ml-auto flex items-center gap-4">
          {isAuthenticated ? (
            <UserDropdown />
          ) : (
            <>
              <button 
                onClick={() => navigate('/signin')}
                className="text-gray-600 hover:text-purple-500 transition-colors px-4 py-2 font-medium"
              >
                Sign In
              </button>
              <button 
                onClick={() => navigate('/signup')}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-2 rounded-lg transition-all duration-300 font-medium"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      <main className="container mx-auto py-12 px-4 relative z-10">
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-4">
                {isForced && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-lg mb-6">
                    <p>Please select a subscription plan to continue using 0nyx.</p>
                  </div>
                )}
                
                {status === 'pending' && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-lg mb-6">
                    <p>Your account is ready! Choose a subscription plan to start tracking your crypto trades.</p>
                  </div>
                )}
                
                {!isAuthenticated && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
                    <p><strong>Access Denied:</strong> You need an active subscription to access the dashboard. Please subscribe below to continue.</p>
                  </div>
                )}
                
                {status === 'unauthenticated' && (
                  <div className="bg-purple-50 border border-purple-200 text-purple-700 p-4 rounded-lg mb-6">
                    <p>Create an account to get started with 0nyx Crypto Analytics. Select a plan below.</p>
                    <div className="mt-4 flex justify-center gap-4">
                      <Button onClick={() => navigate('/signup')} className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-8 py-5 text-xl font-bold">
                        Sign Up
                      </Button>
                      <Button onClick={() => navigate('/signin')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-8 py-5 text-xl font-bold">
                        Sign In
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Badge */}
                <div className="inline-flex items-center gap-2 bg-purple-100 border border-purple-200 rounded-full px-4 py-2 text-purple-600 text-sm font-medium mx-auto">
                  <Sparkles className="w-4 h-4" />
                  Professional Crypto Trading Analytics
                </div>

                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                  <span className="text-gray-900">Stop Trading </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">Blind</span>
                </h1>
                <p className="mx-auto max-w-[800px] text-gray-600 text-lg md:text-xl">
                  Quantify the emotional cost of every SOL liquidation. The only professional journal that correlates your discipline to finality speed and congestion costs.
                </p>
                
                {/* Free Trial Banner */}
                <div className="mt-6 bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20 rounded-xl px-6 py-4 text-white font-bold text-lg mx-auto max-w-2xl">
                  🎉 Start Your <span className="underline">14-Day Free Trial</span> - No Credit Card Required Until Trial Ends!
                </div>
                <p className="mt-4 text-sm text-gray-500 mx-auto max-w-2xl">
                  ✓ 14-day free trial • ✓ Cancel anytime • ✓ No charges until trial ends
                </p>
              </div>
            </div>

            {/* Pricing Cards */}
            <div className="mx-auto grid max-w-6xl gap-8 py-16 lg:grid-cols-3">
              {plans.map((plan) => {
                const IconComponent = plan.icon;
                return (
                  <Card 
                    key={plan.name} 
                    className={`relative bg-white border border-gray-200 overflow-hidden transition-all duration-500 hover:scale-105 hover:shadow-xl ${
                      plan.popular ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-500/20' : 'hover:border-purple-300'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                        MOST POPULAR
                      </div>
                    )}
                    
                    {/* Gradient overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${plan.gradient} opacity-5`}></div>
                    
                    <div className="relative p-8">
                      {/* Icon */}
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-6`}>
                        <IconComponent className="w-7 h-7 text-white" />
                      </div>

                      <h2 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h2>
                      <p className="text-gray-500 mb-6">{plan.description}</p>
                      
                      <div className="flex items-baseline gap-1 mb-8">
                        <span className={`text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${plan.gradient}`}>
                          {plan.price}
                        </span>
                        <span className="text-gray-400">/{plan.interval}</span>
                      </div>

                      <ul className="space-y-4 mb-8">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${plan.gradient} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                              <Check className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-gray-600 text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button 
                        onClick={() => handleSubscribe(plan.priceId!)}
                        disabled={isLoading === plan.priceId || subscriptionLoading || status === 'active'}
                        className={`w-full py-6 text-lg font-bold bg-gradient-to-r ${plan.gradient} hover:opacity-90 text-white transition-all duration-300`}
                      >
                        {isLoading === plan.priceId ? (
                          <div className="flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Processing...
                          </div>
                        ) : status === 'active' ? (
                          'Current Plan'
                        ) : (
                          `Start Free Trial - ${plan.name}`
                        )}
                      </Button>
                      {status !== 'active' && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                          14-day free trial, then {plan.price}/{plan.interval}
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Feature Comparison */}
            <div className="mt-16 max-w-4xl mx-auto">
              <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">Compare Plans</h3>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-4 gap-4 p-6 border-b border-gray-200 bg-gray-50">
                  <div className="text-gray-600 font-medium">Feature</div>
                  <div className="text-center text-emerald-600 font-bold">Starter</div>
                  <div className="text-center text-purple-600 font-bold">Pro</div>
                  <div className="text-center text-amber-600 font-bold">Elite</div>
                </div>
                {[
                  { feature: 'CSV Trade Uploads', starter: 'Unlimited', pro: 'Unlimited', elite: 'Unlimited' },
                  { feature: 'Broker Sync', starter: '—', pro: '✓', elite: '✓' },
                  { feature: 'Wallet Copy Trading', starter: '—', pro: '—', elite: '✓' },
                  { feature: 'On-Chain Analysis', starter: '—', pro: '—', elite: '✓' },
                  { feature: 'Backtesting', starter: 'Basic', pro: 'Advanced', elite: 'Advanced' },
                  { feature: 'Liquidation Alerts', starter: '—', pro: '✓', elite: '✓' },
                  { feature: 'Whale Tracking', starter: '—', pro: '—', elite: '✓' },
                  { feature: 'Tax Reporting', starter: '—', pro: '—', elite: '✓' },
                  { feature: 'Support', starter: 'Email', pro: 'Priority', elite: 'Dedicated' },
                ].map((row, index) => (
                  <div key={index} className="grid grid-cols-4 gap-4 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="text-gray-700">{row.feature}</div>
                    <div className="text-center text-gray-500">{row.starter}</div>
                    <div className="text-center text-gray-500">{row.pro}</div>
                    <div className="text-center text-gray-500">{row.elite}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        
        {/* FAQ Section */}
        <section className="py-12 md:py-24 border-t border-gray-200">
          <div className="container px-4 md:px-6 mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Frequently Asked Questions</h2>
            <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
              <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                <h3 className="font-semibold text-lg mb-2 text-gray-900">What exchanges do you support?</h3>
                <p className="text-gray-600">We support Binance, Bybit, OKX, Coinbase, Kraken, and all major DEXs on Solana including Jupiter, Raydium, and Orca. More integrations coming soon!</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                <h3 className="font-semibold text-lg mb-2 text-gray-900">How does wallet copy trading work?</h3>
                <p className="text-gray-600">Track any Solana wallet's trades in real-time. Get alerts when top traders make moves, analyze their strategies, and learn from the best performers.</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                <h3 className="font-semibold text-lg mb-2 text-gray-900">Can I cancel my subscription?</h3>
                <p className="text-gray-600">Yes, you can cancel your subscription at any time from your account dashboard. Your subscription will remain active until the end of your current billing period.</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                <h3 className="font-semibold text-lg mb-2 text-gray-900">Do you offer refunds?</h3>
                <p className="text-gray-600">Yes! We offer a 30-day money-back guarantee. If you're not satisfied, contact us for a full refund.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-gray-200 py-8 bg-white relative z-10">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-6">
              <a href="/terms" className="text-gray-500 hover:text-purple-500 transition-colors">Terms</a>
              <a href="/privacy" className="text-gray-500 hover:text-purple-500 transition-colors">Privacy</a>
              <a href="#" className="text-gray-500 hover:text-purple-500 transition-colors">Contact</a>
            </div>
            <p className="text-gray-400">© 2024 0nyx. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
