import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Download, HelpCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Papa from 'papaparse';
import { useSupabase } from '@/hooks/useSupabase';
import { cn, parsePnlValue } from '@/lib/utils';

interface Trade {
  symbol: string;
  quantity: number;
  entry_price: number;
  exit_price: number;
  entry_date: string;
  exit_date: string;
  user_id: string;
  position: 'long' | 'short';
  pnl?: number;
  strategy?: string;
  notes?: string;
  tags?: string[];
  fees?: number;
}

interface DatabaseTrade {
  user_id: string;
  symbol: string;
  position: string;
  entry_date: string;
  entry_price: number;
  exit_date: string | null;
  exit_price: number | null;
  quantity: number;
  pnl: number | null;
  strategy: string | null;
  broker: string;
  notes: string | null;
  tags: string[] | null;
  fees: number | null;
  buyFillId?: string | null;
  sellFillId?: string | null;
  buyPrice?: number | null;
  sellPrice?: number | null;
  boughtTimestamp?: string | null;
  soldTimestamp?: string | null;
  duration?: number | null;
  date: string;
}

const BATCH_SIZE = 100; // Default batch size for free tier

// Multiplier mapping for different instruments
const MULTIPLIERS: { [key: string]: number } = {
  'ES': 50,
  'NQ': 100,
  'MNQ': 0.5,
  'MES': 5,
};

/**
 * Sanitizes a string input to prevent XSS and other injection attacks
 * @param input The input string to sanitize
 * @returns Sanitized string
 */
function sanitizeInput(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  
  // Convert to string if not already
  const str = String(input);
  
  // Replace potentially dangerous characters
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .replace(/\$/g, '&#36;')
    .trim();
}

/**
 * Validates and normalizes a trading symbol
 * @param symbol The raw symbol from CSV
 * @returns Normalized symbol or empty string if invalid
 */
function validateSymbol(symbol: string | undefined | null): string {
  if (!symbol) return '';
  
  // Remove whitespace and convert to uppercase
  const normalizedSymbol = sanitizeInput(symbol).toUpperCase();
  
  // Basic validation - symbols should be at least 1 character
  if (normalizedSymbol.length < 1) return '';
  
  // You could add more validation rules here, such as:
  // - Check against a list of valid symbols
  // - Validate format (e.g., must contain only letters, numbers, and certain special characters)
  // - Check for specific patterns based on your broker's format
  
  return normalizedSymbol;
}

/**
 * Validates and normalizes a position value
 * @param positionValue The raw position value from CSV
 * @returns Normalized position ('long' or 'short') or null if invalid
 */
function validatePosition(positionValue: string | undefined | null): 'long' | 'short' | null {
  if (!positionValue) return null;
  
  const normalized = positionValue.toString().trim().toLowerCase();
  
  // Check for various representations of long positions
  if (['b', 'buy', 'long', 'l'].includes(normalized)) {
    return 'long';
  }
  
  // Check for various representations of short positions
  if (['s', 'sell', 'short', 'sh'].includes(normalized)) {
    return 'short';
  }
  
  return null;
}

function getMultiplier(symbol: string): number {
  const baseSymbol = symbol.replace(/[0-9]/g, '').replace(/[A-Z]$/, '');
  return MULTIPLIERS[baseSymbol] || 1;
}

