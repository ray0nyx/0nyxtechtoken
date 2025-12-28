import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, TrendingUp, TrendingDown, AlertCircle, Target, Shield, Clock } from 'lucide-react';
import { MarketplaceService } from '@/services/marketplaceService';
import { useToast } from '@/components/ui/use-toast';

interface SignalBroadcasterProps {
  onSignalSent?: () => void;
}

export default function SignalBroadcaster({ onSignalSent }: SignalBroadcasterProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [signalData, setSignalData] = useState({
    symbol: '',
    signal_type: 'buy' as 'buy' | 'sell' | 'hold' | 'alert',
    entry_price: '',
    stop_loss: '',
    take_profit: '',
    timeframe: '',
    reasoning: '',
    risk_level: 'medium' as 'low' | 'medium' | 'high' | 'very_high',
    confidence_score: 5,
    tags: [] as string[],
    is_public: false,
    expires_at: ''
  });
  const [newTag, setNewTag] = useState('');

  const handleInputChange = (field: string, value: any) => {
    setSignalData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    if (newTag.trim() && !signalData.tags.includes(newTag.trim())) {
      setSignalData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSignalData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signalData.symbol || !signalData.reasoning) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      
      const signalPayload = {
        ...signalData,
        entry_price: signalData.entry_price ? parseFloat(signalData.entry_price) : undefined,
        stop_loss: signalData.stop_loss ? parseFloat(signalData.stop_loss) : undefined,
        take_profit: signalData.take_profit ? parseFloat(signalData.take_profit) : undefined,
        confidence_score: signalData.confidence_score,
        expires_at: signalData.expires_at || undefined
      };

      await MarketplaceService.createSignal(signalPayload);
      
      toast({
        title: 'Success',
        description: 'Signal broadcasted successfully!',
      });
      
      // Reset form
      setSignalData({
        symbol: '',
        signal_type: 'buy',
        entry_price: '',
        stop_loss: '',
        take_profit: '',
        timeframe: '',
        reasoning: '',
        risk_level: 'medium',
        confidence_score: 5,
        tags: [],
        is_public: false,
        expires_at: ''
      });
      
      onSignalSent?.();
    } catch (error: any) {
      console.error('Error broadcasting signal:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to broadcast signal',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getSignalIcon = (type: string) => {
    switch (type) {
      case 'buy': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'sell': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'alert': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'very_high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bell className="h-5 w-5" />
          <span>Broadcast Trading Signal</span>
        </CardTitle>
        <CardDescription>
          Share trading signals with your subscribers. Remember: signals are for informational purposes only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Signal Details</TabsTrigger>
              <TabsTrigger value="risk">Risk & Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="symbol">Symbol *</Label>
                  <Input
                    id="symbol"
                    value={signalData.symbol}
                    onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                    placeholder="e.g., AAPL, BTCUSD, EURUSD"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signalType">Signal Type *</Label>
                  <Select value={signalData.signal_type} onValueChange={(value: any) => handleInputChange('signal_type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">
                        <div className="flex items-center space-x-2">
                          {getSignalIcon('buy')}
                          <span>Buy</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="sell">
                        <div className="flex items-center space-x-2">
                          {getSignalIcon('sell')}
                          <span>Sell</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="hold">
                        <div className="flex items-center space-x-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span>Hold</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="alert">
                        <div className="flex items-center space-x-2">
                          {getSignalIcon('alert')}
                          <span>Alert</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="entryPrice">Entry Price</Label>
                  <Input
                    id="entryPrice"
                    type="number"
                    step="0.000001"
                    value={signalData.entry_price}
                    onChange={(e) => handleInputChange('entry_price', e.target.value)}
                    placeholder="0.000000"
                  />
                </div>
                <div>
                  <Label htmlFor="stopLoss">Stop Loss</Label>
                  <Input
                    id="stopLoss"
                    type="number"
                    step="0.000001"
                    value={signalData.stop_loss}
                    onChange={(e) => handleInputChange('stop_loss', e.target.value)}
                    placeholder="0.000000"
                  />
                </div>
                <div>
                  <Label htmlFor="takeProfit">Take Profit</Label>
                  <Input
                    id="takeProfit"
                    type="number"
                    step="0.000001"
                    value={signalData.take_profit}
                    onChange={(e) => handleInputChange('take_profit', e.target.value)}
                    placeholder="0.000000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timeframe">Timeframe</Label>
                  <Select value={signalData.timeframe} onValueChange={(value) => handleInputChange('timeframe', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1m">1 Minute</SelectItem>
                      <SelectItem value="5m">5 Minutes</SelectItem>
                      <SelectItem value="15m">15 Minutes</SelectItem>
                      <SelectItem value="1h">1 Hour</SelectItem>
                      <SelectItem value="4h">4 Hours</SelectItem>
                      <SelectItem value="1d">1 Day</SelectItem>
                      <SelectItem value="1w">1 Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="expiresAt">Expires At (Optional)</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={signalData.expires_at}
                    onChange={(e) => handleInputChange('expires_at', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="reasoning">Reasoning *</Label>
                <Textarea
                  id="reasoning"
                  value={signalData.reasoning}
                  onChange={(e) => handleInputChange('reasoning', e.target.value)}
                  placeholder="Explain your analysis and reasoning for this signal..."
                  rows={4}
                  required
                />
              </div>

              <div>
                <Label htmlFor="tags">Tags</Label>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add a tag"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <Button type="button" onClick={addTag} size="sm">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {signalData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-red-500"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="risk" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="riskLevel">Risk Level</Label>
                  <Select value={signalData.risk_level} onValueChange={(value: any) => handleInputChange('risk_level', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                      <SelectItem value="very_high">Very High Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="confidence">Confidence Score (1-10)</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="confidence"
                      type="range"
                      min="1"
                      max="10"
                      value={signalData.confidence_score}
                      onChange={(e) => handleInputChange('confidence_score', parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-8">{signalData.confidence_score}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={signalData.is_public}
                  onChange={(e) => handleInputChange('is_public', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="isPublic">Make this signal public (visible to all users)</Label>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Risk Warning:</strong> This signal is for informational purposes only and does not constitute investment advice. 
                  Past performance does not guarantee future results. Trading involves substantial risk of loss.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Badge className={getRiskColor(signalData.risk_level)}>
                {signalData.risk_level.replace('_', ' ').toUpperCase()} RISK
              </Badge>
              <Badge variant="outline">
                Confidence: {signalData.confidence_score}/10
              </Badge>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Broadcasting...' : 'Broadcast Signal'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
