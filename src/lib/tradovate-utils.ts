import { cleanMonetaryValue, parsePnL } from './formatters';

interface TradovateRow {
  symbol?: string;
  date?: string;
  qty?: string;
  entry_price?: string;
  exit_price?: string;
  fees?: string;
  pnl?: string;
  buyFillId?: string;
  sellFillId?: string;
  boughtTimestamp?: string;
  soldTimestamp?: string;
  duration?: string;
  [key: string]: any;
}

interface ProcessedRow {
  symbol: string;
  date?: string;
  qty: number;
  entry_price: number | string;
  exit_price: number | string;
  fees: number | string;
  pnl: number | string;
  buyFillId?: string;
  sellFillId?: string;
  boughtTimestamp?: string;
  soldTimestamp?: string;
  duration?: string;
  isPerformanceExport?: boolean;
}

/**
 * Attempts to find price-related fields in a CSV row object
 * @param row The raw CSV row object
 * @returns An object containing the detected entry_price and exit_price
 */
function detectPriceFields(row: Record<string, any>): { entry_price?: string, exit_price?: string } {
  const result: { entry_price?: string, exit_price?: string } = {};
  
  // List of potential field names for prices, in order of preference
  const entryPricePatterns = [
    /^(entry_?price|entry_?px|buy_?price|buy_?px)$/i,
    /^(avg_?price|avg_?px|average_?price|average_?px)$/i,
    /^(fill_?price|fill_?px|execution_?price|execution_?px)$/i,
    /^(price|px)$/i
  ];
  
  const exitPricePatterns = [
    /^(exit_?price|exit_?px|sell_?price|sell_?px)$/i,
    /^(close_?price|close_?px|closing_?price|closing_?px)$/i
  ];
  
  // Find the entry price
  for (const pattern of entryPricePatterns) {
    for (const field in row) {
      if (pattern.test(field) && row[field] !== undefined && row[field] !== null && row[field] !== '') {
        result.entry_price = row[field];
        console.log(`Detected entry_price from field "${field}": ${row[field]}`);
        break;
      }
    }
    if (result.entry_price) break;
  }
  
  // Find the exit price
  for (const pattern of exitPricePatterns) {
    for (const field in row) {
      if (pattern.test(field) && row[field] !== undefined && row[field] !== null && row[field] !== '') {
        result.exit_price = row[field];
        console.log(`Detected exit_price from field "${field}": ${row[field]}`);
        break;
      }
    }
    if (result.exit_price) break;
  }
  
  // If no exit price was found but entry price was, use the entry price for both
  if (!result.exit_price && result.entry_price) {
    result.exit_price = result.entry_price;
    console.log(`Using entry_price as exit_price: ${result.entry_price}`);
  }
  
  // Handle Tradovate-specific price formats
  const specialFields = [
    'avgPx', 'AvgPx', 'FillPrice', 'fillPrice', 'Price', 'price', 'Px', 'px',
    'LastTradePrice', 'lastPrice', 'trade_price', 'Cost', 'cost', 
    'Price1', 'Price2', 'TradePrice', 'PriceIn', 'PriceOut'
  ];
  
  // If we still don't have prices, try the special fields
  if (!result.entry_price || !result.exit_price) {
    for (const field of specialFields) {
      if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
        if (!result.entry_price) {
          result.entry_price = row[field];
          console.log(`Using special field "${field}" for entry_price: ${row[field]}`);
        }
        if (!result.exit_price) {
          result.exit_price = row[field];
          console.log(`Using special field "${field}" for exit_price: ${row[field]}`);
        }
        if (result.entry_price && result.exit_price) break;
      }
    }
  }
  
  return result;
}

/**
 * Safely tries to convert a monetary value to a number, cleaning it first
 * Logs detailed information in case of failure to help debug format issues
 * Returns the original string if numeric conversion fails, to let the server handle it
 */
