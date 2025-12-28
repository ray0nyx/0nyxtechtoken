import { parse, ParseConfig, ParseResult } from 'papaparse';
import { preprocessTradovateRow } from './tradovate-utils';
import { createClient } from './supabase/client';
import { parse as parseDate, format, isValid } from 'date-fns';

// Interface for processed trade data
interface ProcessedTrade {
  symbol: string;
  date: string;
  qty: number;
  entry_price: number;
  exit_price: number;
  fees: number;
  pnl: number;
  entry_date: string | null;  // Make explicit
  exit_date: string | null;   // Make explicit
  duration?: string;          // Add duration field
  metadata?: Record<string, any>; // Allow additional fields as metadata
}

// Extend ParseConfig to include transformHeader
interface EnhancedParseConfig extends ParseConfig {
  transformHeader?: (header: string) => string;
}

// Extend ParseResult's meta property to include fields
interface EnhancedParseResult<T> extends ParseResult<T> {
  meta: {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
    fields?: string[];
  };
}

/**
 * Parse a date string using various formats with date-fns
 * @param dateStr The date string to parse
 * @returns A valid Date object or null if parsing fails
 */
function parseTimestamp(dateStr: string | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
    return null;
  }

  // Common date formats used in Tradovate exports
  const formats = [
    'yyyy-MM-dd HH:mm:ss',   // ISO-like: 2023-01-15 14:30:45
    'yyyy-MM-dd HH:mm',      // ISO-like without seconds
    'yyyy-MM-dd',            // ISO date only
    'MM/dd/yyyy HH:mm:ss',   // US format: 01/15/2023 14:30:45
    'MM/dd/yyyy HH:mm',      // US format without seconds
    'MM/dd/yyyy',            // US date only
    'MM-dd-yyyy HH:mm:ss',   // US with dashes
    'MM-dd-yyyy HH:mm',      // US with dashes, no seconds
    'MM-dd-yyyy',            // US date with dashes
    'MMM dd, yyyy HH:mm:ss', // Jan 15, 2023 14:30:45
    'MMM dd, yyyy',          // Jan 15, 2023
    'MMMM dd, yyyy',         // January 15, 2023
    'yyyy/MM/dd HH:mm:ss',   // Year first with slashes
    'yyyy/MM/dd'             // Year first date only
  ];

  // Try each format
  for (const formatStr of formats) {
    try {
      const parsedDate = parseDate(dateStr, formatStr, new Date());

      // Check if the date is valid
      if (isValid(parsedDate)) {
        return parsedDate;
      }
    } catch (error) {
      // Continue to next format if this one fails
      continue;
    }
  }

  // Last resort - try native Date parsing
  try {
    const nativeDate = new Date(dateStr);
    if (isValid(nativeDate)) {
      return nativeDate;
    }
  } catch (error) {
    // Ignore and fall through to return null
  }

  console.warn(`Failed to parse date: "${dateStr}" with any supported format`);
  return null;
}

/**
 * Get contract multiplier for futures contracts
 * @param symbol The contract symbol
 * @returns The multiplier for the contract
 */
function getContractMultiplier(symbol: string): number {
  // Normalize symbol to uppercase
  const normalizedSymbol = symbol.toUpperCase().trim();

  // Futures contract multipliers (tick-based)
  switch (normalizedSymbol) {
    // E-mini contracts (tick values)
    case 'NQ':  // E-mini NASDAQ-100: $5 per tick
      return 5.0;
    case 'ES':  // E-mini S&P 500: $12.50 per tick
    case 'RTY': // E-mini Russell 2000: $12.50 per tick
      return 12.5;
    case 'YM':  // E-mini Dow: $5 per tick
      return 5.0;

    // Micro contracts (1/10th size)
    case 'MNQ': // Micro NASDAQ-100: $0.50 per tick
      return 0.5;
    case 'MES': // Micro S&P 500: $1.25 per tick
    case 'M2K': // Micro Russell 2000: $1.25 per tick
      return 1.25;
    case 'MYM': // Micro Dow: $0.50 per tick
      return 0.5;

    // Energy contracts
    case 'CL': // Crude Oil
      return 1000.0;
    case 'NG': // Natural Gas
      return 10000.0;
    case 'GC': // Gold
      return 100.0;
    case 'SI': // Silver
      return 5000.0;

    // Currency futures
    case '6E': // Euro
      return 125000.0;
    case '6J': // Japanese Yen
      return 12500000.0;
    case '6B': // British Pound
      return 62500.0;

    // Default multiplier for unknown contracts
    default:
      return 1.0;
  }
}

