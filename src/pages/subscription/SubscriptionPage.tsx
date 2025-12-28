import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionRequired } from '@/components/subscription/SubscriptionRequired';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const supabase = createClient();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const { 
    isLoading, 
    subscription, 
    isSubscriptionValid, 
    isDeveloper,
    isTrialActive,
    daysLeftInTrial,
    refreshSubscription
  } = useSubscription();

  useEffect(() => {
    const checkEmailVerification = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsVerified(user?.email_confirmed_at != null);
    };

    checkEmailVerification();
  }, []);

  // Show loading state
  if (isLoading || isVerified === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col light">
        <div className="flex-grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  // If email is not verified, show verification required message
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col light">
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-white shadow-2xl border-0 rounded-2xl">
            <CardHeader>
              <CardTitle>Email Verification Required</CardTitle>
              <CardDescription>Please verify your email to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center p-6 space-y-4">
                <AlertTriangle className="h-12 w-12 text-yellow-500" />
                <p className="text-center text-muted-foreground">
                  We've sent you a verification email. Please check your inbox and click the verification link.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button 
                onClick={async () => {
                  const { error } = await supabase.auth.resend({
                    type: 'signup',
                    email: (await supabase.auth.getUser()).data.user?.email || '',
                  });
                  
                  if (error) {
                    toast({
                      title: "Error",
                      description: "Failed to resend verification email. Please try again.",
                      variant: "destructive",
                    });
                  } else {
                    toast({
                      title: "Success",
                      description: "Verification email sent. Please check your inbox.",
                    });
                  }
                }}
              >
                Resend Verification Email
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // If subscription is not valid and trial has ended, show subscription required page
  if (!isSubscriptionValid && !isTrialActive) {
    return <SubscriptionRequired />;
  }

  // If developer, show developer status
  if (isDeveloper) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col light">
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-white shadow-2xl border-0 rounded-2xl">
            <CardHeader className="text-center pb-6">
              <div 
                className="font-extrabold text-2xl mb-4 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/')}
              >
                <span className="text-purple-500 font-extrabold text-2xl">0nyx</span>
                <span className="text-gray-600 font-extrabold text-2xl">Tech</span>
              </div>
              <CardTitle className="text-gray-900 text-xl font-bold">Developer Account</CardTitle>
              <CardDescription className="text-gray-600 text-sm">
                You have full access to all features as a developer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-6">
                <Badge className="text-lg py-2 px-4 bg-purple-100 text-purple-800 border-purple-300">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Developer Access
                  </span>
                </Badge>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                onClick={() => {
                  console.log('Navigating to /app/analytics');
                  console.log('Current location:', window.location.href);
                  console.log('Navigate function:', navigate);
                  
                  // Try multiple navigation methods
                  try {
                    navigate('/app/analytics');
                    console.log('Navigate called successfully');
                  } catch (error) {
                    console.error('Navigate error:', error);
                    // Fallback to window.location
                    window.location.href = '/app/analytics';
                  }
                }}
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/20 text-white font-medium rounded-lg"
              >
                Go to Analytics
              </Button>
              <Button 
                onClick={() => {
                  console.log('Direct navigation to analytics');
                  window.location.href = '/app/analytics';
                }}
                variant="outline"
                className="w-full h-12 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                Direct Link (Bypass Guard)
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // If trial is active, show trial status
  if (isTrialActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col light">
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-white shadow-2xl border-0 rounded-2xl">
            <CardHeader className="text-center pb-6">
              <div 
                className="font-extrabold text-2xl mb-4 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/')}
              >
                <span className="text-purple-500 font-extrabold text-2xl">0nyx</span>
                <span className="text-gray-600 font-extrabold text-2xl">Tech</span>
              </div>
              <CardTitle className="text-gray-900 text-xl font-bold">Trial Active</CardTitle>
              <CardDescription className="text-gray-600 text-sm">
                You have {daysLeftInTrial} {daysLeftInTrial === 1 ? 'day' : 'days'} left in your trial.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-6">
                <Badge className="text-lg py-2 px-4 bg-blue-100 text-blue-800 border-blue-300">
                  <span className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {daysLeftInTrial} {daysLeftInTrial === 1 ? 'day' : 'days'} remaining
                  </span>
                </Badge>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                onClick={() => {
                  console.log('Navigating to /app/analytics from trial section');
                  navigate('/app/analytics');
                }}
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/20 text-white font-medium rounded-lg"
              >
                Start Using 0nyx
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/pricing')}
                className="w-full h-12 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                View Pricing Plans
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // If subscription is active, show subscription details
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col light">
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-white shadow-2xl border-0 rounded-2xl">
          <CardHeader className="text-center pb-6">
            <div 
              className="font-extrabold text-2xl mb-4 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('/')}
            >
              <span className="text-purple-500 font-extrabold text-2xl">0nyx</span>
              <span className="text-gray-600 font-extrabold text-2xl">Tech</span>
            </div>
            <CardTitle className="text-gray-900 text-xl font-bold">Subscription Active</CardTitle>
            <CardDescription className="text-gray-600 text-sm">
              Your subscription is currently active.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-gray-600">Status</span>
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Active
                  </span>
                </Badge>
              </div>
              
              {subscription?.current_period_end && (
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-600">Next Billing Date</span>
                  <span className="text-gray-900">{new Date(subscription.current_period_end).toLocaleDateString()}</span>
                </div>
              )}
              
              {subscription?.plan && (
                <>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-600">Plan</span>
                    <span className="text-gray-900">{subscription.plan.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Price</span>
                    <span className="text-gray-900">${subscription.plan.price_monthly}/month</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              onClick={() => {
                console.log('Navigating to /app/analytics from active subscription section');
                navigate('/app/analytics');
              }}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/20 text-white font-medium rounded-lg"
            >
              Go to Analytics
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/app/settings/billing')}
              className="w-full h-12 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              Manage Billing
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 