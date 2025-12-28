import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { createClient } from '@/lib/supabase/client';
import { syncService } from '@/lib/services/syncService';

interface OAuthConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSuccess?: (brokerId: string) => void;
  broker: {
    id: string;
    name: string;
    logo: string;
    description: string;
    website: string;
  };
}

export function OAuthConnectionModal({ isOpen, onClose, onConnectionSuccess, broker }: OAuthConnectionModalProps) {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    apiKey: '',
    secret: '',
    passphrase: '',
    rememberMe: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const handleOAuthLogin = async () => {
    // Validate required fields based on broker type
    if (isCryptoExchange(broker.id)) {
      if (!credentials.apiKey || !credentials.secret) {
        setError('Please enter both API Key and Secret');
        return;
      }
    } else {
      if (!credentials.username || !credentials.password) {
        setError('Please enter both username and password');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      // Handle different OAuth flows based on broker
      switch (broker.id) {
        case 'tradovate':
          await handleTradovateOAuth();
          break;
        case 'ninjatrader':
          await handleNinjaTraderOAuth();
          break;
        case 'binance':
        case 'coinbase':
        case 'kraken':
        case 'kucoin':
        case 'bybit':
        case 'okx':
        case 'bitget':
        case 'huobi':
        case 'gateio':
        case 'mexc':
          await handleCryptoExchangeOAuth();
          break;
        default:
          throw new Error('OAuth not supported for this broker');
      }
    } catch (err) {
      console.error('OAuth error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const isCryptoExchange = (brokerId: string): boolean => {
    const cryptoExchanges = ['binance', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx', 'bitget', 'huobi', 'gateio', 'mexc'];
    return cryptoExchanges.includes(brokerId);
  };

  const handleTradovateOAuth = async () => {
    // Generate a random state value for security
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('oauthState', state);
    localStorage.setItem('selectedBroker', 'Tradovate');
    localStorage.setItem('oauthCredentials', JSON.stringify(credentials));

    // Construct the OAuth URL with necessary parameters
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: import.meta.env.VITE_TRADOVATE_CLIENT_ID || '',
      redirect_uri: `${window.location.origin}/auth/callback`,
      state: state,
      scope: 'trade_data read_accounts',
    });

    // Redirect to Tradovate's OAuth page
    window.location.href = `https://live.tradovate.com/oauth/authorize?${params.toString()}`;
  };

  const handleNinjaTraderOAuth = async () => {
    // For NinjaTrader, we'll simulate OAuth flow
    // In a real implementation, this would redirect to NinjaTrader's OAuth
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('oauthState', state);
    localStorage.setItem('selectedBroker', 'NinjaTrader');
    localStorage.setItem('oauthCredentials', JSON.stringify(credentials));

    // Simulate OAuth redirect (replace with actual NinjaTrader OAuth URL)
    toast({
      title: "NinjaTrader OAuth",
      description: "Redirecting to NinjaTrader for authentication...",
    });

    // For demo purposes, simulate success after 2 seconds
    setTimeout(() => {
      setSuccess(true);
      onConnectionSuccess?.(broker.id);

      setTimeout(() => {
        onClose();
        setSuccess(false);
        setCredentials({ username: '', password: '', rememberMe: false });
      }, 2000);
    }, 2000);
  };

  const handleCryptoExchangeOAuth = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // For Coinbase, redirect to OAuth flow
      if (broker.id === 'coinbase') {
        const state = Math.random().toString(36).substring(7);
        localStorage.setItem('oauthState', state);
        localStorage.setItem('selectedBroker', 'Coinbase');

        const params = new URLSearchParams({
          response_type: 'code',
          client_id: import.meta.env.VITE_COINBASE_CLIENT_ID || '',
          redirect_uri: `${window.location.origin}/auth/coinbase/callback`,
          state: state,
          scope: 'wallet:accounts:read,wallet:transactions:read',
        });

        window.location.href = `https://www.coinbase.com/oauth/authorize?${params.toString()}`;
        return;
      }

      // For Kraken, store credentials and redirect to callback
      if (broker.id === 'kraken') {
        localStorage.setItem('kraken_credentials', JSON.stringify(credentials));
        window.location.href = `${window.location.origin}/auth/kraken/callback`;
        return;
      }

      // For other exchanges (Binance, etc.), use API key flow
      const exchangeCredentials = {
        exchange: broker.id,
        apiKey: credentials.apiKey,
        secret: credentials.secret,
        passphrase: credentials.passphrase || undefined,
        sandbox: false,
      };

      toast({
        title: `Connecting to ${broker.name}`,
        description: `Validating credentials and establishing connection...`,
      });

      // Call Supabase Edge Function for real authentication
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exchange-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          exchange: broker.id,
          credentials: exchangeCredentials,
          userId: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `Failed to connect to ${broker.name}`);
      }

      // Success - show confirmation
      setSuccess(true);
      toast({
        title: "Connection Successful",
        description: `Successfully connected to ${broker.name}. Starting trade sync...`,
      });

      // Trigger initial sync
      try {
        const syncResult = await syncService.syncTrades(result.connectionId, 'historical');
        if (syncResult.success) {
          toast({
            title: "Sync Complete",
            description: `Successfully synced ${syncResult.tradesSynced} trades from ${broker.name}.`,
          });
        } else {
          toast({
            title: "Sync Warning",
            description: `Connected to ${broker.name} but sync failed: ${syncResult.error}`,
            variant: "destructive",
          });
        }
      } catch (syncError) {
        console.error('Sync error:', syncError);
        toast({
          title: "Sync Warning",
          description: `Connected to ${broker.name} but sync failed. You can retry later.`,
          variant: "destructive",
        });
      }

      // Call success callback
      onConnectionSuccess?.(broker.id);

      // Close modal after a short delay
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setCredentials({
          username: '',
          password: '',
          apiKey: '',
          secret: '',
          passphrase: '',
          rememberMe: false
        });
      }, 2000);

    } catch (error) {
      console.error('Crypto exchange OAuth error:', error);
      throw error;
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError('');
      setSuccess(false);
      setCredentials({
        username: '',
        password: '',
        apiKey: '',
        secret: '',
        passphrase: '',
        rememberMe: false
      });
      onClose();
    }
  };

  const getOAuthDescription = () => {
    switch (broker.id) {
      case 'tradovate':
        return 'Sign in with your Tradovate account to sync your futures trades automatically.';
      case 'ninjatrader':
        return 'Sign in with your NinjaTrader account to access your trading data and sync trades.';
      case 'binance':
      case 'coinbase':
      case 'kraken':
      case 'kucoin':
      case 'bybit':
      case 'okx':
      case 'bitget':
      case 'huobi':
      case 'gateio':
      case 'mexc':
        return `Sign in with your ${broker.name} account to sync your cryptocurrency trades automatically.`;
      default:
        return 'Sign in with your account to sync trades automatically.';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-black border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3 text-white">
            <img
              src={broker.logo}
              alt={broker.name}
              className="w-8 h-8 rounded-lg object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span>Connect to {broker.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Broker Info */}
          <div className="p-3 bg-neutral-900 rounded-lg border border-white/10">
            <h4 className="font-medium text-sm text-white">{broker.name}</h4>
            <p className="text-sm text-gray-400 mt-1">
              {getOAuthDescription()}
            </p>
          </div>

          {/* Dynamic form fields based on broker type */}
          {isCryptoExchange(broker.id) ? (
            <>
              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-gray-300">API Key *</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={credentials.apiKey}
                  onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                  disabled={isLoading}
                  className="bg-neutral-900 border-white/10 text-white placeholder:text-gray-600"
                />
              </div>

              {/* Secret Key */}
              <div className="space-y-2">
                <Label htmlFor="secret" className="text-gray-300">Secret Key *</Label>
                <Input
                  id="secret"
                  type="password"
                  placeholder="Enter your secret key"
                  value={credentials.secret}
                  onChange={(e) => setCredentials(prev => ({ ...prev, secret: e.target.value }))}
                  disabled={isLoading}
                  className="bg-neutral-900 border-white/10 text-white placeholder:text-gray-600"
                />
              </div>

              {/* Passphrase (for Coinbase, KuCoin, OKX, Bitget) */}
              {(broker.id === 'coinbase' || broker.id === 'kucoin' || broker.id === 'okx' || broker.id === 'bitget') && (
                <div className="space-y-2">
                  <Label htmlFor="passphrase" className="text-gray-300">Passphrase</Label>
                  <Input
                    id="passphrase"
                    type="password"
                    placeholder="Enter your passphrase (if applicable)"
                    value={credentials.passphrase}
                    onChange={(e) => setCredentials(prev => ({ ...prev, passphrase: e.target.value }))}
                    disabled={isLoading}
                    className="bg-neutral-900 border-white/10 text-white placeholder:text-gray-600"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-300">Username/Email *</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username or email"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  disabled={isLoading}
                  className="bg-neutral-900 border-white/10 text-white placeholder:text-gray-600"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  disabled={isLoading}
                  className="bg-neutral-900 border-white/10 text-white placeholder:text-gray-600"
                />
              </div>
            </>
          )}

          {/* Remember Me */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={credentials.rememberMe}
              onChange={(e) => setCredentials(prev => ({ ...prev, rememberMe: e.target.checked }))}
              disabled={isLoading}
              className="rounded border-gray-300"
            />
            <Label htmlFor="rememberMe" className="text-sm text-gray-400">
              Remember me for future sessions
            </Label>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Successfully connected to {broker.name}!
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="bg-neutral-800 hover:bg-neutral-700 text-slate-300 border-white/10 hover:border-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleOAuthLogin}
              disabled={isLoading || (isCryptoExchange(broker.id) ? (!credentials.apiKey || !credentials.secret) : (!credentials.username || !credentials.password))}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Sign In & Connect'
              )}
            </Button>
          </div>

          {/* External Link */}
          <div className="text-center">
            <Button
              variant="link"
              size="sm"
              onClick={() => window.open(broker.website, '_blank')}
              className="text-gray-500 hover:text-gray-400"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Visit {broker.name} Website
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
