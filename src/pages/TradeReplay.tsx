import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TradingViewReplay } from '@/components/trades/TradingViewReplay';
import { format } from 'date-fns';

export default function TradeReplay() {
  const [trades, setTrades] = useState<any[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchTrades = async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('entry_date', { ascending: false });

      if (error) {
        console.error('Error fetching trades:', error);
        return;
      }

      setTrades(data || []);
      setIsLoading(false);
    };

    fetchTrades();
  }, []);

  const formatTradeOption = (trade: any) => {
    const entryDate = format(new Date(trade.entry_date), 'MMM d, yyyy HH:mm');
    const pnl = trade.net_pnl >= 0 ? `+$${trade.net_pnl.toFixed(2)}` : `-$${Math.abs(trade.net_pnl).toFixed(2)}`;
    return `${trade.symbol} - ${entryDate} (${pnl})`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <Card className="p-4">
        <h2 className="text-2xl font-bold mb-4">Trade Replay</h2>
        <div className="w-full max-w-md mb-6">
          <Select
            value={selectedTradeId || ''}
            onValueChange={(value) => setSelectedTradeId(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a trade to replay" />
            </SelectTrigger>
            <SelectContent>
              {trades.map((trade) => (
                <SelectItem key={trade.id} value={trade.id}>
                  {formatTradeOption(trade)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTradeId ? (
          <TradingViewReplay tradeId={selectedTradeId} />
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Select a trade above to start the replay
          </div>
        )}
      </Card>
    </div>
  );
} 