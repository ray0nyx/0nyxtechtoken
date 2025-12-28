import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { syncService } from '@/lib/services/syncService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function KrakenCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const supabase = createClient();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing Kraken authentication...');
  const [connectionId, setConnectionId] = useState<string | null>(null);

  useEffect(() => {
    handleKrakenCallback();
  }, []);

  const handleKrakenCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        throw new Error(`Kraken OAuth error: ${error}`);
      }

      if (!code) {
        throw new Error('No authorization code received from Kraken');
      }

      setMessage('Exchanging authorization code for access token...');

      // Import krakenService to use the OAuth flow
      const { krakenService } = await import('@/lib/services/krakenService');
      
      // Exchange code for access token
      const tokenData = await krakenService.exchangeCodeForToken(code, state || '');
      
      setMessage('Saving Kraken connection...');

      // Save connection to database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const connectionResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exchange-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          exchange: 'kraken',
          credentials: {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
            token_type: 'bearer'
          },
          userId: user.id,
        })
      });

      const connectionResult = await connectionResponse.json();

      if (!connectionResponse.ok || !connectionResult.success) {
        throw new Error(connectionResult.error || 'Failed to save Kraken connection');
      }

      setConnectionId(connectionResult.connectionId);
      setMessage('Starting trade synchronization...');

      // Start trade sync
      const syncResult = await syncService.syncTrades(connectionResult.connectionId, 'historical');
      
      if (syncResult.success) {
        setStatus('success');
        setMessage(`Successfully connected to Kraken and synced ${syncResult.tradesSynced || 0} trades!`);
        
        toast({
          title: "Kraken Connected",
          description: `Successfully synced ${syncResult.tradesSynced || 0} trades from Kraken.`,
        });
      } else {
        setStatus('success');
        setMessage('Connected to Kraken but sync failed. You can retry later.');
        
        toast({
          title: "Kraken Connected",
          description: "Connected to Kraken but sync failed. You can retry later.",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Kraken callback error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to connect to Kraken');
      
      toast({
        title: "Connection Failed",
        description: error.message || 'Failed to connect to Kraken',
        variant: "destructive"
      });
    }
  };

  const handleContinue = () => {
    navigate('/app/trades');
  };

  const handleRetry = () => {
    navigate('/app/trades');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
            {status === 'loading' && <Loader2 className="h-8 w-8 text-orange-600 animate-spin" />}
            {status === 'success' && <CheckCircle className="h-8 w-8 text-green-600" />}
            {status === 'error' && <XCircle className="h-8 w-8 text-red-600" />}
          </div>
          <CardTitle className="text-xl">
            {status === 'loading' && 'Connecting to Kraken...'}
            {status === 'success' && 'Kraken Connected!'}
            {status === 'error' && 'Connection Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600 dark:text-gray-400">
            {message}
          </p>
          
          {status === 'success' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>API credentials validated</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Connection saved to database</span>
              </div>
              {connectionId && (
                <div className="flex items-center justify-center space-x-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Trade sync initiated</span>
                </div>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2 text-sm text-red-600">
                <XCircle className="h-4 w-4" />
                <span>API validation failed</span>
              </div>
              <div className="text-center text-sm text-gray-500">
                Please check your Kraken API credentials and try again.
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            {status === 'success' && (
              <Button onClick={handleContinue} className="flex-1">
                Continue to Trades
              </Button>
            )}
            {status === 'error' && (
              <Button onClick={handleRetry} variant="outline" className="flex-1">
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => window.open('https://kraken.com', '_blank')}
              className="flex items-center space-x-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Kraken</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
