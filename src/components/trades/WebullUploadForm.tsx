import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import Papa from 'papaparse';
import { useSupabase } from '@/hooks/useSupabase';

interface WebullUploadFormProps {
  directUpload?: boolean;
}

interface WebullTrade {
  Name: string;
  Symbol: string;
  Side: string;
  Status: string;
  Filled: string;
  'Total Qty': string;
  Price: string;
  'Avg Price': string;
  'Time-in-Force': string;
  'Placed Time': string;
  'Filled Time': string;
}

export function WebullUploadForm({ directUpload = false }: WebullUploadFormProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const { supabase } = useSupabase();

  const processWebullTrade = async (trade: WebullTrade) => {
    if (trade.Status !== 'Filled') return null;

    const filledTime = new Date(trade['Filled Time']);
    const filled = parseFloat(trade.Filled);
    const avgPrice = parseFloat(trade['Avg Price']);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.rpc('process_webull_trade', {
        p_user_id: user.id,
        p_symbol: trade.Symbol,
        p_side: trade.Side,
        p_filled_qty: filled,
        p_avg_price: avgPrice,
        p_filled_time: filledTime.toISOString(),
        p_time_in_force: trade['Time-in-Force'],
        p_status: trade.Status
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error processing trade:', error);
      return null;
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
      const text = await file.text();
      Papa.parse<WebullTrade>(text, {
        header: true,
        complete: async (results) => {
          const trades = results.data.filter(trade => trade.Status === 'Filled');

          if (trades.length === 0) {
            toast({
              title: "No valid trades found",
              description: "The CSV file contains no filled trades",
              variant: "destructive",
            });
            return;
          }

          const processedTrades = await Promise.all(
            trades.map(trade => processWebullTrade(trade))
          );

          const successfulTrades = processedTrades.filter(t => t !== null);

          if (successfulTrades.length > 0) {
            // Calculate PnL after processing trades
            await supabase.rpc('calculate_webull_pnl');

            toast({
              title: "Upload successful",
              description: `Processed ${successfulTrades.length} trades successfully`,
            });

            // Navigate back to trades page after successful upload
            setTimeout(() => {
              window.location.href = '/app/trades';
            }, 2000); // Give user time to see the success message
          } else {
            toast({
              title: "Upload failed",
              description: "No trades were processed successfully",
              variant: "destructive",
            });
          }
        },
        error: (error) => {
          throw new Error(`CSV parsing error: ${error.message}`);
        }
      });
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
        <h3 className="font-medium mb-2">Webull CSV Format</h3>
        <p>This uploader is specifically designed for Webull CSV exports. Please ensure your CSV file has the following columns:</p>
        <ul className="list-disc list-inside mt-2">
          <li>Required columns: Name, Symbol, Side, Status, Filled, Total Qty, Price, Avg Price, Time-in-Force, Placed Time, Filled Time</li>
        </ul>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4 mr-1" />
          View Sample CSV Format
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
            Name,Symbol,Side,Status,Filled,Total Qty,Price,Avg Price,Time-in-Force,Placed Time,Filled Time
            SPY230929C00431000,SPY230929C00431000,Buy,Filled,1,1,0.950,0.950,GTC,09/29/2023 10:58:41 EDT,09/29/2023 10:58:41 EDT
            SPY230929P00431000,SPY230929P00431000,Sell,Filled,3,3,1.41,1.41,DAY,09/29/2023 09:40:37 EDT,09/29/2023 09:40:37 EDT
          </pre>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4 mr-1" />
          How to Export from Webull
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground">
          <p>1. Log in to your Webull account</p>
          <p>2. Navigate to Orders → History</p>
          <p>3. Click on the Export button</p>
          <p>4. Select your date range and download the CSV</p>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center space-x-4">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="webull-csv-upload"
        />
        <Button
          onClick={() => document.getElementById('webull-csv-upload')?.click()}
          disabled={uploading}
          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Webull CSV"}
        </Button>
      </div>
    </div>
  );
} 