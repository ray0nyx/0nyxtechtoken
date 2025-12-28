/**
 * Exchange Linking Component
 * Manage exchange connections for copy trading
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { 
  Link, 
  Unlink, 
  Eye, 
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Shield,
  Key
} from 'lucide-react';

interface ExchangeConnection {
  id: string;
  exchange_name: string;
  is_active: boolean;
  last_sync_at: string;
}

interface ExchangeLinkingProps {
  exchanges: ExchangeConnection[];
  onExchangeLinked: (exchange: ExchangeConnection) => void;
  onRefresh: () => void;
}

export function ExchangeLinking({ exchanges, onExchangeLinked, onRefresh }: ExchangeLinkingProps) {
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('api-keys');
  const [isLinking, setIsLinking] = useState(false);
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  
  const [credentials, setCredentials] = useState({
    exchange: '',
    apiKey: '',
    apiSecret: '',
    passphrase: '',
    sandbox: true
  });
  
  const supportedExchanges = [
    { id: 'binance', name: 'Binance', icon: '🟡', oauth: false },
    { id: 'coinbase', name: 'Coinbase Pro', icon: '🔵', oauth: true },
    { id: 'kraken', name: 'Kraken', icon: '🟣', oauth: false },
    { id: 'bybit', name: 'Bybit', icon: '🟠', oauth: false },
    { id: 'okx', name: 'OKX', icon: '⚫', oauth: false }
  ];
  
  const handleInputChange = (field: string, value: string | boolean) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleLinkExchange = async () => {
    if (!credentials.exchange || !credentials.apiKey || !credentials.apiSecret) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }
    
    setIsLinking(true);
    
    try {
      const response = await fetch('/api/institutional/exchanges/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        throw new Error('Failed to link exchange');
      }
      
      const result = await response.json();
      
      onExchangeLinked({
        id: result.id,
        exchange_name: credentials.exchange,
        is_active: true,
        last_sync_at: new Date().toISOString()
      });
      
      // Reset form
      setCredentials({
        exchange: '',
        apiKey: '',
        apiSecret: '',
        passphrase: '',
        sandbox: true
      });
      
      toast({
        title: 'Exchange Linked',
        description: `Successfully connected to ${credentials.exchange}.`,
      });
      
    } catch (error) {
      console.error('Error linking exchange:', error);
      toast({
        title: 'Error',
        description: 'Failed to link exchange. Please check your credentials.',
        variant: 'destructive'
      });
    } finally {
      setIsLinking(false);
    }
  };
  
  const handleUnlinkExchange = async (exchangeId: string) => {
    try {
      const response = await fetch(`/api/institutional/exchanges/${exchangeId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to unlink exchange');
      }
      
      toast({
        title: 'Exchange Unlinked',
        description: 'Exchange has been disconnected successfully.',
      });
      
      onRefresh();
    } catch (error) {
      console.error('Error unlinking exchange:', error);
      toast({
        title: 'Error',
        description: 'Failed to unlink exchange. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  const handleTestConnection = async (exchangeId: string) => {
    try {
      const response = await fetch(`/api/institutional/exchanges/${exchangeId}/test`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Connection test failed');
      }
      
      toast({
        title: 'Connection Test Successful',
        description: 'Exchange connection is working properly.',
      });
      
    } catch (error) {
      console.error('Error testing connection:', error);
      toast({
        title: 'Connection Test Failed',
        description: 'Please check your exchange credentials.',
        variant: 'destructive'
      });
    }
  };
  
  const toggleSecretVisibility = (exchangeId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [exchangeId]: !prev[exchangeId]
    }));
  };
  
  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };
  
  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-red-100 text-red-700 border-red-200';
  };
  
  const formatLastSync = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Exchange Linking
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your exchange accounts for copy trading and data access
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="api-keys" className="flex items-center space-x-2">
            <Key className="w-4 h-4" />
            <span>API Keys</span>
          </TabsTrigger>
          <TabsTrigger value="oauth" className="flex items-center space-x-2">
            <ExternalLink className="w-4 h-4" />
            <span>OAuth</span>
          </TabsTrigger>
        </TabsList>
        
        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Link New Exchange */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Link className="w-5 h-5 text-cyan-600" />
                  <span>Link New Exchange</span>
                </CardTitle>
                <CardDescription>
                  Connect a new exchange using API keys
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="exchange">Exchange</Label>
                  <select
                    id="exchange"
                    value={credentials.exchange}
                    onChange={(e) => handleInputChange('exchange', e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">Select an exchange</option>
                    {supportedExchanges.map((exchange) => (
                      <option key={exchange.id} value={exchange.id}>
                        {exchange.icon} {exchange.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="text"
                    value={credentials.apiKey}
                    onChange={(e) => handleInputChange('apiKey', e.target.value)}
                    placeholder="Enter your API key"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="apiSecret">API Secret</Label>
                  <div className="relative mt-1">
                    <Input
                      id="apiSecret"
                      type={showSecrets['new'] ? 'text' : 'password'}
                      value={credentials.apiSecret}
                      onChange={(e) => handleInputChange('apiSecret', e.target.value)}
                      placeholder="Enter your API secret"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecretVisibility('new')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecrets['new'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                {credentials.exchange === 'coinbase' && (
                  <div>
                    <Label htmlFor="passphrase">Passphrase</Label>
                    <Input
                      id="passphrase"
                      type="text"
                      value={credentials.passphrase}
                      onChange={(e) => handleInputChange('passphrase', e.target.value)}
                      placeholder="Enter your passphrase"
                      className="mt-1"
                    />
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="sandbox"
                    checked={credentials.sandbox}
                    onChange={(e) => handleInputChange('sandbox', e.target.checked)}
                    className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <Label htmlFor="sandbox" className="text-sm">
                    Use sandbox/testnet (recommended for testing)
                  </Label>
                </div>
                
                <Button
                  onClick={handleLinkExchange}
                  disabled={isLinking}
                  className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white border-0"
                >
                  {isLinking ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Linking...
                    </>
                  ) : (
                    <>
                      <Link className="w-4 h-4 mr-2" />
                      Link Exchange
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
            
            {/* Connected Exchanges */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-cyan-600" />
                  <span>Connected Exchanges</span>
                </CardTitle>
                <CardDescription>
                  Manage your connected exchange accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {exchanges.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No Exchanges Connected
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Link your first exchange to get started with copy trading.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exchanges.map((exchange) => (
                      <div
                        key={exchange.id}
                        className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-900 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(exchange.is_active)}
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                              {exchange.exchange_name}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Last sync: {formatLastSync(exchange.last_sync_at)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(exchange.is_active)}>
                            {exchange.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(exchange.id)}
                            className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                          >
                            Test
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnlinkExchange(exchange.id)}
                            className="border-red-200 text-red-700 hover:bg-red-50"
                          >
                            <Unlink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* OAuth Tab */}
        <TabsContent value="oauth" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ExternalLink className="w-5 h-5 text-cyan-600" />
                <span>OAuth Integration</span>
              </CardTitle>
              <CardDescription>
                Connect exchanges using OAuth for enhanced security
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {supportedExchanges.filter(ex => ex.oauth).map((exchange) => (
                  <div
                    key={exchange.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-900 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{exchange.icon}</span>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {exchange.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          OAuth integration available
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Connect with OAuth
                    </Button>
                  </div>
                ))}
                
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    OAuth Benefits
                  </h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Enhanced security with token-based authentication</li>
                    <li>• No need to store API keys in our system</li>
                    <li>• Automatic token refresh</li>
                    <li>• Revocable access permissions</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
