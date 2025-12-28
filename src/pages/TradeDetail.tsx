import { useParams, useNavigate } from 'react-router-dom';
import { getTradeById } from '@/lib/data';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { Trade } from '@/types/trade';

const TradeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const trade = getTradeById(id!);

  if (!trade) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Trade not found</h1>
        <Button onClick={() => navigate('/trades')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Trades
        </Button>
      </div>
    );
  }

  const getDuration = () => {
    const entry = trade.entry_date;
    const exit = trade.exit_date;
    const diffMs = exit.getTime() - entry.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHrs > 0) {
      return `${diffHrs}h ${diffMins}m`;
    }
    return `${diffMins}m`;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <Button variant="ghost" onClick={() => navigate('/trades')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Trades
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/trade/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">{trade.symbol}</h1>
            <Badge variant={trade.position === 'long' ? 'default' : 'destructive'}>
              {trade.position === 'long' ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              )}
              {trade.position.toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Quantity</p>
              <p className="text-lg font-medium">{trade.quantity} shares</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Entry Date</p>
              <p className="text-lg font-medium">{formatDate(trade.entry_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Exit Date</p>
              <p className="text-lg font-medium">{formatDate(trade.exit_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Entry Price</p>
              <p className="text-lg font-medium">${trade.entry_price.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Exit Price</p>
              <p className="text-lg font-medium">${trade.exit_price.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">P&L</p>
              <p className={cn(
                "text-lg font-medium",
                trade.pnl > 0 ? "text-green-500" : "text-red-500"
              )}>
                ${trade.pnl.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Strategy</p>
              <p className="text-lg font-medium">{trade.strategy}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Notes</p>
              <p className="text-lg font-medium">{trade.notes || 'No notes'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Duration</p>
              <p className="text-lg font-medium">{getDuration()}</p>
            </div>
            {trade.tags && trade.tags.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {trade.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
            {trade.fees !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Fees</p>
                <p className="text-lg font-medium">${trade.fees.toFixed(2)}</p>
              </div>
            )}
            {trade.commission !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Commission</p>
                <p className="text-lg font-medium">${trade.commission.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeDetail;
