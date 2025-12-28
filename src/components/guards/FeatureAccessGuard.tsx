import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Lock } from 'lucide-react';

interface FeatureAccessGuardProps {
  children: React.ReactNode;
  feature: 'quant-testing' | 'copy-trading' | 'real-time-sync';
  fallbackPath?: string;
}

export const FeatureAccessGuard: React.FC<FeatureAccessGuardProps> = ({ 
  children, 
  feature, 
  fallbackPath = '/app/analytics' 
}) => {
  const { 
    canAccessQuantTesting, 
    canAccessCopyTrading, 
    canAccessRealTimeSync,
    hasBasicAccess 
  } = useSubscription();

  const hasAccess = (() => {
    switch (feature) {
      case 'quant-testing':
        return canAccessQuantTesting;
      case 'copy-trading':
        return canAccessCopyTrading;
      case 'real-time-sync':
        return canAccessRealTimeSync;
      default:
        return false;
    }
  })();

  if (!hasAccess) {
    const featureNames = {
      'quant-testing': 'Quantitative Testing',
      'copy-trading': 'Copy Trading',
      'real-time-sync': 'Real-Time Synchronization'
    };

    const featureDescriptions = {
      'quant-testing': 'Advanced quantitative analysis and backtesting tools',
      'copy-trading': 'Copy successful traders and automate your trading',
      'real-time-sync': 'Real-time synchronization with your broker accounts'
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col light">
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white shadow-2xl border-0 rounded-2xl">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-fit">
                <Lock className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-gray-900 text-xl font-bold">
                Premium Feature Required
              </CardTitle>
              <CardDescription className="text-gray-600 text-sm">
                {featureNames[feature]} is only available to premium subscribers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-gray-700 text-sm mb-4">
                  {featureDescriptions[feature]}
                </p>
                <p className="text-gray-600 text-xs">
                  Upgrade your subscription to access this feature.
                </p>
              </div>
              
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => window.location.href = '/pricing'}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  View Pricing Plans
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = fallbackPath}
                  className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Go to Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