/**
 * Calculate Tradovate fees based on the contract type and size
 * @param symbol The contract symbol
 * @param quantity The number of contracts
 * @returns The total fees for the trade (both entry and exit)
 */
function calculateTradovateFees(symbol: string, quantity: number): number {
  // Normalize the symbol to uppercase and remove any whitespace
  const normalizedSymbol = symbol.toUpperCase().trim();

  // Fee per side (multiply by 2 for round trip)
  let feePerContract: number;

  // E-mini contracts (full size) - higher commissions
  if (normalizedSymbol === 'NQ' || normalizedSymbol === 'ES' ||
    normalizedSymbol === 'RTY' || normalizedSymbol === 'YM') {
    feePerContract = 1.50; // $1.50 per side for E-mini contracts
  }
  // Micro contracts (1/10th size) - lower commissions
  else if (normalizedSymbol.startsWith('M') &&
    (normalizedSymbol === 'MNQ' || normalizedSymbol === 'MES' ||
      normalizedSymbol === 'M2K' || normalizedSymbol === 'MYM')) {
    feePerContract = 0.35; // $0.35 per side for Micro contracts
  }
  // Nano contracts and Event contracts
  else if (normalizedSymbol.startsWith('N') || normalizedSymbol.startsWith('E')) {
    feePerContract = 0.20;
  }
  // Default for other contracts
  else {
    feePerContract = 1.50; // Default to E-mini rate
  }

  // Calculate total fees (multiply by 2 for round trip - entry and exit)
  return Number((feePerContract * quantity * 2).toFixed(2));
}

/**
 * Processes a Tradovate CSV file and sends the data to the server
 * @param file The CSV file to process
 * @param userId The ID of the user uploading the file
 * @param accountId The ID of the account to associate with the trades
 * @returns A promise that resolves to the number of trades processed and daily summaries
 */
export async function processTradovateCSV(
  file: File,
  userId: string,
  accountId?: string
): Promise<{
  tradesProcessed: number;
  dailySummaries: any[];
  warnings?: string[];
  preprocess_errors?: any[]
}> {
  return new Promise((resolve, reject) => {
    try {
      // First check if the file is valid
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

      if (!file.name.toLowerCase().endsWith('.csv')) {
        reject(new Error('File must be a CSV'));
        return;
      }

      // Use FileReader to read the file content
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          if (!event.target || typeof event.target.result !== 'string') {
            reject(new Error('Failed to read file content'));
            return;
          }

          const fileContent = event.target.result;

          // Process the CSV content with robust error handling
          try {
            // Process the CSV content
            const processedTrades = processTradovateCSVContent(fileContent);

            // Send the processed trades to the server
            const result = await sendTradovateData(userId, accountId || null, processedTrades);

            resolve({
              tradesProcessed: processedTrades.length,
              dailySummaries: result.data?.daily_summaries || [],
              warnings: result.data?.warnings || [],
              preprocess_errors: result.data?.preprocess_errors || []
            });
          } catch (error) {
            console.error('Error in CSV processing:', error);

            if (error instanceof Error &&
              (error.message.includes('meta') || error.message.includes('undefined'))) {
              // This is likely the 'Cannot read properties of undefined (reading 'meta')' error
              reject(new Error('CSV parsing failed. The file might be corrupt or have an invalid format. Try resaving it with a spreadsheet application.'));
            } else {
              reject(error);
            }
          }
        } catch (error) {
          console.error('Error processing file content:', error);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read the file'));
      };

      // Read the file as text
      reader.readAsText(file);
    } catch (error) {
      console.error('Unexpected error in processTradovateCSV:', error);
      reject(error);
    }
  });
}

/**
 * Processes a Tradovate CSV content to extract trade data
 * @param content The CSV content
 * @returns An array of processed trades
 */