function calculatePnL(position: 'long' | 'short', entryPrice: number, exitPrice: number, quantity: number, symbol: string): number {
  try {
    // Ensure all inputs are properly parsed numbers
    const parsedEntryPrice = typeof entryPrice === 'string' ? parseNumber(entryPrice) : entryPrice;
    const parsedExitPrice = typeof exitPrice === 'string' ? parseNumber(exitPrice) : exitPrice;
    const parsedQuantity = typeof quantity === 'string' ? parseNumber(quantity) : quantity;
    
    // Validate inputs to prevent division by zero or invalid calculations
    if (!parsedEntryPrice || parsedEntryPrice === 0) {
      console.error('Invalid entry price (zero or undefined) for calculation:', { symbol, entryPrice });
      return 0;
    }

    if (!parsedExitPrice || parsedExitPrice === 0) {
      console.error('Invalid exit price (zero or undefined) for calculation:', { symbol, exitPrice });
      return 0;
    }

    if (!parsedQuantity || parsedQuantity === 0) {
      console.error('Invalid quantity (zero or undefined) for calculation:', { symbol, quantity });
      return 0;
    }

    const multiplier = getMultiplier(symbol);
    if (multiplier === 0) {
      console.error('Invalid multiplier (zero) for symbol:', symbol);
      return 0;
    }

    const pnl = position === 'long'
      ? (parsedExitPrice - parsedEntryPrice) * parsedQuantity * multiplier
      : (parsedEntryPrice - parsedExitPrice) * parsedQuantity * multiplier;

    if (!isFinite(pnl) || isNaN(pnl)) {
      console.error('Invalid PnL calculation result:', { entryPrice, exitPrice, quantity, multiplier, pnl });
      return 0;
    }

    return pnl;
  } catch (error) {
    console.error('Error calculating PnL:', error);
    return 0;
  }
}

function parseDate(dateStr: string): string {
  try {
    if (!dateStr) {
      return new Date().toISOString();
    }
    
    // Try to parse the date string
    const parsedDate = new Date(dateStr);
    
    // Check if the date is valid
    if (isNaN(parsedDate.getTime())) {
      // Try alternative formats if standard parsing fails
      // Example: DD/MM/YYYY format
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/').map(Number);
        const reformattedDate = new Date(year, month - 1, day);
        if (!isNaN(reformattedDate.getTime())) {
          return reformattedDate.toISOString();
        }
      }
      
      // Example: MM-DD-YYYY format
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
        const [month, day, year] = dateStr.split('-').map(Number);
        const reformattedDate = new Date(year, month - 1, day);
        if (!isNaN(reformattedDate.getTime())) {
          return reformattedDate.toISOString();
        }
      }
      
      // If all parsing attempts fail, log warning and use current date
      console.warn(`Could not parse date: ${dateStr}, using current date`);
      return new Date().toISOString();
    }
    
    return parsedDate.toISOString();
  } catch (error) {
    console.warn(`Error parsing date: ${dateStr}, using current date`, error);
    return new Date().toISOString();
  }
}

function parseNumber(value: string | undefined | null, defaultValue: number = 0): number {
  if (!value) return defaultValue;
  // Remove any non-numeric characters except decimal point and negative sign
  const cleanedValue = value.toString().replace(/[^0-9.-]+/g, '');
  // If the cleaned value is empty, return the default value
  if (!cleanedValue) return defaultValue;
  
  const num = parseFloat(cleanedValue);
  return isFinite(num) ? num : defaultValue;
}

