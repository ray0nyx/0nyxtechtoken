import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { payoutService, BankDetails } from '@/services/payoutService';
import { StripeConnectSetup } from './StripeConnectSetup';
import { DollarSign, CreditCard, AlertCircle, CheckCircle, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface PayoutRequestFormProps {
  affiliateId: string;
  userEmail: string;
  onPayoutCreated: () => void;
}

export const PayoutRequestForm: React.FC<PayoutRequestFormProps> = ({ 
  affiliateId, 
  userEmail,
  onPayoutCreated 
}) => {
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [payoutSettings, setPayoutSettings] = useState<any>(null);
  const [availableAmount, setAvailableAmount] = useState(0);
  const [requestedAmount, setRequestedAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savingBankDetails, setSavingBankDetails] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showRoutingNumber, setShowRoutingNumber] = useState(false);
  const [isStripeReady, setIsStripeReady] = useState(false);
  const [stripeDashboardUrl, setStripeDashboardUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [affiliateId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settings, amount, bank] = await Promise.all([
        payoutService.getPayoutSettings(),
        payoutService.getAvailablePayoutAmount(affiliateId),
        payoutService.getBankDetails(affiliateId)
      ]);

      setPayoutSettings(settings);
      setAvailableAmount(amount);
      setBankDetails(bank);
      setRequestedAmount(Math.min(amount, settings.minimum_payout_amount));
      
      // Check Stripe Connect status
      await checkStripeStatus();
    } catch (error) {
      console.error('Error loading payout data:', error);
      // Don't show error toast for missing payout system
      if (error instanceof Error && error.message.includes('not yet configured')) {
        // Set default values for when payout system is not available
        setPayoutSettings({
          minimum_payout_amount: 50.00,
          payout_frequency: 'manual',
          processing_days: 3,
          currency: 'USD',
          stripe_connect_enabled: false,
          paypal_enabled: false,
          bank_transfer_enabled: true
        });
        setAvailableAmount(0);
        setBankDetails(null);
        setRequestedAmount(0);
      } else {
        toast({
          title: "Error",
          description: "Failed to load payout information",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const checkStripeStatus = async () => {
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
        setIsStripeReady(data.isReady);
        if (data.isReady) {
          // Get dashboard URL
          const dashboardResponse = await fetch('/api/affiliate/stripe-connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'get_dashboard_url',
              affiliateId,
            }),
          });
          const dashboardData = await dashboardResponse.json();
          if (dashboardData.success) {
            setStripeDashboardUrl(dashboardData.dashboardUrl);
          }
        }
      }
    } catch (error) {
      console.error('Error checking Stripe status:', error);
    }
  };

  const handleBankDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankDetails) return;

    try {
      setSavingBankDetails(true);
      await payoutService.saveBankDetails(affiliateId, bankDetails);
      toast({
        title: "Success",
        description: "Bank details saved successfully",
      });
    } catch (error) {
      console.error('Error saving bank details:', error);
      toast({
        title: "Error",
        description: "Failed to save bank details",
        variant: "destructive",
      });
    } finally {
      setSavingBankDetails(false);
    }
  };

  const handlePayoutRequest = async () => {
    if (!isStripeReady) {
      toast({
        title: "Stripe Connect Required",
        description: "Please complete Stripe Connect setup before requesting a payout",
        variant: "destructive",
      });
      return;
    }

    if (requestedAmount < (payoutSettings?.minimum_payout_amount || 50)) {
      toast({
        title: "Minimum Amount Required",
        description: `Minimum payout amount is $${payoutSettings?.minimum_payout_amount || 50}`,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Create payout request via Stripe Connect
      const response = await fetch('/api/affiliate/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_payout',
          affiliateId,
          amount: requestedAmount,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Payout Requested",
          description: "Your payout request has been submitted and will be processed within 1-2 business days",
        });
        onPayoutCreated();
        loadData(); // Refresh data
      } else {
        throw new Error(data.error || 'Failed to create payout request');
      }
    } catch (error) {
      console.error('Error creating payout request:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create payout request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading payout information...</div>
        </CardContent>
      </Card>
    );
  }

  // Show message if payout system is not available
  if (availableAmount === 0 && !payoutSettings) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">Payout System Coming Soon</h3>
              <p className="text-yellow-700">
                The payout system is currently being set up. You'll be able to request payouts once you reach the minimum threshold and the system is fully configured.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Available Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Available Balance
          </CardTitle>
          <CardDescription>
            Your available commission balance ready for payout
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            ${availableAmount.toFixed(2)}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Minimum payout: ${payoutSettings?.minimum_payout_amount || 50}
          </p>
        </CardContent>
      </Card>

      {/* Stripe Connect Setup */}
      <StripeConnectSetup
        affiliateId={affiliateId}
        userEmail={userEmail}
        onSetupComplete={() => {
          setIsStripeReady(true);
          checkStripeStatus();
        }}
      />

      {/* Bank Details Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Bank Details
          </CardTitle>
          <CardDescription>
            Add your bank account information to receive payouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBankDetailsSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={bankDetails?.bank_name || ''}
                  onChange={(e) => setBankDetails(prev => ({ ...prev!, bank_name: e.target.value }))}
                  placeholder="Chase Bank"
                  required
                />
              </div>
              <div>
                <Label htmlFor="account_holder_name">Account Holder Name</Label>
                <Input
                  id="account_holder_name"
                  value={bankDetails?.account_holder_name || ''}
                  onChange={(e) => setBankDetails(prev => ({ ...prev!, account_holder_name: e.target.value }))}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <Label htmlFor="account_number">Account Number</Label>
                <div className="relative">
                  <Input
                    id="account_number"
                    type={showAccountNumber ? "text" : "password"}
                    value={bankDetails?.account_number || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setBankDetails(prev => ({ ...prev!, account_number: value }));
                    }}
                    placeholder="1234567890"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    onClick={() => setShowAccountNumber(!showAccountNumber)}
                  >
                    {showAccountNumber ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="routing_number">Routing Number</Label>
                <div className="relative">
                  <Input
                    id="routing_number"
                    type={showRoutingNumber ? "text" : "password"}
                    value={bankDetails?.routing_number || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setBankDetails(prev => ({ ...prev!, routing_number: value }));
                    }}
                    placeholder="021000021"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    onClick={() => setShowRoutingNumber(!showRoutingNumber)}
                  >
                    {showRoutingNumber ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="account_type">Account Type</Label>
                <Select
                  value={bankDetails?.account_type || 'checking'}
                  onValueChange={(value: 'checking' | 'savings') => 
                    setBankDetails(prev => ({ ...prev!, account_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  value={bankDetails?.country || 'US'}
                  onValueChange={(value) => 
                    setBankDetails(prev => ({ ...prev!, country: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="submit"
              disabled={savingBankDetails}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20"
            >
              {savingBankDetails ? 'Saving...' : 'Save Bank Details'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Payout Request */}
      {bankDetails && availableAmount >= (payoutSettings?.minimum_payout_amount || 50) && (
        <Card>
          <CardHeader>
            <CardTitle>Request Payout</CardTitle>
            <CardDescription>
              Request a payout to your bank account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Payout Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min={payoutSettings?.minimum_payout_amount || 50}
                  max={availableAmount}
                  step="0.01"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(parseFloat(e.target.value) || 0)}
                  placeholder="50.00"
                />
                <p className="text-sm text-gray-600 mt-1">
                  Available: ${availableAmount.toFixed(2)}
                </p>
              </div>
              
              {isStripeReady ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-800">
                    Stripe Connect is ready! Payouts are processed within 1-2 business days and sent directly to your bank account.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm text-yellow-800">
                    Please complete Stripe Connect setup above to enable payouts.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handlePayoutRequest}
                  disabled={loading || !isStripeReady || requestedAmount < (payoutSettings?.minimum_payout_amount || 50)}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/20"
                >
                  {loading ? 'Processing...' : 'Request Payout'}
                </Button>
                
                {isStripeReady && stripeDashboardUrl && (
                  <Button
                    onClick={() => window.open(stripeDashboardUrl, '_blank')}
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-500/10"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Stripe Dashboard
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {availableAmount < (payoutSettings?.minimum_payout_amount || 50) && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Payout Not Available
              </h3>
              <p className="text-gray-600">
                You need at least ${payoutSettings?.minimum_payout_amount || 50} in available balance to request a payout.
                <br />
                Current available balance: ${availableAmount.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