export function processTradovateCSVContent(content: string): ProcessedTrade[] {
  try {
    // Parse the CSV file
    const parsed = parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Standardize headers by removing quotes and whitespace
        return header.replace(/['"]+/g, '').trim();
      }
    } as EnhancedParseConfig) as EnhancedParseResult<Record<string, any>>;

    console.log('CSV parsing complete. Found columns:', parsed.meta.fields);
    console.log('First row of data:', parsed.data[0]);

    // Log all available columns for debugging
    if (parsed.data[0]) {
      console.log('Available fields in the first row:');
      const firstRow = parsed.data[0] as Record<string, any>;
      for (const key in firstRow) {
        console.log(`Field "${key}": ${firstRow[key]}`);
      }
    }

    // Preprocess each row
    const processedRows = parsed.data.map((row: any) => preprocessTradovateRow(row));

    // Filter out rows with missing required fields
    const validRows = processedRows.filter(row => {
      // Check if all required fields are present and valid
      const hasRequiredFields =
        !!row.symbol &&
        row.qty !== undefined && !isNaN(Number(row.qty)) && Number(row.qty) !== 0 &&
        (row.entry_price !== undefined) &&
        (row.exit_price !== undefined);

      if (!hasRequiredFields) {
        const missingFields: string[] = [];
        if (!row.symbol) missingFields.push('symbol');
        if (row.qty === undefined || isNaN(Number(row.qty)) || Number(row.qty) === 0) missingFields.push('qty');
        if (row.entry_price === undefined) missingFields.push('entry_price');
        if (row.exit_price === undefined) missingFields.push('exit_price');

        console.error(`Row missing required fields: ${missingFields.join(', ')}`, row);
      }

      return hasRequiredFields;
    });

    // Check if we have any valid rows
    if (validRows.length === 0) {
      console.error('No valid rows found after filtering. Raw data sample:',
        parsed.data.slice(0, 3));
      throw new Error('Missing required fields in all trade data');
    }

    // Convert to the expected format
    const result = validRows.map(row => {
      // Parse timestamps using date-fns for reliable parsing
      const boughtTimestampDate = parseTimestamp(row.boughtTimestamp);
      const soldTimestampDate = parseTimestamp(row.soldTimestamp);

      // Format timestamps to ISO strings when valid
      const boughtTimestamp = boughtTimestampDate ? format(boughtTimestampDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") : null;
      const soldTimestamp = soldTimestampDate ? format(soldTimestampDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") : null;

      // Calculate duration if both timestamps exist
      let duration = null;
      if (boughtTimestampDate && soldTimestampDate) {
        // Get the duration in seconds for database storage
        const durationMs = Math.abs(soldTimestampDate.getTime() - boughtTimestampDate.getTime());
        const durationSeconds = Math.floor(durationMs / 1000);
        duration = `${durationSeconds} seconds`;
      } else if (row.duration) {
        duration = row.duration;
      }

      // Determine which timestamp to use as entry and exit based on trade direction
      let entryDate = boughtTimestamp;
      let exitDate = soldTimestamp;

      if (boughtTimestampDate && soldTimestampDate) {
        const boughtTime = boughtTimestampDate.getTime();
        const soldTime = soldTimestampDate.getTime();

        // For short trades, entry is the sold timestamp and exit is the bought timestamp
        if (boughtTime > soldTime) {
          entryDate = soldTimestamp;
          exitDate = boughtTimestamp;
          console.log('Detected short trade, swapping entry/exit dates');
        }
      }

      // Derive the primary date (prefer exit date, fall back to entry date, then row date)
      let primaryDate = "";

      if (exitDate) {
        // Use exit date as primary date when available (most trades are completed)
        const exitDateObj = new Date(exitDate);
        primaryDate = format(exitDateObj, 'yyyy-MM-dd');
      } else if (entryDate) {
        // Fall back to entry date
        const entryDateObj = new Date(entryDate);
        primaryDate = format(entryDateObj, 'yyyy-MM-dd');
      } else if (row.date) {
        // Fall back to any provided date field
        const rowDateObj = parseTimestamp(row.date);
        if (rowDateObj) {
          primaryDate = format(rowDateObj, 'yyyy-MM-dd');
        } else {
          // Last resort - use current date
          primaryDate = format(new Date(), 'yyyy-MM-dd');
        }
      } else {
        // Very last resort - use current date
        primaryDate = format(new Date(), 'yyyy-MM-dd');
      }

      // Handle fees
      let fees = 0;
      if (row.isPerformanceExport) {
        // Performance exports don't include fees, so keep it at 0
        fees = 0;
      } else if (typeof row.fees === 'number' || (typeof row.fees === 'string' && row.fees.trim() !== '')) {
        // Use provided fees if available and valid
        fees = typeof row.fees === 'number' ? row.fees : parseFloat(row.fees);
        if (isNaN(fees)) {
          fees = 0;
        }
      } else {
        // Calculate fees based on contract type when not available
        fees = calculateTradovateFees(row.symbol, row.qty);
      }

      // Ensure all numeric values are actually numbers for the database
      const entry_price = typeof row.entry_price === 'number' ? row.entry_price : parseFloat(String(row.entry_price));
      const exit_price = typeof row.exit_price === 'number' ? row.exit_price : parseFloat(String(row.exit_price));

      // Calculate PnL using futures contract multiplier
      let pnl = 0;
      if (typeof row.pnl === 'number' && !isNaN(row.pnl)) {
        pnl = row.pnl;
      } else if (row.pnl && String(row.pnl).trim() !== '') {
        pnl = parseFloat(String(row.pnl));
      } else {
        // Calculate PnL if not provided
        const multiplier = getContractMultiplier(row.symbol);
        const priceDiff = entry_price - exit_price; // This will be corrected by the database function
        pnl = priceDiff * row.qty * multiplier - fees;
      }

      // For debugging - print values to console
      console.log('Creating trade with timestamps:', {
        boughtTimestamp,
        soldTimestamp,
        entryDate,
        exitDate,
        primaryDate
      });

      // Final trade object
      return {
        symbol: row.symbol,
        date: primaryDate,
        qty: row.qty,
        entry_price: isNaN(entry_price) ? 0 : entry_price,
        exit_price: isNaN(exit_price) ? 0 : exit_price,
        fees: fees,
        pnl: isNaN(pnl) ? 0 : pnl,
        entry_date: entryDate,
        exit_date: exitDate,
        duration: duration,
        // Include any additional fields as metadata
        metadata: {
          buyFillId: row.buyFillId,
          sellFillId: row.sellFillId,
          boughtTimestamp: boughtTimestamp,
          soldTimestamp: soldTimestamp,
          duration: row.duration || duration,
          original: { ...row } // Store the original row data
        }
      };
    });

    console.log(`Successfully processed ${result.length} rows from CSV`);
    console.log('Sample processed row:', result[0]);
    return result;
  } catch (error) {
    console.error('Error processing CSV content:', error);
    throw error;
  }
}

/**
 * Sends processed Tradovate data to the server
 * @param userId The ID of the user
 * @param accountId The ID of the account to associate with the trades
 * @param trades The processed trades
 * @returns A promise that resolves to the result of the server operation
 */
export async function sendTradovateData(
  userId: string,
  accountId: string | null,
  trades: ProcessedTrade[]
) {
  try {
    const supabase = createClient();
    console.log(`Sending ${trades.length} processed trades to server for user ${userId}`);

    // Important: Log the first trade's entry_date and exit_date to verify they're being sent correctly
    if (trades.length > 0) {
      console.log('IMPORTANT - First trade timestamp data:', {
        entry_date: trades[0].entry_date,
        exit_date: trades[0].exit_date,
        symbol: trades[0].symbol,
        // Also include the raw timestamps from metadata
        raw_bought: trades[0].metadata?.boughtTimestamp,
        raw_sold: trades[0].metadata?.soldTimestamp
      });
    }

    // IMPORTANT NOTE: For Tradovate CSV imports, these entry_date and exit_date values
    // should be used directly in the database, NOT overridden with created_at timestamps.

    // Call the Supabase function
    const { data, error } = await supabase.rpc('process_tradovate_csv_batch_simple', {
      p_user_id: userId,
      p_rows: trades,
      p_account_id: accountId
    });

    if (error) {
      console.error('Error processing trades on server:', error);
      throw new Error(`Server error: ${error.message}`);
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in sendTradovateData:', error);
    throw error;
  }
}

/**
 * Process a batch of Tradovate CSV data
 * @param userId The user ID
 * @param accountId The account ID or null
 * @param csvContent The CSV content as a string
 * @returns A promise that resolves to the result of the server operation
 */
export async function processTradovateCSVBatch(
  userId: string,
  accountId: string | null,
  content: string
) {
  try {
    // Process the CSV content
    const processedTrades = processTradovateCSVContent(content);

    // Send the processed trades to the server
    return await sendTradovateData(userId, accountId, processedTrades);
  } catch (error) {
    console.error('Failed to process Tradovate CSV batch:', error);
    throw error;
  }
} 