import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface StripeConnectSetupProps {
  affiliateId: string;
  userEmail: string;
  onSetupComplete?: () => void;
}

export const StripeConnectSetup: React.FC<StripeConnectSetupProps> = ({
  affiliateId,
  userEmail,
  onSetupComplete,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAccountStatus();
  }, [affiliateId]);

  const checkAccountStatus = async () => {
    try {
      const response = await fetch('/api/affiliate/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_status',
          affiliateId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setIsReady(data.isReady);
        if (data.isReady) {
          onSetupComplete?.();
        }
      }
    } catch (error) {
      console.error('Error checking account status:', error);
    }
  };

  const createStripeAccount = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/affiliate/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_account',
          affiliateId,
          email: userEmail,
          country: 'US',
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setOnboardingUrl(data.onboardingUrl);
        toast.success('Stripe account created! Please complete onboarding.');
      } else {
        setError(data.error || 'Failed to create Stripe account');
        toast.error(data.error || 'Failed to create Stripe account');
      }
    } catch (error) {
      const errorMessage = 'Failed to create Stripe account';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getDashboardUrl = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/affiliate/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_dashboard_url',
          affiliateId,
        }),
      });

      const data = await response.json();
      
      if (data.success && data.dashboardUrl) {
        setDashboardUrl(data.dashboardUrl);
        window.open(data.dashboardUrl, '_blank');
      } else {
        setError('Failed to get dashboard URL');
        toast.error('Failed to get dashboard URL');
      }
    } catch (error) {
      const errorMessage = 'Failed to get dashboard URL';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    checkAccountStatus();
    toast.success('Stripe Connect setup completed!');
  };

  if (isReady) {
    return (
      <Card className="border-green-200 dark:border-green-700/50 bg-green-50 dark:bg-green-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle className="w-5 h-5" />
            Stripe Connect Ready
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-green-600 dark:text-green-300">
            Your Stripe Connect account is set up and ready to receive payouts!
          </p>
          
          <div className="flex gap-2">
            <Button
              onClick={getDashboardUrl}
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Stripe Dashboard
            </Button>
            
            <Button
              onClick={checkAccountStatus}
              variant="outline"
              className="border-green-500 text-green-600 hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-500/10"
            >
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-200 dark:border-yellow-700/50 bg-yellow-50 dark:bg-yellow-500/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
          <AlertCircle className="w-5 h-5" />
          Stripe Connect Setup Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-yellow-600 dark:text-yellow-300">
            To receive payouts, you need to set up a Stripe Connect account. This allows us to send money directly to your bank account.
          </p>
          
          <div className="bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700/50">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What you'll need:</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• Bank account details (routing & account number)</li>
              <li>• Social Security Number (for tax purposes)</li>
              <li>• Valid government-issued ID</li>
              <li>• 5-10 minutes to complete setup</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-700/50 rounded-lg p-3">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          {onboardingUrl ? (
            <Button
              onClick={() => window.open(onboardingUrl, '_blank')}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Complete Setup
            </Button>
          ) : (
            <Button
              onClick={createStripeAccount}
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Start Setup
            </Button>
          )}
          
          <Button
            onClick={checkAccountStatus}
            variant="outline"
            className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:border-yellow-400 dark:text-yellow-400 dark:hover:bg-yellow-500/10"
          >
            Check Status
          </Button>
        </div>

        {onboardingUrl && (
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-700/50 rounded-lg p-3">
            <p className="text-blue-600 dark:text-blue-400 text-sm">
              <strong>Next:</strong> Click "Complete Setup" to open Stripe's secure onboarding process. 
              After completing setup, return here and click "Check Status" to verify your account is ready.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
