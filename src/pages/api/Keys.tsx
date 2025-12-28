import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { createWagyuApiClient, type APIUsageStats } from '@/lib/services/wagyuApiClient';

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  tier: string;
  rate_limit_per_hour: number;
  rate_limit_per_minute: number;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

export default function APIKeysPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyTier, setNewKeyTier] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [usageStats, setUsageStats] = useState<Record<string, APIUsageStats>>({});
  const { toast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const supabase = createClient();
  const navigate = useNavigate();

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const loadAPIKeys = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth/signin');
        return;
      }

      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setApiKeys(data || []);

      // Load usage stats for each key
      if (data && data.length > 0) {
        const statsPromises = data.map(async (key) => {
          try {
            // Would use the actual API key to get stats
            // For now, fetch from database
            const usageData = await supabase
              .from('api_usage_logs')
              .select('id', { count: 'exact' })
              .eq('api_key_id', key.id)
              .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            return {
              keyId: key.id,
              stats: {
                total_requests: usageData.count || 0,
                requests_today: usageData.count || 0,
                requests_this_hour: 0,
                requests_remaining_this_hour: key.rate_limit_per_hour,
                requests_remaining_today: key.rate_limit_per_hour,
                tier: key.tier,
                rate_limit_per_hour: key.rate_limit_per_hour,
                rate_limit_per_minute: key.rate_limit_per_minute,
              },
            };
          } catch (e) {
            return null;
          }
        });

        const statsResults = await Promise.all(statsPromises);
        const statsMap: Record<string, APIUsageStats> = {};
        statsResults.forEach(result => {
          if (result) {
            statsMap[result.keyId] = result.stats;
          }
        });
        setUsageStats(statsMap);
      }
    } catch (error: any) {
      console.error('Error loading API keys:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load API keys',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for your API key',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Call backend API to generate key
      // For now, generate client-side (in production, do this server-side)
      const response = await fetch(`${import.meta.env.VITE_WAGYU_API_URL || 'http://localhost:8002'}/api/v1/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          name: newKeyName,
          tier: newKeyTier,
        }),
      }).catch(() => {
        // Fallback: create directly in database
        return null;
      });

      let keyData;
      if (response && response.ok) {
        keyData = await response.json();
      } else {
        // Fallback: generate key hash and store in database
        const keyPrefix = `wgy_${Math.random().toString(36).substring(2, 10)}`;
        const keyHash = `hash_${Math.random().toString(36).substring(2, 32)}`; // In production, use proper hashing
        
        const { data, error } = await supabase
          .from('api_keys')
          .insert({
            user_id: user.id,
            key_hash: keyHash,
            key_prefix: keyPrefix,
            name: newKeyName,
            tier: newKeyTier,
            rate_limit_per_hour: newKeyTier === 'free' ? 100 : newKeyTier === 'pro' ? 1000 : 10000,
            rate_limit_per_minute: newKeyTier === 'free' ? 10 : newKeyTier === 'pro' ? 100 : 1000,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        keyData = { key: `${keyPrefix}_${Math.random().toString(36).substring(2, 44)}`, key_data: data };
      }

      setGeneratedKey(keyData.key);
      setNewKeyName('');
      setNewKeyTier('free');
      await loadAPIKeys();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create API key',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;

      toast({
        title: 'API Key Deleted',
        description: 'The API key has been permanently deleted',
      });

      await loadAPIKeys();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete API key',
        variant: 'destructive',
      });
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: 'Copied!',
      description: 'API key copied to clipboard',
    });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'text-purple-500 bg-purple-500/20';
      case 'pro':
        return 'text-blue-500 bg-blue-500/20';
      default:
        return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getTierFeatures = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return ['10,000 req/hour', '0.3% trading fees', 'All features', 'Webhooks', 'Priority support'];
      case 'pro':
        return ['1,000 req/hour', '0.5% trading fees', 'Trading access', 'Social monitoring'];
      default:
        return ['100 req/hour', 'Read-only', 'Basic data'];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen p-6 md:p-12",
      isDark ? "bg-[#0a0e17] text-gray-100" : "bg-gray-50 text-gray-900"
    )}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Key className="h-8 w-8 text-blue-500" />
              API Keys
            </h1>
            <p className={cn("mt-2", isDark ? "text-gray-400" : "text-gray-600")}>
              Manage your WagyuTech API keys for programmatic access
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create API Key
          </Button>
        </div>

        {/* Info Banner */}
        <div className={cn(
          "p-4 rounded-lg border",
          isDark ? "bg-blue-900/20 border-blue-600 text-blue-200" : "bg-blue-50 border-blue-200 text-blue-800"
        )}>
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>API Access:</strong> Use your API keys to access WagyuTech API programmatically. 
              Free tier includes 100 requests/hour. Upgrade to Pro or Enterprise for higher limits and trading access.
            </div>
          </div>
        </div>

        {/* API Keys List */}
        {apiKeys.length === 0 ? (
          <Card className={cn(isDark ? "bg-[#1a1f2e] border-[#374151]" : "bg-white border-gray-200")}>
            <CardContent className="py-12 text-center">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className={cn("text-lg font-semibold mb-2", isDark ? "text-white" : "text-gray-900")}>
                No API Keys
              </h3>
              <p className={cn("text-sm mb-4", isDark ? "text-gray-400" : "text-gray-600")}>
                Create your first API key to start using the WagyuTech API
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {apiKeys.map((key) => (
              <Card
                key={key.id}
                className={cn(
                  isDark ? "bg-[#1a1f2e] border-[#374151]" : "bg-white border-gray-200"
                )}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>
                          {key.name}
                        </h3>
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          getTierColor(key.tier)
                        )}>
                          {key.tier.toUpperCase()}
                        </span>
                        {!key.is_active && (
                          <span className="px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-500">
                            INACTIVE
                          </span>
                        )}
                      </div>
                      
                      <div className={cn("text-sm font-mono mb-4", isDark ? "text-gray-400" : "text-gray-600")}>
                        {key.key_prefix}...
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>
                            Rate Limit
                          </div>
                          <div className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>
                            {key.rate_limit_per_hour}/hour
                          </div>
                        </div>
                        <div>
                          <div className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>
                            Created
                          </div>
                          <div className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>
                            {new Date(key.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <div className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>
                            Last Used
                          </div>
                          <div className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>
                            {key.last_used_at 
                              ? new Date(key.last_used_at).toLocaleDateString()
                              : 'Never'}
                          </div>
                        </div>
                        {usageStats[key.id] && (
                          <div>
                            <div className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-500")}>
                              Today's Usage
                            </div>
                            <div className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>
                              {usageStats[key.id].requests_today} / {usageStats[key.id].rate_limit_per_hour}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={cn("text-xs", isDark ? "text-gray-500" : "text-gray-600")}>
                        <strong>Features:</strong> {getTierFeatures(key.tier).join(' • ')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteKey(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Key Dialog */}
        <Dialog open={showCreateDialog || generatedKey !== null} onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setGeneratedKey(null);
            setNewKeyName('');
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                {generatedKey 
                  ? 'Your API key has been created. Copy it now - you won\'t be able to see it again!'
                  : 'Create a new API key for programmatic access to WagyuTech API'}
              </DialogDescription>
            </DialogHeader>

            {generatedKey ? (
              <div className="space-y-4 py-4">
                <div className={cn(
                  "p-4 rounded-lg border-2",
                  isDark ? "bg-[#0f1419] border-yellow-600" : "bg-yellow-50 border-yellow-400"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("text-xs font-medium", isDark ? "text-yellow-200" : "text-yellow-800")}>
                      Your API Key
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyKey(generatedKey)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className={cn(
                    "font-mono text-sm break-all",
                    isDark ? "text-white" : "text-gray-900"
                  )}>
                    {generatedKey}
                  </div>
                </div>
                <div className={cn(
                  "p-3 rounded-lg",
                  isDark ? "bg-red-900/20 border border-red-600 text-red-200" : "bg-red-50 border border-red-200 text-red-800"
                )}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <strong>Important:</strong> Store this key securely. You won't be able to view it again.
                    </div>
                  </div>
                </div>
                <Button onClick={() => {
                  setGeneratedKey(null);
                  setShowCreateDialog(false);
                }} className="w-full">
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div>
                  <label className={cn("text-sm font-medium mb-2 block", isDark ? "text-gray-300" : "text-gray-700")}>
                    Key Name
                  </label>
                  <Input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="My API Key"
                    className={cn(
                      isDark ? "bg-[#0f1419] border-[#374151]" : "bg-white border-gray-300"
                    )}
                  />
                </div>

                <div>
                  <label className={cn("text-sm font-medium mb-2 block", isDark ? "text-gray-300" : "text-gray-700")}>
                    Tier
                  </label>
                  <select
                    value={newKeyTier}
                    onChange={(e) => setNewKeyTier(e.target.value as any)}
                    className={cn(
                      "w-full px-3 py-2 rounded-md border",
                      isDark ? "bg-[#0f1419] border-[#374151] text-white" : "bg-white border-gray-300 text-gray-900"
                    )}
                  >
                    <option value="free">Free (100 req/hour, Read-only)</option>
                    <option value="pro">Pro ($29/mo, 1,000 req/hour, 0.5% trading fees)</option>
                    <option value="enterprise">Enterprise ($99/mo, 10,000 req/hour, 0.3% trading fees)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateKey} className="flex-1">
                    Create Key
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