function safeMonetaryValue(field: string, value: string | null | undefined): number | string {
  try {
    if (value === null || value === undefined || value === '') {
      // Return 0 for missing monetary values
      return 0;
    }
    
    console.log(`Processing ${field}: "${value}"`);
    
    // For monetary fields, always clean dollar signs and other currency symbols
    // This fixes the "invalid input syntax for type numeric: '$52.50'" error
    if (typeof value === 'string') {
      // Always clean monetary values for database insertion
      const result = cleanMonetaryValue(value);
      
      // If we got NaN or an unexpected zero, log it for debugging
      if (isNaN(result) || (value !== '0' && value !== '0.00' && value !== '$0' && value !== '$0.00' && result === 0)) {
        console.warn(`Warning: ${field} value "${value}" converted to ${result}`);
        
        // For PnL specifically, make an extra effort to clean it to prevent database errors
        if (field === 'pnl') {
          // Try a more aggressive cleaning for PnL values
          const cleanedValue = value.replace(/[$,\s()]/g, '').replace(/^-+/, '-');
          const parsedValue = parseFloat(cleanedValue);
          if (!isNaN(parsedValue)) {
            console.log(`Successfully recovered PnL value "${value}" as ${parsedValue}`);
            return parsedValue;
          }
        }
        
        // For non-PnL fields or if PnL cleaning failed, return a safe default value
        return field === 'pnl' ? 0 : value;
      }
      
      return result;
    }
    
    return value;
  } catch (error) {
    console.error(`Error processing ${field}:`, value, error);
    // If processing fails, return 0 for pnl to avoid database errors
    return field === 'pnl' ? 0 : (value || 0);
  }
}

/**
 * Preprocesses a row from Tradovate CSV, cleaning monetary values
 * @param row The raw row from the CSV
 * @returns The processed row with cleaned values
 */
