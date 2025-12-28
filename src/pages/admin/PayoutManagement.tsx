import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { payoutService, PayoutRequest } from '@/services/payoutService';
import { 
  DollarSign, 
  Users, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Eye
} from 'lucide-react';

export const PayoutManagement: React.FC = () => {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [stripeTransferId, setStripeTransferId] = useState('');
  const [paypalTransactionId, setPaypalTransactionId] = useState('');

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    try {
      setLoading(true);
      const data = await payoutService.getPendingPayouts();
      setPayouts(data);
    } catch (error) {
      console.error('Error loading payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (payoutId: string, status: string) => {
    try {
      setUpdating(true);
      await payoutService.updatePayoutStatus(
        payoutId,
        status as any,
        notes || undefined,
        stripeTransferId || undefined,
        paypalTransactionId || undefined
      );
      
      setSelectedPayout(null);
      setNotes('');
      setStripeTransferId('');
      setPaypalTransactionId('');
      await loadPayouts();
    } catch (error) {
      console.error('Error updating payout status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      processing: { color: 'bg-blue-100 text-blue-800', icon: RefreshCw },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">Loading payouts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payout Management</h1>
          <p className="text-gray-600">Manage affiliate payouts and commission payments</p>
        </div>
        <Button onClick={loadPayouts} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Payouts List */}
      <div className="grid grid-cols-1 gap-4">
        {payouts.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Payouts</h3>
                <p className="text-gray-600">All payouts are up to date</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          payouts.map((payout) => (
            <Card key={payout.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-gray-900">
                      ${payout.amount.toFixed(2)}
                    </div>
                    {getStatusBadge(payout.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPayout(payout)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    {payout.status === 'pending' && (
                      <Button
                        onClick={() => handleStatusUpdate(payout.id, 'processing')}
                        disabled={updating}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Mark Processing
                      </Button>
                    )}
                    {payout.status === 'processing' && (
                      <Button
                        onClick={() => handleStatusUpdate(payout.id, 'completed')}
                        disabled={updating}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Mark Completed
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Affiliate:</span>
                    <p className="font-medium">
                      {(payout as any).affiliates?.name || 'Unknown'}
                    </p>
                    <p className="text-gray-500">
                      {(payout as any).affiliates?.email || 'No email'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Payment Method:</span>
                    <p className="font-medium capitalize">
                      {payout.payment_method.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Requested:</span>
                    <p className="font-medium">
                      {formatDate(payout.created_at)}
                    </p>
                  </div>
                </div>

                {payout.notes && (
                  <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Notes:</strong> {payout.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Payout Details Modal */}
      {selectedPayout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Payout Details</CardTitle>
              <CardDescription>
                Payout ID: {selectedPayout.id}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <p className="text-2xl font-bold">${selectedPayout.amount.toFixed(2)}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedPayout.status)}</div>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <p className="capitalize">{selectedPayout.payment_method.replace('_', ' ')}</p>
                </div>
                <div>
                  <Label>Created</Label>
                  <p>{formatDate(selectedPayout.created_at)}</p>
                </div>
              </div>

              {selectedPayout.bank_details && (
                <div>
                  <Label>Bank Details</Label>
                  <div className="mt-2 p-3 bg-gray-100 rounded-lg">
                    <p><strong>Bank:</strong> {selectedPayout.bank_details.bank_name}</p>
                    <p><strong>Account Holder:</strong> {selectedPayout.bank_details.account_holder_name}</p>
                    <p><strong>Account Type:</strong> {selectedPayout.bank_details.account_type}</p>
                    <p><strong>Country:</strong> {selectedPayout.bank_details.country}</p>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="notes">Admin Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this payout..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stripeTransferId">Stripe Transfer ID</Label>
                  <Input
                    id="stripeTransferId"
                    value={stripeTransferId}
                    onChange={(e) => setStripeTransferId(e.target.value)}
                    placeholder="tr_1234567890"
                  />
                </div>
                <div>
                  <Label htmlFor="paypalTransactionId">PayPal Transaction ID</Label>
                  <Input
                    id="paypalTransactionId"
                    value={paypalTransactionId}
                    onChange={(e) => setPaypalTransactionId(e.target.value)}
                    placeholder="TXN123456789"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedPayout(null)}
                >
                  Close
                </Button>
                {selectedPayout.status === 'pending' && (
                  <Button
                    onClick={() => handleStatusUpdate(selectedPayout.id, 'processing')}
                    disabled={updating}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Mark Processing
                  </Button>
                )}
                {selectedPayout.status === 'processing' && (
                  <Button
                    onClick={() => handleStatusUpdate(selectedPayout.id, 'completed')}
                    disabled={updating}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Mark Completed
                  </Button>
                )}
                <Button
                  onClick={() => handleStatusUpdate(selectedPayout.id, 'failed')}
                  disabled={updating}
                  variant="destructive"
                >
                  Mark Failed
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
