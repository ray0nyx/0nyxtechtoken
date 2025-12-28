import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { payoutService, PayoutRequest } from '@/services/payoutService';
import { 
  DollarSign, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface PayoutHistoryProps {
  affiliateId: string;
}

export const PayoutHistory: React.FC<PayoutHistoryProps> = ({ affiliateId }) => {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayoutHistory();
  }, [affiliateId]);

  const loadPayoutHistory = async () => {
    try {
      setLoading(true);
      const data = await payoutService.getPayoutHistory(affiliateId);
      setPayouts(data);
    } catch (error) {
      console.error('Error loading payout history:', error);
      // Set empty array if payout system is not available
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
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
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading payout history...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Payout History
        </CardTitle>
        <CardDescription>
          Track your payout requests and their status
        </CardDescription>
      </CardHeader>
      <CardContent>
        {payouts.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Payouts Yet</h3>
            <p className="text-gray-600">
              Your payout history will appear here once you request your first payout.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {payouts.map((payout) => (
              <div
                key={payout.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-gray-900">
                      ${payout.amount.toFixed(2)}
                    </div>
                    {getStatusBadge(payout.status)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(payout.created_at)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Payment Method:</span>
                    <p className="font-medium capitalize">
                      {payout.payment_method.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Payout ID:</span>
                    <p className="font-mono text-xs">{payout.id.slice(0, 8)}...</p>
                  </div>
                  {payout.processed_at && (
                    <div>
                      <span className="text-gray-600">Processed:</span>
                      <p className="font-medium">
                        {formatDate(payout.processed_at)}
                      </p>
                    </div>
                  )}
                </div>

                {payout.notes && (
                  <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Notes:</strong> {payout.notes}
                    </p>
                  </div>
                )}

                {payout.stripe_transfer_id && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-gray-600">Stripe Transfer:</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {payout.stripe_transfer_id}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`https://dashboard.stripe.com/transfers/${payout.stripe_transfer_id}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {payout.paypal_transaction_id && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-gray-600">PayPal Transaction:</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {payout.paypal_transaction_id}
                    </code>
                  </div>
                )}

                {/* Commission Details */}
                {payout.payout_commissions && payout.payout_commissions.length > 0 && (
                  <div className="mt-3">
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                        View Commission Details ({payout.payout_commissions.length} commissions)
                      </summary>
                      <div className="mt-2 space-y-2">
                        {payout.payout_commissions.map((pc: any, index: number) => (
                          <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                            <div className="flex justify-between">
                              <span>${pc.commissions?.amount?.toFixed(2) || '0.00'}</span>
                              <span className="text-gray-500">
                                {pc.commissions?.description || 'Commission'}
                              </span>
                            </div>
                            <div className="text-gray-500">
                              {pc.commissions?.created_at && formatDate(pc.commissions.created_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