export function preprocessTradovateRow(row: TradovateRow): ProcessedRow {
  // Deep copy the row first to avoid mutating the original
  const processedRow = { ...row };
  
  // Check if this is a Performance.csv export (which has different fields)
  const isPerformanceExport = 
    ('Net P&L' in processedRow) || 
    ('Net P/L' in processedRow) || 
    ('Net_PL' in processedRow) ||
    (processedRow.Report && processedRow.Report.includes('Performance'));
  
  // Try to map column names from different possible formats
  // This handles case sensitivity and different naming conventions
  const mappings = {
    symbol: ['symbol', 'Symbol', 'SYMBOL', 'contract', 'Contract', 'product', 'Product', 'Name', 'ContractName', 'Contract Name'],
    date: ['date', 'Date', 'DATE', 'tradeDate', 'TradeDate', 'trade_date', 'Trade Date', 'Day', 'day', 'fillDate', 'FillDate'],
    qty: ['qty', 'Qty', 'QTY', 'quantity', 'Quantity', 'filledQty', 'FilledQty', 'filled_qty', 'Filled Qty', 'Size', 'size', 'Volume', 'volume'],
    entry_price: ['entry_price', 'entryPrice', 'EntryPrice', 'buyPrice', 'BuyPrice', 'buy_price', 'Buy Price', 'avgPrice', 'AvgPrice', 'avgPx', 'AvgPx'],
    exit_price: ['exit_price', 'exitPrice', 'ExitPrice', 'sellPrice', 'SellPrice', 'sell_price', 'Sell Price', 'closingPrice', 'ClosingPrice'],
    fees: ['fees', 'Fees', 'FEES', 'commission', 'Commission', 'commissions', 'Commissions', 'Fee', 'fee'],
    pnl: ['pnl', 'Pnl', 'PNL', 'P&L', 'p&l', 'profit', 'Profit', 'profit_loss', 'Profit/Loss', 'Net', 'net', 'NetPL', 'netPL', 'Net P&L', 'Net P/L'],
    boughtTimestamp: ['boughtTimestamp', 'BoughtTimestamp', 'bought_timestamp', 'Bought Timestamp', 'buyTime', 'BuyTime', 'buy_time', 'Buy Time', 'Fill Time'],
    soldTimestamp: ['soldTimestamp', 'SoldTimestamp', 'sold_timestamp', 'Sold Timestamp', 'sellTime', 'SellTime', 'sell_time', 'Sell Time', 'Exit Time']
  };
  
  // Create a normalized row with standard field names
  const normalizedRow: any = {};
  
  // Process each field with its possible mappings
  for (const [standardField, possibleNames] of Object.entries(mappings)) {
    // Find the first matching field name that exists in the row
    const matchingField = possibleNames.find(name => 
      processedRow[name] !== undefined && processedRow[name] !== null && processedRow[name] !== ''
    );
    
    if (matchingField) {
      normalizedRow[standardField] = processedRow[matchingField];
      console.log(`Mapped ${matchingField} to ${standardField}: ${normalizedRow[standardField]}`);
    } else {
      console.warn(`Could not find a value for ${standardField} in row:`, processedRow);
    }
  }
  
  // Preserve raw timestamps
  const rawBoughtTimestamp = normalizedRow.boughtTimestamp || row.boughtTimestamp || '';
  const rawSoldTimestamp = normalizedRow.soldTimestamp || row.soldTimestamp || '';
  
  // Set raw timestamps without formatting
  normalizedRow.boughtTimestamp = rawBoughtTimestamp;
  normalizedRow.soldTimestamp = rawSoldTimestamp;
  
  // Always include other common fields
  if (processedRow.buyFillId) normalizedRow.buyFillId = processedRow.buyFillId;
  if (processedRow.sellFillId) normalizedRow.sellFillId = processedRow.sellFillId;
  if (processedRow.duration) normalizedRow.duration = processedRow.duration;
  
  // Try to detect price fields if they're missing
  if (!normalizedRow.entry_price || !normalizedRow.exit_price) {
    const detectedPrices = detectPriceFields(processedRow);
    if (detectedPrices.entry_price && !normalizedRow.entry_price) {
      normalizedRow.entry_price = detectedPrices.entry_price;
    }
    if (detectedPrices.exit_price && !normalizedRow.exit_price) {
      normalizedRow.exit_price = detectedPrices.exit_price;
    }
  }
  
  // If we still don't have exit_price but have entry_price, use entry_price for both
  if (!normalizedRow.exit_price && normalizedRow.entry_price) {
    normalizedRow.exit_price = normalizedRow.entry_price;
    console.log('Using entry_price for exit_price:', normalizedRow.entry_price);
  }
  
  // Clean up the symbol
  const symbol = normalizedRow.symbol || 'Unknown';

  // Convert quantity to number
  const quantity = parseInt(normalizedRow.qty, 10) || 1;

  // Instead of calculating fees here, we'll pass through any existing fee values
  // If it's a Performance export, default to 0
  const fees = isPerformanceExport ? 0 : (normalizedRow.fees !== undefined ? safeMonetaryValue('fees', normalizedRow.fees) : 0);

  // Basic result with all values
  const result = {
    symbol,
    date: normalizedRow.date, // We'll handle date formatting in the processor
    qty: quantity,
    entry_price: safeMonetaryValue('entry_price', normalizedRow.entry_price),
    exit_price: safeMonetaryValue('exit_price', normalizedRow.exit_price),
    fees: fees,
    pnl: normalizedRow.pnl ? parsePnL(normalizedRow.pnl) : 0,
    buyFillId: normalizedRow.buyFillId,
    sellFillId: normalizedRow.sellFillId,
    boughtTimestamp: normalizedRow.boughtTimestamp, // Keep raw timestamp
    soldTimestamp: normalizedRow.soldTimestamp,     // Keep raw timestamp
    duration: normalizedRow.duration,
    isPerformanceExport: isPerformanceExport
  };
  
  // For debugging, log any NaN or zero values that should probably be non-zero
  const numericKeys = ['entry_price', 'exit_price', 'fees', 'pnl'];
  for (const key of numericKeys) {
    const value = result[key as keyof ProcessedRow];
    if (typeof value === 'number' && isNaN(value)) {
      console.warn(`Warning: Invalid numeric value detected for ${key}: ${value}`, normalizedRow[key]);
    }
  }
  
  // Add basic validation
  if (!result.symbol) {
    console.error('Row missing symbol:', processedRow);
  }
  
  if (!result.qty || result.qty === 0) {
    console.error('Row missing quantity:', processedRow);
  }
  
  console.log('Processed row result:', result);
  return result;
}

// This function is kept for backward compatibility
export async function processTradovateBatch(
  userId: string, 
  accountId: string, 
  rows: TradovateRow[]
) {
  throw new Error('This function is deprecated. Use the function in tradovate-processor.ts instead.');
} 