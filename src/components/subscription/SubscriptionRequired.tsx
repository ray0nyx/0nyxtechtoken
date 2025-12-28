import React, { useState } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export const SubscriptionRequired: React.FC = () => {
  const { isTrialActive, daysLeftInTrial, availablePlans } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = async () => {
    if (!selectedPlanId) {
      toast({
        title: 'Please select a plan',
        description: 'You need to select a subscription plan to continue.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      // This is where you would integrate with Stripe or another payment processor
      // For now, we'll just show a toast
      toast({
        title: 'Subscription processing',
        description: 'Your subscription is being processed. This feature will be fully implemented soon.',
      });

      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Error processing subscription:', error);
      toast({
        title: 'Subscription failed',
        description: 'There was an error processing your subscription. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-600 to-purple-900 flex flex-col light">
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm bg-white shadow-2xl border-0 rounded-2xl">
          <CardHeader className="text-center pb-6">
            <div 
              className="font-extrabold text-2xl mb-4 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => window.location.href = '/'}
            >
              <span className="text-purple-500 font-extrabold text-2xl">0nyx</span>
              <span className="text-gray-600 font-extrabold text-2xl">Tech</span>
            </div>
            <CardTitle className="text-gray-900 text-xl font-bold">Subscription Required</CardTitle>
            <CardDescription className="text-gray-600 text-sm">
              {isTrialActive ? (
                `You have ${daysLeftInTrial} ${daysLeftInTrial === 1 ? 'day' : 'days'} left in your trial. Choose a plan to continue using the app after your trial ends.`
              ) : (
                "Your trial has ended. Please subscribe to continue using the app."
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="monthly" className="w-full">
              <div className="flex justify-center mb-4">
                <TabsList className="bg-gray-100">
                  <TabsTrigger 
                    value="monthly" 
                    onClick={() => setBillingCycle('monthly')}
                    className="data-[state=active]:bg-white data-[state=active]:text-gray-900"
                  >
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger 
                    value="yearly" 
                    onClick={() => setBillingCycle('yearly')}
                    className="data-[state=active]:bg-white data-[state=active]:text-gray-900"
                  >
                    Yearly (Save 15%)
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="monthly" className="mt-0">
                <div className="space-y-3">
                  {availablePlans.map(plan => (
                    <div 
                      key={plan.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedPlanId === plan.id 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                          <p className="text-xs text-gray-600">{plan.description}</p>
                          <div className="mt-1">
                            <span className="text-lg font-bold text-gray-900">${plan.price_monthly}</span>
                            <span className="text-gray-600 text-sm">/month</span>
                          </div>
                        </div>
                        <div>
                          {selectedPlanId === plan.id && (
                            <CheckCircle2 className="h-5 w-5 text-purple-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="yearly" className="mt-0">
                <div className="space-y-3">
                  {availablePlans.map(plan => (
                    <div 
                      key={plan.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedPlanId === plan.id 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                          <p className="text-xs text-gray-600">{plan.description}</p>
                          <div className="mt-1">
                            <span className="text-lg font-bold text-gray-900">${(plan.price_yearly / 12).toFixed(0)}</span>
                            <span className="text-gray-600 text-sm">/month</span>
                            <div className="text-xs text-gray-500">Billed annually (${plan.price_yearly})</div>
                          </div>
                        </div>
                        <div>
                          {selectedPlanId === plan.id && (
                            <CheckCircle2 className="h-5 w-5 text-purple-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
        </Tabs>

            <div className="flex flex-col gap-3 mt-6">
              <Button 
                size="lg" 
                onClick={handleSubscribe} 
                disabled={!selectedPlanId || isProcessing}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isProcessing ? 'Processing...' : 'Subscribe Now'}
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => window.location.href = '/pricing'}
                className="w-full bg-cyan-200 hover:bg-cyan-300 text-cyan-800 border-cyan-300"
              >
                Pricing
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 