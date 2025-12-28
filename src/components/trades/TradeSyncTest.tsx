import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  Wifi, 
  User, 
  CreditCard,
  TestTube,
  Play,
  Stop
} from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { BrokerSyncModal } from './BrokerSyncModal';
import { OAuthConnectionModal } from './OAuthConnectionModal';

export function TradeSyncTest() {
  const { 
    subscription, 
    isLoading, 
    canAccessTradeSync, 
    isProMember,
    isDeveloper,
    isSubscriptionValid 
  } = useSubscription();
  
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const runTests = async () => {
    setIsRunningTests(true);
    const results = [];

    // Test 1: Subscription Status
    results.push({
      name: 'Subscription Status',
      status: subscription ? 'pass' : 'fail',
      message: subscription ? `Active subscription (${subscription.status})` : 'No subscription found',
      details: subscription ? {
        userId: subscription.user_id,
        status: subscription.status,
        isDeveloper: subscription.is_developer,
        stripeCustomerId: subscription.stripe_customer_id
      } : null
    });

    // Test 2: Pro Access
    results.push({
      name: 'Pro Access Check',
      status: canAccessTradeSync ? 'pass' : 'fail',
      message: canAccessTradeSync ? 'User has Pro access' : 'User does not have Pro access',
      details: {
        canAccessTradeSync,
        isProMember,
        isDeveloper,
        isSubscriptionValid
      }
    });

    // Test 3: Developer Status
    results.push({
      name: 'Developer Status',
      status: isDeveloper ? 'pass' : 'fail',
      message: isDeveloper ? 'User is a developer' : 'User is not a developer',
      details: { isDeveloper }
    });

    // Test 4: Bypass User Check
    const bypassUserIds = ['856950ff-d638-419d-bcf1-b7dac51d1c7f'];
    const isBypassUser = subscription?.user_id && bypassUserIds.includes(subscription.user_id);
    results.push({
      name: 'Bypass User Check',
      status: isBypassUser ? 'pass' : 'fail',
      message: isBypassUser ? 'User is in bypass list' : 'User is not in bypass list',
      details: { 
        userId: subscription?.user_id,
        isBypassUser,
        bypassUserIds 
      }
    });

    // Test 5: Stripe Integration
    results.push({
      name: 'Stripe Integration',
      status: (subscription?.stripe_customer_id && subscription?.stripe_subscription_id) ? 'pass' : 'fail',
      message: (subscription?.stripe_customer_id && subscription?.stripe_subscription_id) 
        ? 'Stripe integration active' 
        : 'No Stripe integration found',
      details: {
        stripeCustomerId: subscription?.stripe_customer_id,
        stripeSubscriptionId: subscription?.stripe_subscription_id
      }
    });

    setTestResults(results);
    setIsRunningTests(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-100 text-green-800">PASS</Badge>;
      case 'fail':
        return <Badge className="bg-red-100 text-red-800">FAIL</Badge>;
      default:
        return <Badge variant="outline">UNKNOWN</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="h-5 w-5" />
            <span>Trade Sync Feature Test</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Subscription:</span>
              <Badge variant={subscription ? "default" : "secondary"}>
                {subscription ? subscription.status : 'None'}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Wifi className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Trade Sync Access:</span>
              <Badge variant={canAccessTradeSync ? "default" : "destructive"}>
                {canAccessTradeSync ? 'Allowed' : 'Denied'}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Pro Member:</span>
              <Badge variant={isProMember ? "default" : "secondary"}>
                {isProMember ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>

          {/* Test Controls */}
          <div className="flex space-x-2">
            <Button 
              onClick={runTests} 
              disabled={isRunningTests}
              className="flex items-center space-x-2"
            >
              {isRunningTests ? (
                <Stop className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>{isRunningTests ? 'Running Tests...' : 'Run Tests'}</span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setShowBrokerModal(true)}
              disabled={!canAccessTradeSync}
            >
              <Wifi className="h-4 w-4 mr-2" />
              Test Broker Modal
            </Button>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Test Results:</h4>
              {testResults.map((result, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(result.status)}
                      <span className="font-medium">{result.name}</span>
                    </div>
                    {getStatusBadge(result.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
                  {result.details && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">
                        View Details
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Feature Access Alert */}
          {!canAccessTradeSync && (
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Trade Sync feature is not accessible. User needs a Pro subscription ($39.99/month) or developer access.
              </AlertDescription>
            </Alert>
          )}

          {canAccessTradeSync && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Trade Sync feature is accessible! User has Pro access or is a developer.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Broker Sync Modal */}
      <BrokerSyncModal
        isOpen={showBrokerModal}
        onClose={() => setShowBrokerModal(false)}
        onBrokerSelected={(brokerId) => {
          console.log('Broker selected:', brokerId);
        }}
      />
    </div>
  );
}
