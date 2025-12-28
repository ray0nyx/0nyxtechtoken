/**
 * Turnkey Onboarding Component
 * 
 * Email-to-wallet onboarding flow using Turnkey
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wallet, Mail } from 'lucide-react';
import { getTurnkeyService } from '@/lib/wallet-abstraction/turnkey-service';
import { getOrCreateTurnkeyWallet, createTurnkeyWalletAdapter } from '@/lib/wallet-abstraction/turnkey-wallet';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

interface TurnkeyOnboardingProps {
  onSuccess?: (walletAddress: string) => void;
  onError?: (error: string) => void;
}

export default function TurnkeyOnboarding({ onSuccess, onError }: TurnkeyOnboardingProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = createClient();

  const handleOnboarding = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const turnkeyService = getTurnkeyService();
      
      if (!turnkeyService.isConfigured()) {
        throw new Error('Turnkey is not configured. Please contact support.');
      }

      // Get current user ID
      const userId = user?.id || `temp-${Date.now()}`;

      // Create sub-organization and wallet
      const subOrg = await turnkeyService.createSubOrganization(userId, email);
      
      // Get wallet details
      const wallet = await turnkeyService.getWallet(subOrg.walletId, subOrg.subOrganizationId);
      
      setWalletAddress(wallet.address);

      // Store wallet info in database
      if (user?.id) {
        const { error: dbError } = await supabase
          .from('user_wallets')
          .upsert({
            user_id: user.id,
            wallet_address: wallet.address,
            wallet_type: 'turnkey',
            turnkey_wallet_id: wallet.walletId,
            turnkey_organization_id: wallet.organizationId,
            created_at: new Date().toISOString(),
          });

        if (dbError) {
          console.error('Error saving wallet to database:', dbError);
          // Don't fail the flow if DB save fails
        }
      }

      // Create wallet adapter for use in the app
      const walletAdapter = createTurnkeyWalletAdapter(wallet);
      
      // Store adapter in a global state or context
      // For now, we'll just call the success callback
      if (onSuccess) {
        onSuccess(wallet.address);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create wallet';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Create Your Wallet
        </CardTitle>
        <CardDescription>
          Sign up with your email to get a non-custodial Solana wallet powered by Turnkey
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {walletAddress ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Wallet created successfully!</p>
                  <p className="text-sm text-muted-foreground break-all">
                    Address: {walletAddress}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => {
                setWalletAddress(null);
                setEmail('');
              }}
              variant="outline"
              className="w-full"
            >
              Create Another Wallet
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="[email protected]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              onClick={handleOnboarding}
              disabled={loading || !email}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Wallet...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Create Wallet
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Your private keys are secured by Turnkey. We never have access to them.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
