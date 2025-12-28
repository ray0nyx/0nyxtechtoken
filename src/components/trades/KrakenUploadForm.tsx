import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface KrakenUploadFormProps {
  directUpload?: boolean;
}

export function KrakenUploadForm({ directUpload = false }: KrakenUploadFormProps) {
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
      // TODO: Implement Kraken CSV processing
      toast({
        title: "Coming Soon",
        description: "Kraken CSV upload support will be available soon!",
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
        <h3 className="font-medium mb-2">Kraken CSV Format</h3>
        <p>This uploader is specifically designed for Kraken trade history exports. Please ensure your CSV file has the following columns:</p>
        <ul className="list-disc list-inside mt-2">
          <li>Required columns: Pair, Volume, Price, Type, Time</li>
          <li>Optional columns: Fee, Cost, Margin, Balance</li>
        </ul>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4 mr-1" />
          View Sample CSV Format
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
            Pair,Volume,Price,Type,Time,Fee,Cost,Margin,Balance
            XBTUSD,0.5,45000.00,buy,2024-03-24 09:30:00,2.25,22502.25,0,22502.25
            XBTUSD,0.5,48000.00,sell,2024-03-25 15:45:00,2.40,23997.60,0,46499.85
          </pre>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4 mr-1" />
          How to Export from Kraken
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground">
          <p>1. Log in to your Kraken account</p>
          <p>2. Go to History → Export</p>
          <p>3. Select "Trades" as the report type</p>
          <p>4. Choose your date range and format as CSV</p>
          <p>5. Click "Submit" and download when ready</p>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center space-x-4">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="kraken-csv-upload"
        />
        <Button
          onClick={() => document.getElementById('kraken-csv-upload')?.click()}
          disabled={uploading}
          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Kraken CSV"}
        </Button>
      </div>
    </div>
  );
} 