import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface TradingFee {
  id: string;
  trade_id: string;
  fee_type: 'commission' | 'exchange_fee' | 'regulatory_fee' | 'other';
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  fees: number;
  date: string;
}

interface TradingFeesManagerProps {
  tradeId?: string;
  onFeesUpdated?: () => void;
}

export function TradingFeesManager({ tradeId, onFeesUpdated }: TradingFeesManagerProps) {
  const [fees, setFees] = useState<TradingFee[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<TradingFee | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState(tradeId || '');
  const { toast } = useToast();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    fee_type: 'commission' as const,
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, [tradeId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load trades
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('id, symbol, side, quantity, entry_price, exit_price, pnl, fees, date')
        .order('date', { ascending: false })
        .limit(100);

      if (tradesError) throw tradesError;
      setTrades(tradesData || []);

      // Load fees
      let feesQuery = supabase
        .from('trading_fees')
        .select('*')
        .order('date', { ascending: false });

      if (tradeId) {
        feesQuery = feesQuery.eq('trade_id', tradeId);
      }

      const { data: feesData, error: feesError } = await feesQuery;

      if (feesError) throw feesError;
      setFees(feesData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load trading data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTradeId) {
      toast({
        title: "Error",
        description: "Please select a trade",
        variant: "destructive",
      });
      return;
    }

    if (!formData.amount || isNaN(parseFloat(formData.amount))) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const feeData = {
        user_id: user.id,
        trade_id: selectedTradeId,
        fee_type: formData.fee_type,
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: formData.date,
      };

      console.log('TradingFeesManager: Submitting fee data:', feeData);

      if (editingFee) {
        const { error } = await supabase
          .from('trading_fees')
          .update(feeData)
          .eq('id', editingFee.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Trading fee updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('trading_fees')
          .insert([feeData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Trading fee added successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingFee(null);
      resetForm();
      loadData();
      onFeesUpdated?.();

    } catch (error) {
      console.error('Error saving fee:', error);
      console.error('Error details:', {
        error,
        feeData,
        selectedTradeId,
        formData
      });

      let errorMessage = "Failed to save trading fee";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (fee: TradingFee) => {
    setEditingFee(fee);
    setSelectedTradeId(fee.trade_id);
    setFormData({
      fee_type: fee.fee_type,
      amount: fee.amount.toString(),
      description: fee.description,
      date: fee.date,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (feeId: string) => {
    if (!confirm('Are you sure you want to delete this fee?')) return;

    try {
      const { error } = await supabase
        .from('trading_fees')
        .delete()
        .eq('id', feeId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Trading fee deleted successfully",
      });

      loadData();
      onFeesUpdated?.();

    } catch (error) {
      console.error('Error deleting fee:', error);
      toast({
        title: "Error",
        description: "Failed to delete trading fee",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      fee_type: 'commission',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
    setSelectedTradeId(tradeId || '');
  };

  const getFeeTypeColor = (type: string) => {
    switch (type) {
      case 'commission': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'exchange_fee': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      case 'regulatory_fee': return 'bg-gray-300 text-gray-300 dark:bg-gray-300/20 dark:text-gray-300';
      case 'other': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getTotalFees = () => {
    return fees.reduce((sum, fee) => sum + fee.amount, 0);
  };

  const getFeesByType = () => {
    const breakdown = fees.reduce((acc, fee) => {
      acc[fee.fee_type] = (acc[fee.fee_type] || 0) + fee.amount;
      return acc;
    }, {} as Record<string, number>);
    return breakdown;
  };

  if (loading) {
    return (
      <Card className="!bg-gray-100 dark:!bg-[#0a0a0a]">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-900 dark:text-white">Loading trading fees...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="!bg-gray-100 dark:!bg-[#0a0a0a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-500">
              Total Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${getTotalFees().toFixed(2)}
            </div>
            <p className="text-xs text-gray-600 dark:text-muted-foreground">
              {fees.length} fee entries
            </p>
          </CardContent>
        </Card>

        <Card className="!bg-gray-100 dark:!bg-[#0a0a0a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-500">
              Commission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${(getFeesByType().commission || 0).toFixed(2)}
            </div>
            <p className="text-xs text-gray-600 dark:text-muted-foreground">
              Broker commissions
            </p>
          </CardContent>
        </Card>

        <Card className="!bg-gray-100 dark:!bg-[#0a0a0a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 dark:text-gray-300">
              Exchange Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${(getFeesByType().exchange_fee || 0).toFixed(2)}
            </div>
            <p className="text-xs text-gray-600 dark:text-muted-foreground">
              Exchange charges
            </p>
          </CardContent>
        </Card>

        <Card className="!bg-gray-100 dark:!bg-[#0a0a0a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 dark:text-gray-300">
              Other Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${((getFeesByType().regulatory_fee || 0) + (getFeesByType().other || 0)).toFixed(2)}
            </div>
            <p className="text-xs text-gray-600 dark:text-muted-foreground">
              Regulatory & other
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add Fee Dialog */}
      <Card className="!bg-gray-100 dark:!bg-[#0a0a0a]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Trading Fees</CardTitle>
              <CardDescription>
                Manage additional trading fees not included in broker CSV files
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="!bg-none !bg-gray-500 hover:!bg-gray-600 text-white border-gray-500 shadow-none">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Fee
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingFee ? 'Edit Trading Fee' : 'Add Trading Fee'}
                  </DialogTitle>
                  <DialogDescription>
                    Add additional fees that may not be included in your broker's CSV export.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="trade">Trade</Label>
                    <Select value={selectedTradeId} onValueChange={setSelectedTradeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a trade" />
                      </SelectTrigger>
                      <SelectContent>
                        {trades.map((trade) => (
                          <SelectItem key={trade.id} value={trade.id}>
                            {trade.symbol} - {trade.side} - {new Date(trade.date).toLocaleDateString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fee_type">Fee Type</Label>
                    <Select value={formData.fee_type} onValueChange={(value: any) => setFormData({ ...formData, fee_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="commission">Commission</SelectItem>
                        <SelectItem value="exchange_fee">Exchange Fee</SelectItem>
                        <SelectItem value="regulatory_fee">Regulatory Fee</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="!bg-none !bg-gray-500 hover:!bg-gray-600 text-white border-gray-500 shadow-none">
                      {editingFee ? 'Update' : 'Add'} Fee
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {fees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trade</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.map((fee) => {
                  const trade = trades.find(t => t.id === fee.trade_id);
                  return (
                    <TableRow key={fee.id}>
                      <TableCell>
                        {trade ? (
                          <div>
                            <div className="font-medium">{trade.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              {trade.side} • {new Date(trade.date).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Trade not found</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getFeeTypeColor(fee.fee_type)}>
                          {fee.fee_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${fee.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {new Date(fee.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {fee.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(fee)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(fee.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No trading fees added yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Add fees that aren't included in your broker's CSV export
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
