import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trade } from "@/types/trade";
import { useToast } from "@/components/ui/use-toast";
import { Upload, FileText } from "lucide-react";
import Papa from 'papaparse';
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { parsePnlValue } from "@/lib/utils";

interface ImportTradesProps {
  onImportComplete: (trades: Trade[]) => void;
}

interface BrokerConfig {
  name: string;
  logo: string;
  authUrl: string;
}

const SUPPORTED_BROKERS: BrokerConfig[] = [
  {
    name: "Tradovate",
    logo: "/tradovate-logo.png",
    authUrl: "https://live.tradovate.com/oauth/authorize"
  },
  {
    name: "TD Ameritrade",
    logo: "/td-logo.png",
    authUrl: "https://auth.tdameritrade.com/auth"
  },
  {
    name: "Interactive Brokers",
    logo: "/ib-logo.png",
    authUrl: "https://www.interactivebrokers.com/oauth/authorize"
  },
  {
    name: "TradeStation",
    logo: "/tradestation-logo.png",
    authUrl: "https://api.tradestation.com/v2/authorize"
  }
];

export function ImportTrades({ onImportComplete }: ImportTradesProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleBrokerAuth = (broker: BrokerConfig) => {
    // Store the current broker in localStorage for the callback
    localStorage.setItem('selectedBroker', broker.name);

    // Generate a random state value for security
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('oauthState', state);

    // Construct the OAuth URL with necessary parameters
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.VITE_CLIENT_ID || '',
      redirect_uri: `${window.location.origin}/auth/callback`,
      state: state,
      scope: 'trade_data read_accounts',
    });

    // Redirect to broker's OAuth page
    window.location.href = `${broker.authUrl}?${params.toString()}`;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to import trades",
        variant: "destructive",
      });
      return;
    }

    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      toast({
        title: "Error",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const trades = results.data.map((row: any) => {
            if (!row.symbol || !row.position || !row.date || !row.entry_price || !row.exit_price || !row.quantity) {
              throw new Error("Missing required fields in CSV");
            }

            const trade: Trade = {
              id: crypto.randomUUID(),
              user_id: user?.id || '',
              symbol: row.symbol.toUpperCase(),
              position: row.position.toLowerCase(),
              date: new Date(row.date),
              entry_date: new Date(row.entry_date || row.date),
              exit_date: new Date(row.exit_date || row.date),
              entry_price: parseFloat(row.entry_price),
              exit_price: parseFloat(row.exit_price),
              quantity: parseInt(row.quantity),
              pnl: row.pnl ? parsePnlValue(row.pnl) : 0,
              strategy: row.strategy || 'Unknown',
              broker: row.broker || 'Manual',
              notes: row.notes || '',
              tags: row.tags ? row.tags.split(',').map((tag: string) => tag.trim()) : [],
              fees: row.fees ? parseFloat(row.fees) : 0,
              commission: row.commission ? parseFloat(row.commission) : 0
            };

            if (isNaN(trade.entry_price) || isNaN(trade.exit_price) || isNaN(trade.quantity)) {
              throw new Error("Invalid numeric values in CSV");
            }

            if (isNaN(trade.pnl)) {
              const multiplier = trade.position === 'long' ? 1 : -1;
              trade.pnl = multiplier * (trade.exit_price - trade.entry_price) * trade.quantity;
            }

            return trade;
          });

          onImportComplete(trades);
          setOpen(false);
          toast({
            title: "Success",
            description: `Imported ${trades.length} trades successfully`,
          });
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message || "Failed to parse CSV file",
            variant: "destructive",
          });
        }
      },
      error: (error: any) => {
        toast({
          title: "Error",
          description: "Failed to parse CSV file: " + error.message,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Import Trades
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Trades</DialogTitle>
          <DialogDescription>
            Import your trades from your broker or upload a CSV file
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="broker">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="broker">Connect Broker</TabsTrigger>
            <TabsTrigger value="csv">Upload CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="broker" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {SUPPORTED_BROKERS.map((broker) => (
                <Card
                  key={broker.name}
                  className="p-4 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleBrokerAuth(broker)}
                >
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={broker.logo}
                      alt={broker.name}
                      className="h-12 w-12 object-contain"
                    />
                    <span className="font-medium">{broker.name}</span>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="csv">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="trades-csv">Upload CSV File</Label>
                <Input
                  id="trades-csv"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Example CSV format:</p>
                <pre className="mt-2 rounded bg-muted p-2 overflow-x-auto">
                  symbol,position,date,entry_price,exit_price,quantity,strategy
                  AAPL,long,2024-01-15,180.50,185.25,100,Momentum
                </pre>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 