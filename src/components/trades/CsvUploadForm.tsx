import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Download, HelpCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';

interface Trade {
  symbol: string;
  position_type: 'LONG' | 'SHORT';
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  size: number;
  pnl: number;
  strategy: string;
  notes: string;
}

export function CsvUploadForm() {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const supabase = createClient();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await new Promise<Papa.ParseResult<Trade>>((resolve, reject) => {
        Papa.parse<Trade>(file, {
          header: true,
          dynamicTyping: true,
          complete: resolve,
          error: reject,
        });
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Process trades in batches
      const batchSize = 50;
      const trades = result.data.filter(trade =>
        trade.symbol && trade.entry_price && trade.exit_price && trade.size
      );

      if (trades.length === 0) {
        throw new Error('No valid trades found in the CSV file');
      }

      let successCount = 0;
      for (let i = 0; i < trades.length; i += batchSize) {
        const batch = trades.slice(i, i + batchSize).map(trade => ({
          user_id: user.id,
          symbol: trade.symbol,
          position: trade.position_type === 'LONG' ? 'long' : 'short',
          entry_date: new Date(trade.entry_date).toISOString(),
          exit_date: new Date(trade.exit_date).toISOString(),
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          quantity: trade.size,
          pnl: calculatePnL(trade),
          strategy: trade.strategy || null,
          broker: 'Generic',
          notes: trade.notes || null,
          date: new Date(trade.entry_date).toISOString().split('T')[0]
        }));

        const { error } = await supabase.from('trades').insert(batch);
        if (error) {
          console.error('Error inserting batch:', error);
          throw new Error(`Failed to insert trades: ${error.message}`);
        }
        successCount += batch.length;
      }

      toast({
        title: 'Upload Successful',
        description: `Successfully uploaded ${successCount} trades`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload trades',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file?.type === 'text/csv') {
      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
        handleFileUpload({ target: { files: e.dataTransfer.files } } as any);
      }
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
    }
  };

  const calculatePnL = (trade: Trade) => {
    if (trade.pnl !== undefined && trade.pnl !== null) {
      return trade.pnl;
    }

    const { position_type, entry_price, exit_price, size } = trade;
    if (position_type === 'LONG') {
      return (exit_price - entry_price) * size;
    } else {
      return (entry_price - exit_price) * size;
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'symbol',
      'position_type',
      'entry_date',
      'exit_date',
      'entry_price',
      'exit_price',
      'size',
      'pnl',
      'strategy',
      'notes'
    ];

    const csvContent = headers.join(',') + '\n';

    // Create a blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'generic_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="w-full">
          <Label htmlFor="csv-file">CSV File</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </div>
      </div>

      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center",
          dragActive ? "border-primary bg-primary/10" : "border-gray-300",
          isUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-600">
            {isUploading ? "Processing..." : "Drag & drop or click to upload CSV"}
          </p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={downloadTemplate}
          disabled={isUploading}
        >
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>

        <Button
          variant="link"
          size="sm"
          asChild
        >
          <a href="/README-TRADOVATE-IMPORT.md" target="_blank" rel="noopener noreferrer">
            <HelpCircle className="h-4 w-4 mr-2" />
            CSV Format Help
          </a>
        </Button>

        <Button
          type="button"
          disabled={isUploading}
          className="bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg"
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </>
          )}
        </Button>
      </div>
    </div>
  );
} 