function validateTrade(trade: any): trade is Trade {
  const validationErrors: string[] = [];
  
  // Check required fields
  const requiredFields = ['symbol', 'position', 'entry_date', 'entry_price', 'quantity', 'strategy', 'broker'];
  const missingFields = requiredFields.filter(field => !trade[field]);
  
  if (missingFields.length > 0) {
    validationErrors.push(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Validate position
  if (trade.position !== 'long' && trade.position !== 'short') {
    validationErrors.push(`Invalid position value: ${trade.position}`);
  }

  // Validate numeric fields
  const numericFields = ['entry_price', 'exit_price', 'quantity', 'pnl', 'fees'];
  for (const field of numericFields) {
    if (trade[field] !== null && trade[field] !== undefined) {
      if (isNaN(Number(trade[field])) || !isFinite(Number(trade[field]))) {
        validationErrors.push(`Invalid numeric value for ${field}: ${trade[field]}`);
      }
    }
  }
  
  // Validate dates
  const dateFields = ['entry_date', 'exit_date'];
  for (const field of dateFields) {
    if (trade[field] !== null && trade[field] !== undefined) {
      try {
        const date = new Date(trade[field]);
        if (isNaN(date.getTime())) {
          validationErrors.push(`Invalid date for ${field}: ${trade[field]}`);
        }
      } catch (error) {
        validationErrors.push(`Error parsing date for ${field}: ${trade[field]}`);
      }
    }
  }
  
  // Validate quantity is positive
  if (trade.quantity !== undefined && trade.quantity <= 0) {
    validationErrors.push(`Quantity must be positive: ${trade.quantity}`);
  }
  
  // Log all validation errors
  if (validationErrors.length > 0) {
    console.error('Trade validation failed:', validationErrors, trade);
    return false;
  }

  return true;
}

export function CsvUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStats, setProcessingStats] = useState<{
    total: number;
    processed: number;
    successful: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const { supabase } = useSupabase();
  const { toast } = useToast();

  const getCurrentUser = async () => {
    // Developer emails with full access
    const developerEmails = ['rayhan@arafatcapital.com', 'sevemadsen18@gmail.com'];
    
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      // Developer bypass
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email && developerEmails.includes(session.user.email)) {
          console.log('Developer bypass activated for', session.user.email);
          return session.user;
        }
      } catch (fallbackError) {
        console.error('Developer bypass failed:', fallbackError);
      }
      throw new Error('Authentication error: ' + error.message);
    }
    if (!user) {
      // Developer bypass
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email && developerEmails.includes(session.user.email)) {
          console.log('Developer bypass activated for', session.user.email);
          return session.user;
        }
      } catch (fallbackError) {
        console.error('Developer bypass failed:', fallbackError);
      }
      throw new Error('No authenticated user found');
    }
    return user;
  };

  const checkUserPermissions = async (userId: string) => {
    try {
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('status')
        .eq('user_id', userId)
        .single();

      const { data: { user } } = await supabase.auth.getUser();
      
      // Default permissions
      let maxBatchSize = BATCH_SIZE;
      
      // Enhanced permissions for premium users
      if (subscription?.status === 'active') {
        maxBatchSize = 1000;
      }

      // Admin permissions
      if (user?.user_metadata?.role === 'admin') {
        maxBatchSize = 5000;
      }

      return {
        canWrite: true, // Basic permission check
        maxBatchSize
      };
    } catch (error) {
      console.error('Error checking permissions:', error);
      return {
        canWrite: true,
        maxBatchSize: BATCH_SIZE
      };
    }
  };

  const processBatch = async (
    trades: Partial<DatabaseTrade>[],
    batchSize: number,
    userId: string
  ) => {
    const batches: Partial<DatabaseTrade>[][] = [];
    for (let i = 0; i < trades.length; i += batchSize) {
      batches.push(trades.slice(i, i + batchSize));
    }

    let successCount = 0;
    let failedBatches: { batchIndex: number; error: any }[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Clean all numeric fields to ensure they don't have currency symbols
      const cleanedBatch = batch.map(trade => {
        const cleanedTrade = { ...trade };
        
        // Clean numeric fields that might have currency symbols
        if (typeof cleanedTrade.pnl === 'string') {
          cleanedTrade.pnl = parseNumber(cleanedTrade.pnl);
        }
        if (typeof cleanedTrade.entry_price === 'string') {
          cleanedTrade.entry_price = parseNumber(cleanedTrade.entry_price);
        }
        if (typeof cleanedTrade.exit_price === 'string') {
          cleanedTrade.exit_price = parseNumber(cleanedTrade.exit_price);
        }
        if (typeof cleanedTrade.buyPrice === 'string') {
          cleanedTrade.buyPrice = parseNumber(cleanedTrade.buyPrice);
        }
        if (typeof cleanedTrade.sellPrice === 'string') {
          cleanedTrade.sellPrice = parseNumber(cleanedTrade.sellPrice);
        }
        if (typeof cleanedTrade.fees === 'string') {
          cleanedTrade.fees = parseNumber(cleanedTrade.fees);
        }
        
        // Ensure date field is set correctly
        if (!cleanedTrade.date && cleanedTrade.entry_date) {
          // Extract just the date part (YYYY-MM-DD) from entry_date
          cleanedTrade.date = typeof cleanedTrade.entry_date === 'string' && cleanedTrade.entry_date.includes('T')
            ? cleanedTrade.entry_date.split('T')[0]
            : cleanedTrade.entry_date;
        }
        
        return cleanedTrade;
      });
      
      let retryCount = 0;
      const maxRetries = 3;
      let success = false;

      while (retryCount < maxRetries && !success) {
        try {
          console.log(`Processing batch ${i} (attempt ${retryCount + 1}/${maxRetries})...`);
          
          const { error } = await supabase
            .from('trades')
            .insert(cleanedBatch)
            .select();

          if (error) {
            // Check if this is a transient error that might succeed on retry
            const isTransientError = 
              error.message.includes('timeout') || 
              error.message.includes('connection') ||
              error.message.includes('rate limit') ||
              error.code === '40001' || // Serialization failure
              error.code === '40P01';   // Deadlock detected
              
            if (isTransientError && retryCount < maxRetries - 1) {
              console.warn(`Transient error on batch ${i}, retrying (${retryCount + 1}/${maxRetries}):`, error);
              retryCount++;
              // Exponential backoff: 500ms, 1000ms, 2000ms, etc.
              await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retryCount)));
              continue;
            }
            
            console.error(`Error inserting batch ${i} (final attempt):`, error);
            failedBatches.push({ batchIndex: i, error });
          } else {
            success = true;
            successCount += batch.length;
            window.dispatchEvent(new CustomEvent('tradesUpdated', {
              detail: { userId }
            }));
          }
        } catch (error) {
          if (retryCount < maxRetries - 1) {
            console.warn(`Error processing batch ${i}, retrying (${retryCount + 1}/${maxRetries}):`, error);
            retryCount++;
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retryCount)));
            continue;
          }
          
          console.error(`Error processing batch ${i} (final attempt):`, error);
          failedBatches.push({ batchIndex: i, error });
          break;
        }
      }
    }

    return { successCount, failedBatches };
  };

  const transformTradovateData = async (csvData: string): Promise<DatabaseTrade[]> => {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('No authenticated user found');
    }
    
    const trades: DatabaseTrade[] = [];
    const processedTradeHashes = new Set<string>();
    
    // Helper function to create a unique hash for a trade
    const createTradeHash = (trade: Partial<DatabaseTrade>): string => {
      return `${trade.symbol}-${trade.position}-${trade.entry_date}-${trade.exit_date}-${trade.entry_price}-${trade.exit_price}-${trade.quantity}`;
    };
    
    // Parse CSV data
    const { data } = Papa.parse(csvData, { header: true });
    
    // Group rows by date
    const rowsByDate: { [key: string]: any[] } = {};
    
    for (const row of data) {
      // Skip empty rows
      if (!row || Object.keys(row).length === 0) continue;
      
      // Get fill time - try alternative fields if Fill Time is missing
      let fillTime = row['Fill Time'] || row['boughtTimestamp'] || row['soldTimestamp'] || '';
      
      // If still no fill time but we have other identifying information, generate a default timestamp
      if (!fillTime && (row['buyFillId'] || row['sellFillId'] || row['orderId'] || row['symbol'] || row['Contract'] || row['Product'])) {
        console.warn('Row missing Fill Time, using current date as default:', row);
        fillTime = new Date().toISOString();
        row['Fill Time'] = fillTime; // Add the timestamp to the row for future processing
      } else if (!fillTime) {
        console.warn('Skipping row without Fill Time and insufficient data:', Object.keys(row));
        continue;
      }
      
      // Parse date from fill time
      try {
        const date = parseDate(fillTime);
        if (!rowsByDate[date]) {
          rowsByDate[date] = [];
        }
        rowsByDate[date].push(row);
      } catch (error) {
        console.warn('Error parsing date from fill time:', error);
      }
    }
    
    // Process each date's rows
    for (const date in rowsByDate) {
      const rows = rowsByDate[date];
      
      // Sort rows by fill time
      rows.sort((a, b) => {
        // Get timestamps from Fill Time or alternative fields
        const getTimestamp = (row) => {
          if (row['Fill Time']) return new Date(row['Fill Time']).getTime();
          if (row['boughtTimestamp']) return new Date(row['boughtTimestamp']).getTime();
          if (row['soldTimestamp']) return new Date(row['soldTimestamp']).getTime();
          return 0; // Fallback to 0 if no timestamp (should not happen at this point)
        };
        
        const timeA = getTimestamp(a);
        const timeB = getTimestamp(b);
        return timeA - timeB;
      });
      
      // Find entry and exit pairs
      for (let i = 0; i < rows.length - 1; i++) {
        const currentText = rows[i]['Text'] || '';
        const nextText = rows[i + 1]['Text'] || '';
        
        // Entry trades are usually marked with 'multibracket' or 'Tradingview'
        // Exit trades are usually marked with 'Exit'
        if (
          (currentText === 'multibracket' || 
           currentText === 'Tradingview' || 
           !currentText.startsWith('Exit')) &&
          nextText.startsWith('Exit')
        ) {
          // This is a pair - create a trade
          const entry = rows[i];
          const exit = rows[i + 1];
          
          // Get symbol from product or contract
          const symbol = sanitizeInput(entry['Product'] || entry['Contract'] || '');
          
          // Get position from B/S
          const positionValue = entry['B/S'] || '';
          const position = validatePosition(positionValue) || 'long'; // Default to long
          
          // Get prices
          const entryPrice = parseNumber(entry['avgPrice']);
          const exitPrice = parseNumber(exit['avgPrice']);
          
          // Get quantity
          const quantity = Math.abs(parseNumber(entry['Quantity'] || entry['filledQty'] || '1'));
          
          // Get timestamps
          const entryTime = entry['Fill Time'] || entry['boughtTimestamp'] || entry['soldTimestamp'] || new Date().toISOString();
          const exitTime = exit['Fill Time'] || exit['boughtTimestamp'] || exit['soldTimestamp'] || new Date().toISOString();
          
          // Calculate duration in seconds
          let duration = 0;
          try {
            const entryDate = new Date(entryTime);
            const exitDate = new Date(exitTime);
            duration = Math.floor((exitDate.getTime() - entryDate.getTime()) / 1000);
          } catch (error) {
            console.warn('Error calculating duration:', error);
          }
          
          // Calculate P&L
          let pnl = 0;
          try {
            pnl = calculatePnL(position, entryPrice, exitPrice, quantity, symbol);
          } catch (error) {
            console.warn('Error calculating P&L:', error);
          }
          
          // Create trade object
          const trade: Partial<DatabaseTrade> = {
            user_id: user.id,
            symbol,
            position,
            entry_date: parseDate(entryTime),
            entry_price: entryPrice,
            exit_date: parseDate(exitTime),
            exit_price: exitPrice,
            quantity,
            pnl,
            strategy: null,
            broker: 'Tradovate',
            notes: `Entry: ${entryTime}, Exit: ${exitTime}`,
            tags: null,
            fees: 2.50, // Default commission
            buyFillId: entry['orderId'] || null,
            sellFillId: exit['orderId'] || null,
            buyPrice: position === 'long' ? entryPrice : exitPrice,
            sellPrice: position === 'long' ? exitPrice : entryPrice,
            boughtTimestamp: position === 'long' ? entryTime : exitTime,
            soldTimestamp: position === 'long' ? exitTime : entryTime,
            duration,
            date: parseDate(entryTime).split('T')[0]
          };
          
          // Create a hash to avoid duplicates
          const tradeHash = createTradeHash(trade);
          
          if (!processedTradeHashes.has(tradeHash)) {
            processedTradeHashes.add(tradeHash);
            trades.push(trade as DatabaseTrade);
          }
          
          // Skip to next pair
          i++;
        }
      }
    }
    
    return trades;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file?.type === 'text/csv') {
      await handleFileUpload(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setProcessingStats({
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    });
    
    try {
      const user = await getCurrentUser();
      const permissions = await checkUserPermissions(user.id);

      if (!permissions.canWrite) {
        const errorMsg = "You don't have permission to upload trades.";
        setProcessingStats(prev => prev ? {...prev, errors: [...prev.errors, errorMsg]} : null);
        toast({
          title: "Permission Denied",
          description: errorMsg,
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvData = e.target?.result as string;
          
          // Update stats with total rows
          const rowCount = csvData.split('\n').length - 1; // Subtract header row
          setProcessingStats(prev => prev ? {...prev, total: rowCount} : null);
          
          const trades = await transformTradovateData(csvData);
          
          // Update stats with processed count
          setProcessingStats(prev => prev ? {...prev, processed: trades.length} : null);
          
          const { successCount, failedBatches } = await processBatch(
            trades,
            permissions.maxBatchSize,
            user.id
          );

          // Update final stats
          setProcessingStats(prev => prev ? {
            ...prev, 
            successful: successCount,
            failed: trades.length - successCount,
            errors: [
              ...prev.errors,
              ...failedBatches.map(batch => 
                `Batch ${batch.batchIndex} failed: ${batch.error.message || 'Unknown error'}`
              )
            ]
          } : null);

          toast({
            title: "Upload Complete",
            description: `Successfully uploaded ${successCount} trades${failedBatches.length > 0 ? `. Failed batches: ${failedBatches.length}` : ''}`,
            variant: failedBatches.length > 0 ? "destructive" : "default"
          });
        } catch (error) {
          console.error('Error processing trades:', error);
          const errorMsg = error instanceof Error ? error.message : "Failed to process trades";
          setProcessingStats(prev => prev ? {...prev, errors: [...prev.errors, errorMsg]} : null);
          toast({
            title: "Processing Failed",
            description: errorMsg,
            variant: "destructive"
          });
        }
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('Upload error:', error);
      const errorMsg = error instanceof Error ? error.message : "Failed to upload trades";
      setProcessingStats(prev => prev ? {...prev, errors: [...prev.errors, errorMsg]} : null);
      toast({
        title: "Upload Failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTradovateTemplate = () => {
    // Create a template CSV for Tradovate with all optional columns
    const headers = [
      'Text', 
      'Fill Time', 
      'filledQty', 
      'avgPrice', 
      'B/S', 
      'Contract', 
      'Product', 
      'orderId',
      'priceFormat',
      'priceFormatType',
      'tickSize',
      'buyFillId',
      'sellFillId',
      'qty',
      'buyPrice',
      'sellPrice',
      'pnl',
      'boughtTimestamp',
      'soldTimestamp',
      'duration'
    ];
    const csvContent = headers.join(',') + '\n';
    
    // Create a blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'tradovate_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-xl mx-auto p-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center",
          isDragging ? "border-primary bg-primary/10" : "border-gray-300",
          isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          disabled={isProcessing}
          id="csv-upload"
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-600">
              {isProcessing ? "Processing..." : "Drag & drop or click to upload CSV"}
            </p>
          </div>
        </label>
      </div>
      
      {/* Processing Stats Display */}
      {processingStats && (
        <div className="mt-4 p-4 border rounded-lg">
          <h3 className="font-medium mb-2">Processing Statistics</h3>
          <div className="space-y-1 text-sm">
            <p>Total rows: {processingStats.total}</p>
            <p>Processed: {processingStats.processed}</p>
            <p>Successfully uploaded: {processingStats.successful}</p>
            <p>Failed: {processingStats.failed}</p>
            
            {processingStats.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-destructive">Errors:</p>
                <ul className="list-disc pl-5 mt-1 text-xs text-destructive">
                  {processingStats.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="mt-4 flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={downloadTradovateTemplate}
          disabled={isProcessing}
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
      </div>
    </div>
  );
} 