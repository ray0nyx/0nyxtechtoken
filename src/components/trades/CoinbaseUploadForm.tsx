import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface CoinbaseUploadFormProps {
  directUpload?: boolean;
}

export function CoinbaseUploadForm({ directUpload = false }: CoinbaseUploadFormProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

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
      // TODO: Implement Coinbase CSV processing
      toast({
        title: "Coming Soon",
        description: "Coinbase CSV upload support will be available soon!",
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
        <h3 className="font-medium mb-2">Coinbase CSV Format</h3>
        <p>This uploader is specifically designed for Coinbase trade history exports. Please ensure your CSV file has the following columns:</p>
        <ul className="list-disc list-inside mt-2">
          <li>Required columns: Asset, Quantity, Spot Price, Side, Timestamp</li>
          <li>Optional columns: Fees, Total (Inclusive of fees), Notes</li>
        </ul>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4 mr-1" />
          View Sample CSV Format
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
            Asset,Quantity,Spot Price,Side,Timestamp,Fees,Total,Notes
            BTC,0.5,45000.00,Buy,2024-03-24T09:30:00Z,22.50,22522.50,Initial position
            BTC,0.5,48000.00,Sell,2024-03-25T15:45:00Z,24.00,23976.00,Take profit
          </pre>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4 mr-1" />
          How to Export from Coinbase
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground">
          <p>1. Log in to your Coinbase account</p>
          <p>2. Go to Reports → Transaction History</p>
          <p>3. Select "Trades" as the transaction type</p>
          <p>4. Choose your date range and click "Generate Report"</p>
          <p>5. Download the CSV file when it's ready</p>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center space-x-4">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="coinbase-csv-upload"
        />
        <Button
          onClick={() => document.getElementById('coinbase-csv-upload')?.click()}
          disabled={uploading}
          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Coinbase CSV"}
        </Button>
      </div>
    </div>
  );
} 