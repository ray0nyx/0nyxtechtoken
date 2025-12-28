import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';

interface RobinhoodUploadFormProps {
  directUpload?: boolean;
}

interface RobinhoodTrade {
  activityDate: string;
  processDate: string;
  settleDate: string;
  instrument: string;
  description: string;
  transCode: string;
  quantity: number;
  price: number;
  amount: number;
}

export function RobinhoodUploadForm({ directUpload = false }: RobinhoodUploadFormProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const processRobinhoodCSV = async (csvContent: string) => {
    return new Promise<RobinhoodTrade[]>((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => {
          // Map CSV headers to our expected format
          const headerMap: { [key: string]: string } = {
            'Activity Date': 'activityDate',
            'Process Date': 'processDate',
            'Settle Date': 'settleDate',
            'Instrument': 'instrument',
            'Description': 'description',
            'Trans Code': 'transCode',
            'Quantity': 'quantity',
            'Price': 'price',
            'Amount': 'amount'
          };
          return headerMap[header] || header;
        },
        transform: (value, field) => {
          // Convert numeric fields
          if (typeof field === 'string' && ['quantity', 'price'].includes(field)) {
            return value ? Math.abs(Number(value)) : 0;
          }
          if (field === 'amount') {
            // Remove $ and commas first
            const cleanValue = value.replace(/[$,]/g, '');
            // If the value is in parentheses, it's negative
            if (cleanValue.startsWith('(') && cleanValue.endsWith(')')) {
              return -Number(cleanValue.slice(1, -1));
            }
            return Number(cleanValue);
          }
          return value;
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error('Error parsing CSV: ' + results.errors[0].message));
            return;
          }

          // Filter only trade rows (BTO or STC)
          const trades = results.data.filter((row: any) =>
            row.transCode === 'BTO' || row.transCode === 'STC'
          );

          resolve(trades as RobinhoodTrade[]);
        },
        error: (error) => {
          reject(new Error('Error parsing CSV: ' + error.message));
        }
      });
    });
  };

  const uploadTrades = async (trades: RobinhoodTrade[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get or create a Robinhood account for this user
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', 'Robinhood')
      .single();

    let accountId;
    if (accountError) {
      // Create a new Robinhood account
      const { data: newAccount, error: createError } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          platform: 'Robinhood',
          name: 'Robinhood Account'
        })
        .select('id')
        .single();

      if (createError) throw createError;
      accountId = newAccount.id;
    } else {
      accountId = accounts.id;
    }

    // Group trades by symbol and description to match entries with exits
    const tradeGroups = new Map<string, RobinhoodTrade[]>();
    trades.forEach(trade => {
      const key = `${trade.instrument}_${trade.description}`;
      if (!tradeGroups.has(key)) {
        tradeGroups.set(key, []);
      }
      tradeGroups.get(key)?.push(trade);
    });

    // Process each group of trades
    for (const [_, groupTrades] of tradeGroups) {
      // Sort trades by date
      groupTrades.sort((a, b) => new Date(a.activityDate).getTime() - new Date(b.activityDate).getTime());

      // Find entry (BTO) and exit (STC) trades
      const entryTrade = groupTrades.find(t => t.transCode === 'BTO');
      const exitTrade = groupTrades.find(t => t.transCode === 'STC');

      if (entryTrade && exitTrade) {
        // Calculate total PnL by adding both amounts (BTO is negative, STC is positive)
        const pnl = entryTrade.amount + exitTrade.amount;

        const tradeData = {
          user_id: user.id,
          account_id: accountId,
          symbol: entryTrade.instrument,
          side: 'sell', // We only record completed trades
          quantity: entryTrade.quantity,
          price: entryTrade.price, // Entry price
          entry_price: entryTrade.price, // Entry price
          exit_price: exitTrade.price, // Exit price
          amount: Math.abs(exitTrade.amount - entryTrade.amount), // Total transaction amount
          entry_date: entryTrade.activityDate,
          exit_date: exitTrade.settleDate,
          platform: 'Robinhood',
          notes: entryTrade.description,
          pnl: pnl, // This will now be negative for losses
          net_pnl: pnl, // Same as PnL since Robinhood includes fees
          fees: 0, // Robinhood has zero commission
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('trades')
          .insert(tradeData);

        if (insertError) throw insertError;
      }
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({
        title: "No file selected",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const content = await file.text();
      const trades = await processRobinhoodCSV(content);

      if (trades.length === 0) {
        throw new Error('No valid trades found in the CSV file');
      }

      await uploadTrades(trades);

      toast({
        title: "Success",
        description: `Successfully uploaded ${trades.length} trades from Robinhood`,
      });

      // Navigate back to trades page after successful upload
      if (directUpload) {
        setTimeout(() => {
          window.location.href = '/app/trades';
        }, 2000); // Give user time to see the success message
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred while uploading your file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-800">
        <h3 className="font-medium mb-2">Robinhood CSV Format</h3>
        <p>This uploader is specifically designed for Robinhood account statements. Please ensure your CSV file has the following columns:</p>
        <ul className="list-disc list-inside mt-2">
          <li>Required columns: Activity Date, Process Date, Settle Date, Instrument, Description, Trans Code, Quantity, Price, Amount</li>
          <li>The uploader will process trades with transaction codes BTO (Buy to Open) and STC (Sell to Close)</li>
        </ul>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4 mr-1" />
          View Sample CSV Format
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
            Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
            2024-03-24,2024-03-24,2024-03-24,SPY,SPY 3/24 Call $400,BTO,1,2.50,-250.00
            2024-03-24,2024-03-24,2024-03-24,SPY,SPY 3/24 Call $400,STC,1,3.75,375.00
          </pre>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4 mr-1" />
          How to Export from Robinhood
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground">
          <p>1. Log in to your Robinhood account</p>
          <p>2. Go to Account → Statements & History</p>
          <p>3. Select the date range you want to export</p>
          <p>4. Click "Download" and choose CSV format</p>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center space-x-4">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="robinhood-csv-upload"
        />
        <Button
          onClick={() => document.getElementById('robinhood-csv-upload')?.click()}
          disabled={uploading}
          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Robinhood CSV"}
        </Button>
      </div>
    </div>
  );
} 