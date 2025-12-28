import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Edit, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  createPriceAlert,
  getUserPriceAlerts,
  updatePriceAlert,
  deletePriceAlert,
  type PriceAlert,
} from '@/lib/price-alert-service';

interface PriceAlertsProps {
  pairSymbol: string;
  currentPrice: number;
  theme?: 'dark' | 'light';
}

export default function PriceAlerts({ pairSymbol, currentPrice, theme = 'dark' }: PriceAlertsProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  const { toast } = useToast();
  const isDark = theme === 'dark';

  const [formData, setFormData] = useState({
    alertType: 'above' as 'above' | 'below',
    thresholdPrice: '',
  });

  useEffect(() => {
    loadAlerts();
  }, [pairSymbol]);

  // Check for triggered alerts
  useEffect(() => {
    alerts.forEach(alert => {
      if (alert.is_active && !alert.triggered_at) {
        const shouldTrigger = alert.alert_type === 'above' 
          ? currentPrice >= alert.threshold_price
          : currentPrice <= alert.threshold_price;
        
        if (shouldTrigger) {
          handleAlertTriggered(alert);
        }
      }
    });
  }, [currentPrice, alerts]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const userAlerts = await getUserPriceAlerts();
      // Filter alerts for current pair
      const pairAlerts = userAlerts.filter(a => a.pair_symbol === pairSymbol);
      setAlerts(pairAlerts);
    } catch (error: any) {
      console.error('Error loading alerts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load price alerts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    if (!formData.thresholdPrice || parseFloat(formData.thresholdPrice) <= 0) {
      toast({
        title: 'Invalid Price',
        description: 'Please enter a valid threshold price',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createPriceAlert(
        pairSymbol,
        formData.alertType,
        parseFloat(formData.thresholdPrice)
      );
      toast({
        title: 'Alert Created',
        description: `Price alert set for ${pairSymbol}`,
      });
      setShowCreateDialog(false);
      setFormData({ alertType: 'above', thresholdPrice: '' });
      loadAlerts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create alert',
        variant: 'destructive',
      });
    }
  };

  const handleEditAlert = async (alert: PriceAlert) => {
    if (!formData.thresholdPrice || parseFloat(formData.thresholdPrice) <= 0) {
      toast({
        title: 'Invalid Price',
        description: 'Please enter a valid threshold price',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updatePriceAlert(alert.id, {
        threshold_price: parseFloat(formData.thresholdPrice),
        alert_type: formData.alertType,
      });
      toast({
        title: 'Alert Updated',
        description: 'Price alert has been updated',
      });
      setEditingAlert(null);
      setFormData({ alertType: 'above', thresholdPrice: '' });
      loadAlerts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update alert',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await deletePriceAlert(alertId);
      toast({
        title: 'Alert Deleted',
        description: 'Price alert has been removed',
      });
      loadAlerts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete alert',
        variant: 'destructive',
      });
    }
  };

  const handleAlertTriggered = async (alert: PriceAlert) => {
    try {
      await updatePriceAlert(alert.id, {
        is_active: false,
      });
      
      // Update triggered_at timestamp
      const supabase = (await import('@/lib/supabase/client')).createClient();
      await supabase
        .from('price_alerts')
        .update({ triggered_at: new Date().toISOString() })
        .eq('id', alert.id);

      toast({
        title: 'Price Alert Triggered!',
        description: `${pairSymbol} reached ${alert.alert_type === 'above' ? 'above' : 'below'} ${alert.threshold_price}`,
      });

      loadAlerts();
    } catch (error) {
      console.error('Error handling triggered alert:', error);
    }
  };

  const openEditDialog = (alert: PriceAlert) => {
    setEditingAlert(alert);
    setFormData({
      alertType: alert.alert_type,
      thresholdPrice: alert.threshold_price.toString(),
    });
  };

  return (
    <div className={cn(
      "space-y-4",
      isDark ? "text-white" : "text-gray-900"
    )}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Price Alerts
        </h3>
        <Button
          size="sm"
          onClick={() => {
            setFormData({ alertType: 'above', thresholdPrice: '' });
            setShowCreateDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Alert
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      ) : alerts.length === 0 ? (
        <div className={cn(
          "text-center py-8 rounded-lg border",
          isDark ? "bg-[#1a1f2e] border-[#374151] text-gray-400" : "bg-gray-50 border-gray-200 text-gray-500"
        )}>
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No price alerts set</p>
          <p className="text-xs mt-1">Create an alert to get notified when price reaches your target</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={cn(
                "p-3 rounded-lg border flex items-center justify-between",
                isDark 
                  ? "bg-[#1a1f2e] border-[#374151]" 
                  : "bg-white border-gray-200"
              )}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium",
                    alert.alert_type === 'above' ? "text-green-500" : "text-red-500"
                  )}>
                    {alert.alert_type === 'above' ? '↑' : '↓'}
                  </span>
                  <span className="text-sm font-semibold">{pairSymbol}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Alert when price is {alert.alert_type === 'above' ? 'above' : 'below'} {alert.threshold_price}
                </div>
                {alert.triggered_at && (
                  <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Triggered
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!alert.triggered_at && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(alert)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteAlert(alert.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || editingAlert !== null} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingAlert(null);
          setFormData({ alertType: 'above', thresholdPrice: '' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAlert ? 'Edit Price Alert' : 'Create Price Alert'}
            </DialogTitle>
            <DialogDescription>
              Get notified when {pairSymbol} reaches your target price
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Alert Type</label>
              <Select
                value={formData.alertType}
                onValueChange={(value: 'above' | 'below') => 
                  setFormData(prev => ({ ...prev, alertType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Price goes above</SelectItem>
                  <SelectItem value="below">Price goes below</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Threshold Price</label>
              <Input
                type="number"
                step="any"
                value={formData.thresholdPrice}
                onChange={(e) => setFormData(prev => ({ ...prev, thresholdPrice: e.target.value }))}
                placeholder="Enter price threshold"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingAlert(null);
                  setFormData({ alertType: 'above', thresholdPrice: '' });
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => editingAlert ? handleEditAlert(editingAlert) : handleCreateAlert()}
                className="flex-1"
              >
                {editingAlert ? 'Update' : 'Create'} Alert
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
