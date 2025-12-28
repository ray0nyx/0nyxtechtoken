import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cryptoSyncService } from '@/lib/services/cryptoSyncService';
import { credentialService } from '@/lib/services/credentialService';

interface ExchangeConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionAdded?: (connectionId: string) => void;
  preselectedExchange?: string;
}

const SUPPORTED_EXCHANGES = [
  { id: 'binance', name: 'Binance', description: 'World\'s largest crypto exchange' },
  { id: 'coinbase', name: 'Coinbase Pro', description: 'US-based regulated exchange' },
  { id: 'kraken', name: 'Kraken', description: 'Established European exchange' },
  { id: 'kucoin', name: 'KuCoin', description: 'Global crypto exchange' },
  { id: 'bybit', name: 'Bybit', description: 'Derivatives trading platform' },
  { id: 'okx', name: 'OKX', description: 'Global crypto exchange' },
  { id: 'bitget', name: 'Bitget', description: 'Social trading platform' },
  { id: 'huobi', name: 'Huobi', description: 'Global digital asset exchange' },
  { id: 'gateio', name: 'Gate.io', description: 'International crypto exchange' },
  { id: 'mexc', name: 'MEXC', description: 'Global digital asset exchange' },
];

export function ExchangeConnectionModal({ isOpen, onClose, onConnectionAdded, preselectedExchange }: ExchangeConnectionModalProps) {
  const [selectedExchange, setSelectedExchange] = useState(preselectedExchange || '');
  const [credentials, setCredentials] = useState({
    apiKey: '',
    secret: '',
    passphrase: '',
    sandbox: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Update selected exchange when preselectedExchange changes
  React.useEffect(() => {
    if (preselectedExchange) {
      setSelectedExchange(preselectedExchange);
    }
  }, [preselectedExchange]);

  const handleConnect = async () => {
    if (!selectedExchange || !credentials.apiKey || !credentials.secret) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Store credentials using the credential service
      const connectionId = await credentialService.storeCredentials(
        selectedExchange,
        credentials,
        'api_key'
      );

      // Test connection
      const connected = await cryptoSyncService.connectExchange(connectionId);
      
      if (connected) {
        setSuccess(true);
        onConnectionAdded?.(connectionId);
        
        // Reset form after success
        setTimeout(() => {
          setSuccess(false);
          setCredentials({ apiKey: '', secret: '', passphrase: '', sandbox: false });
          setSelectedExchange('');
          onClose();
        }, 2000);
      } else {
        setError('Failed to connect to exchange. Please check your credentials.');
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to exchange');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError('');
      setSuccess(false);
      setCredentials({ apiKey: '', secret: '', passphrase: '', sandbox: false });
      setSelectedExchange('');
      onClose();
    }
  };

  const selectedExchangeInfo = SUPPORTED_EXCHANGES.find(ex => ex.id === selectedExchange);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Exchange</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Exchange Selection */}
          <div className="space-y-2">
            <Label htmlFor="exchange">Exchange</Label>
            <Select value={selectedExchange} onValueChange={setSelectedExchange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an exchange" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_EXCHANGES.map((exchange) => (
                  <SelectItem key={exchange.id} value={exchange.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{exchange.name}</span>
                      <span className="text-sm text-muted-foreground">{exchange.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedExchangeInfo && (
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium text-sm">{selectedExchangeInfo.name}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedExchangeInfo.description}
              </p>
            </div>
          )}

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your API key"
              value={credentials.apiKey}
              onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
              disabled={isLoading}
            />
          </div>

          {/* Secret Key */}
          <div className="space-y-2">
            <Label htmlFor="secret">Secret Key *</Label>
            <Input
              id="secret"
              type="password"
              placeholder="Enter your secret key"
              value={credentials.secret}
              onChange={(e) => setCredentials(prev => ({ ...prev, secret: e.target.value }))}
              disabled={isLoading}
            />
          </div>

          {/* Passphrase (for some exchanges) */}
          {(selectedExchange === 'coinbase' || selectedExchange === 'okx') && (
            <div className="space-y-2">
              <Label htmlFor="passphrase">Passphrase</Label>
              <Input
                id="passphrase"
                type="password"
                placeholder="Enter your passphrase"
                value={credentials.passphrase}
                onChange={(e) => setCredentials(prev => ({ ...prev, passphrase: e.target.value }))}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Sandbox Mode */}
          <div className="flex items-center space-x-2">
            <Switch
              id="sandbox"
              checked={credentials.sandbox}
              onCheckedChange={(checked) => setCredentials(prev => ({ ...prev, sandbox: checked }))}
              disabled={isLoading}
            />
            <Label htmlFor="sandbox">Use sandbox/testnet</Label>
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
                Successfully connected to {selectedExchangeInfo?.name}!
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={isLoading || !selectedExchange || !credentials.apiKey || !credentials.secret}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
