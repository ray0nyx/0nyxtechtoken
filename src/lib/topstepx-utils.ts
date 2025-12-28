import { cleanMonetaryValue } from './formatters';
import { supabase } from './supabase';

interface TopstepXRow {
  // Core fields with various possible naming conventions
  ContractName?: string;
  Symbol?: string;
  contract_name?: string;
  symbol?: string;
  
  // Date/time fields
  EnteredAt?: string;
  EntryTime?: string;
  entered_at?: string;
  entry_time?: string;
  
  ExitedAt?: string;
  ExitTime?: string;
  exited_at?: string;
  exit_time?: string;
  
  // Price fields
  EntryPrice?: string;
  entry_price?: string;
  Entry?: string;
  
  ExitPrice?: string;
  exit_price?: string;
  Exit?: string;
  
  // Fee fields
  Fees?: string;
  fees?: string;
  Commission?: string;
  commission?: string;
  
  // P&L fields
  PnL?: string;
  pnl?: string;
  Profit?: string;
  profit?: string;
  P_L?: string;
  
  // Size/quantity fields
  Size?: string;
  size?: string;
  Quantity?: string;
  quantity?: string;
  Qty?: string;
  qty?: string;
  
  // Position/type fields
  Type?: string;
  type?: string;
  Direction?: string;
  direction?: string;
  Position?: string;
  position?: string;
  
  // Date fields
  TradeDay?: string;
  trade_day?: string;
  Date?: string;
  date?: string;
  
  // Duration fields
  TradeDuration?: string;
  trade_duration?: string;
  Duration?: string;
  duration?: string;
  
  [key: string]: any;
}

interface ProcessedTopstepXRow {
  contract_name: string;
  entered_at: string;
  exited_at: string;
  entry_price: number;
  exit_price: number;
  fees: number;
  pnl: number;
  size: number;
  type: string;
  trade_day: string;
  trade_duration: number;
  user_id: string;
  account_id: string;
  platform: 'topstepx';
  created_at: string;
  updated_at: string;
  original_data?: Record<string, any>; // Add original data field to store raw CSV data
}

// Error interface for tracking issues
interface ProcessingError {
  row: number;
  error: string;
  data: TopstepXRow;
}

/**
 * Process a TopstepX row, extracting data and cleaning monetary values with enhanced error handling
 * @param row The raw TopstepX CSV row
 * @param userId The user ID
 * @param accountId The account ID
 * @returns The processed row
 */
export function preprocessTopstepXRow(
  row: TopstepXRow, 
  userId: string, 
  accountId: string,
  index: number
): ProcessedTopstepXRow {
  // Store original row data to help with debugging
  const originalData = { ...row };
  
  // Extract the contract name (symbol) with detailed error handling
  const contractName = row.ContractName || row.Symbol || row.contract_name || row.symbol || '';
  if (!contractName) {
    throw new Error(`Row ${index + 1}: Missing contract name/symbol. Please ensure the CSV has a column named 'ContractName', 'Symbol', or similar.`);
  }
  
  // Extract timestamps
  const enteredAt = row.EnteredAt || row.EntryTime || row.entered_at || row.entry_time || '';
  if (!enteredAt) {
    throw new Error(`Row ${index + 1}: Missing entry time for ${contractName}. Please ensure the CSV has a column named 'EnteredAt', 'EntryTime', or similar.`);
  }
  
  const exitedAt = row.ExitedAt || row.ExitTime || row.exited_at || row.exit_time || '';
  if (!exitedAt) {
    throw new Error(`Row ${index + 1}: Missing exit time for ${contractName}. Please ensure the CSV has a column named 'ExitedAt', 'ExitTime', or similar.`);
  }
  
  // Extract prices with error checking
  const entryPriceStr = row.EntryPrice || row.entry_price || row.Entry || '';
  if (!entryPriceStr) {
    throw new Error(`Row ${index + 1}: Missing entry price for ${contractName}. Please ensure the CSV has a column named 'EntryPrice', 'entry_price', or similar.`);
  }
  
  const exitPriceStr = row.ExitPrice || row.exit_price || row.Exit || '';
  if (!exitPriceStr) {
    throw new Error(`Row ${index + 1}: Missing exit price for ${contractName}. Please ensure the CSV has a column named 'ExitPrice', 'exit_price', or similar.`);
  }
  
  // Format dates properly
  let entryDate: Date;
  let exitDate: Date;
  let tradeDayDate: Date;
  
  try {
    entryDate = new Date(enteredAt);
    if (isNaN(entryDate.getTime())) {
      throw new Error(`Invalid date format: "${enteredAt}". Use YYYY-MM-DD HH:MM:SS format.`);
    }
  } catch (e) {
    throw new Error(`Row ${index + 1}: Unable to parse entry date: "${enteredAt}". Make sure dates are in YYYY-MM-DD HH:MM:SS format.`);
  }
  
  try {
    exitDate = new Date(exitedAt);
    if (isNaN(exitDate.getTime())) {
      throw new Error(`Invalid date format: "${exitedAt}". Use YYYY-MM-DD HH:MM:SS format.`);
    }
  } catch (e) {
    throw new Error(`Row ${index + 1}: Unable to parse exit date: "${exitedAt}". Make sure dates are in YYYY-MM-DD HH:MM:SS format.`);
  }
  
  // Extract trade day (default to entry date)
  const tradeDay = row.TradeDay || row.trade_day || row.Date || row.date || '';
  if (tradeDay) {
    try {
      tradeDayDate = new Date(tradeDay);
      if (isNaN(tradeDayDate.getTime())) {
        tradeDayDate = entryDate; // Fallback to entry date
      }
    } catch (e) {
      tradeDayDate = entryDate; // Fallback to entry date
    }
  } else {
    tradeDayDate = entryDate; // Fallback to entry date
  }
  
  // Extract trade type/position
  const typeStr = row.Type || row.type || row.Direction || row.direction || row.Position || row.position || 'long';
  const type = typeStr.toLowerCase().includes('short') ? 'short' : 'long';
  
  // Extract and clean numeric values with error handling
  let entryPrice: number;
  try {
    entryPrice = cleanMonetaryValue(entryPriceStr);
    if (isNaN(entryPrice) || entryPrice <= 0) {
      throw new Error(`Invalid entry price: "${entryPriceStr}". Must be a positive number.`);
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
    throw new Error(`Row ${index + 1}: ${errorMessage}`);
  }
  
  let exitPrice: number;
  try {
    exitPrice = cleanMonetaryValue(exitPriceStr);
    if (isNaN(exitPrice) || exitPrice <= 0) {
      throw new Error(`Invalid exit price: "${exitPriceStr}". Must be a positive number.`);
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
    throw new Error(`Row ${index + 1}: ${errorMessage}`);
  }
  
  // Clean fees or use default
  let fees: number;
  const feesStr = row.Fees || row.fees || row.Commission || row.commission;
  if (feesStr) {
    try {
      fees = cleanMonetaryValue(feesStr);
      if (isNaN(fees)) fees = 2.50;
    } catch (e) {
      fees = 2.50; // Default if parsing fails
    }
  } else {
    fees = 2.50; // Default if not provided
  }
  
  // Extract P&L
  let pnl: number | null = null;
  const pnlStr = row.PnL || row.pnl || row.Profit || row.profit || row.P_L;
  if (pnlStr) {
    try {
      pnl = cleanMonetaryValue(pnlStr);
      if (isNaN(pnl)) pnl = null;
    } catch (e) {
      pnl = null; // Will be calculated later
    }
  }
  
  // Extract size
  let size: number;
  const sizeStr = row.Size || row.size || row.Quantity || row.quantity || row.Qty || row.qty || '1';
  try {
    size = parseInt(sizeStr, 10);
    if (isNaN(size) || size <= 0) size = 1;
  } catch (e) {
    size = 1; // Default
  }
  
  // Extract duration
  let duration: number;
  const durationStr = row.TradeDuration || row.trade_duration || row.Duration || row.duration || '0';
  try {
    duration = parseInt(durationStr, 10);
    if (isNaN(duration)) duration = 0;
  } catch (e) {
    duration = 0; // Default
  }
  
  // Return the processed row
  return {
    contract_name: contractName,
    entered_at: entryDate.toISOString(),
    exited_at: exitDate.toISOString(),
    entry_price: entryPrice,
    exit_price: exitPrice,
    fees,
    pnl: (pnl !== null ? pnl : (type === 'long' ? (exitPrice - entryPrice) * size : (entryPrice - exitPrice) * size)) - fees,
    size,
    type,
    trade_day: tradeDayDate.toISOString(),
    trade_duration: duration,
    user_id: userId,
    account_id: accountId,
    platform: 'topstepx',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    original_data: originalData
  };
}

/**
 * Process a batch of TopstepX CSV rows
 * @param rows The raw CSV rows
 * @param userId The user ID
 * @param accountId The account ID (optional)
 * @returns The result of the batch processing
 */
export async function processTopstepXBatch(
  rows: TopstepXRow[],
  userId: string,
  accountId: string | null
) {
  const validTrades: ProcessedTopstepXRow[] = [];
  const errors: ProcessingError[] = [];
  const warningLogs: string[] = [];

  // Keep track of skipped rows
  let skippedCount = 0;
  let processedCount = 0;

  // Log detailed column information for the first row to help debugging
  if (rows.length > 0) {
    const firstRow = rows[0];
    const columnNames = Object.keys(firstRow);
    console.log('CSV columns detected:', columnNames);
    console.log('CSV sample row data:', JSON.stringify(firstRow, null, 2));
    warningLogs.push(`CSV contains columns: ${columnNames.join(', ')}`);
    
    // Check for common TopstepX column name variations
    const hasContractName = columnNames.some(col => 
      /contract|symbol/i.test(col)
    );
    const hasEntryTime = columnNames.some(col => 
      /entered|entry.*time|entry.*at/i.test(col)
    );
    const hasExitTime = columnNames.some(col => 
      /exited|exit.*time|exit.*at/i.test(col)
    );
    const hasEntryPrice = columnNames.some(col => 
      /entry.*price|entry$/i.test(col)
    );
    const hasExitPrice = columnNames.some(col => 
      /exit.*price|exit$/i.test(col)
    );
    
    console.log('CSV format check:', {
      hasContractName,
      hasEntryTime,
      hasExitTime,
      hasEntryPrice,
      hasExitPrice,
      allRequiredFieldsPresent: hasContractName && hasEntryTime && hasExitTime && hasEntryPrice && hasExitPrice
    });
    
    if (!hasContractName || !hasEntryTime || !hasExitTime || !hasEntryPrice || !hasExitPrice) {
      warningLogs.push('WARNING: Some expected columns may be missing. TopstepX may have changed their CSV format.');
      warningLogs.push(`Missing columns: ${[
        !hasContractName && 'ContractName/Symbol',
        !hasEntryTime && 'EnteredAt/EntryTime',
        !hasExitTime && 'ExitedAt/ExitTime',
        !hasEntryPrice && 'EntryPrice',
        !hasExitPrice && 'ExitPrice'
      ].filter(Boolean).join(', ')}`);
    }
  }

  for (let index = 0; index < rows.length; index++) {
    try {
      // Process each row with detailed error tracking
      const processedRow = preprocessTopstepXRow(rows[index], userId, accountId || '', index);
      validTrades.push(processedRow);
      processedCount++;
    } catch (error) {
      skippedCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error processing row ${index + 1}:`, errorMessage);
      errors.push({
        row: index + 1,
        error: errorMessage,
        data: rows[index] // Include the row data for debugging
      });
    }
  }

  if (validTrades.length === 0) {
    // Detailed error analysis for troubleshooting
    let errorSummary = 'No valid trades could be processed from the CSV.';
    
    // Check for common issues
    if (rows.length === 0) {
      errorSummary += ' The CSV file appears to be empty.';
    } else if (errors.length > 0) {
      // Analyze errors for patterns
      const missingColumnErrors = errors.filter(e => e.error.includes('Missing') || e.error.includes('column')).length;
      const dateFormatErrors = errors.filter(e => e.error.includes('date') || e.error.includes('format')).length;
      const numericErrors = errors.filter(e => e.error.includes('price') || e.error.includes('numeric')).length;
      
      if (missingColumnErrors > 0) {
        errorSummary += ` ${missingColumnErrors} rows had missing or incorrectly named columns.`;
      }
      if (dateFormatErrors > 0) {
        errorSummary += ` ${dateFormatErrors} rows had date format issues.`;
      }
      if (numericErrors > 0) {
        errorSummary += ` ${numericErrors} rows had numeric value issues.`;
      }
      
      // Include first error for better diagnostics
      if (errors[0]) {
        errorSummary += ` First error: ${errors[0].error}`;
      }
    }
    
    throw new Error(errorSummary);
  }
  
  console.log(`Successfully processed ${validTrades.length} trades, skipped ${skippedCount} rows with errors`);
  
  if (skippedCount > 0 && skippedCount < rows.length) {
    warningLogs.push(`${skippedCount} out of ${rows.length} rows were skipped due to formatting issues.`);
  }
  
  // Call the database function with the trade data
  console.log('Sending RPC request with parameters:', {
    userId,
    rowsCount: validTrades.length,
    accountId: accountId || null,
    sampleRow: validTrades.length > 0 ? JSON.stringify(validTrades[0]).substring(0, 100) + '...' : 'No rows'
  });
  
  try {
    // Developer IDs that should have full access
    const DEVELOPER_IDS = [
      '856950ff-d638-419d-bcf1-b7dac51d1c7f', // rayhan@arafatcapital.com
      '8538e0b7-6dcd-4673-b39f-00d273c7fc76'  // sevemadsen18@gmail.com
    ];
    
    // Check if userId is a developer - developers can bypass auth checks
    const isDeveloper = userId && DEVELOPER_IDS.includes(userId);
    
    if (isDeveloper) {
      // Developers can proceed - database function will still verify but allow developers
    }
    
    // Verify user is authenticated before making RPC call
    // Try getSession first (faster and more reliable)
    let authUser = null;
    let authError = null;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        authUser = session.user;
      }
    } catch (sessionError) {
      // Silent fail, will try getUser
    }
    
    // Fallback to getUser if session didn't work
    if (!authUser) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (user && !error) {
          authUser = user;
        } else {
          authError = error;
        }
      } catch (getUserError: any) {
        authError = getUserError;
      }
    }
    
    if (authError || !authUser) {
      // Developers can bypass authentication errors
      if (isDeveloper) {
        // Continue without authUser - database function will verify but allow developers
      } else if (userId) {
        // Regular users: if we have userId, proceed but database will verify
      } else {
        throw new Error(`Authentication failed: ${authError?.message || 'No authenticated user and no userId provided'}`);
      }
    }
    
    // Verify userId matches authenticated user (unless developer) - only if we have authUser
    if (authUser && authUser.id !== userId && !isDeveloper) {
      // For non-developers, this is a warning but we'll let the database function handle it
    }
    
    // Send the RPC request with retry logic for connection errors
    let data, error;
    let lastError: any = null;
    const maxRetries = 3;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`RPC attempt ${attempt + 1}/${maxRetries}: Calling process_topstepx_csv_batch`, {
          userId,
          rowsCount: validTrades.length
        });
        
        const result = await supabase.rpc(
          'process_topstepx_csv_batch',
          {
            p_user_id: userId,
            p_rows: validTrades,  // Don't stringify - Supabase handles JSON conversion
            p_account_id: null    // Always use null for account_id to force auto-creation
          }
        );
        
        console.log(`RPC attempt ${attempt + 1} result:`, {
          hasData: !!result.data,
          hasError: !!result.error,
          data: result.data,
          error: result.error
        });
        
        data = result.data;
        error = result.error;
        lastError = error;
        
        // Check if the response indicates success even if there's no error object
        // The database function returns success in the data object
        if (!error && data) {
          // Check if data indicates success
          const isSuccess = data.success === true || 
                           (data.success_count !== undefined && data.success_count > 0) ||
                           (data.processed !== undefined && data.processed > 0) ||
                           (data.processed_count !== undefined && data.processed_count > 0);
          
          if (isSuccess) {
            console.log('RPC call successful:', data);
            error = null; // Clear any error since we have success
            break;
          } else if (data.error || data.message) {
            // If data has an error message, treat it as an error
            console.warn('RPC returned error in data:', data);
            // Don't break, let it retry if it's a connection error
          } else {
            console.log('RPC call completed, checking result:', data);
            break; // Break even if success is false, let the frontend handle it
          }
        } else if (!error) {
          // No error and no data - this shouldn't happen but handle it
          console.log('RPC call completed with no error and no data');
          break;
        }
        
        // If there's an error, check if we should retry
        if (error) {
          console.log(`RPC attempt ${attempt + 1} had error:`, error);
          
          // Check if it's a connection error that we should retry
          const errorMessage = error?.message || '';
          const errorCode = (error as any)?.code;
          const isConnectionError = 
            errorMessage.includes('CONNECTION_REFUSED') ||
            errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('NetworkError') ||
            errorMessage.includes('network') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorCode === 'ECONNREFUSED';
          
          if (isConnectionError && attempt < maxRetries - 1) {
            // Exponential backoff: wait 1s, 2s, 4s
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`Database connection error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // If not a connection error or final attempt, break
        break;
      } catch (fetchError: any) {
        lastError = fetchError;
        
        // Check if it's a connection error
        const isConnectionError = 
          fetchError.message?.includes('CONNECTION_REFUSED') ||
          fetchError.message?.includes('Failed to fetch') ||
          fetchError.message?.includes('NetworkError') ||
          fetchError.message?.includes('network') ||
          fetchError.message?.includes('ECONNREFUSED');
        
        if (isConnectionError && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`Network error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Re-throw if not connection error or final attempt
        throw fetchError;
      }
    }
    
    // Check if we have an RPC error (network/connection error)
    if (error || lastError) {
      const finalError = error || lastError;
      console.error('RPC call error:', finalError);
      
      // If we have data despite the error, check if it indicates success
      if (data && typeof data === 'object') {
        const isSuccess = data.success === true || 
                         (data.success_count !== undefined && data.success_count > 0) ||
                         (data.processed !== undefined && data.processed > 0) ||
                         (data.processed_count !== undefined && data.processed_count > 0);
        
        if (isSuccess) {
          // We have success in the data, ignore the RPC error
          console.log('RPC response indicates success despite error object:', data);
          error = null;
          lastError = null;
        } else {
          // Log the full error response
          console.error('Error response data:', {
            success: data.success,
            error: data.error,
            message: data.message,
            debug_log: data.debug_log,
            auth_info: data.auth_info,
            detailed_errors: data.detailed_errors
          });
        }
      }
      
      // If we still have an error after checking data, throw it
      if (error || lastError) {
        const finalError = error || lastError;
        
        // Safely extract error message - handle null/undefined errors
        const errorMessage = finalError?.message || (finalError as any)?.toString() || 'Unknown error';
        const errorHint = (finalError as any)?.hint;
        const errorCode = (finalError as any)?.code;
        const errorDetails = (finalError as any)?.details;
        
        // More detailed error info
        const errorDetailsObj = {
          message: errorMessage,
          hint: errorHint,
          code: errorCode,
          details: errorDetails,
          responseData: data
        };
        console.error('Error details:', errorDetailsObj);
        
        // Check if error is in the response data
        let userErrorMessage = errorMessage;
        if (data && typeof data === 'object') {
          if (data.error && typeof data.error === 'string') {
            userErrorMessage = data.error;
          } else if (data.message && typeof data.message === 'string') {
            userErrorMessage = data.message;
          }
        }
        
        // Provide a more user-friendly error message
        let userMessage = 'Failed to process trades. ';
        if (userErrorMessage) {
          if (userErrorMessage.includes('User ID mismatch') || userErrorMessage.includes('not authenticated')) {
            userMessage += 'Authentication error. Please refresh the page and try again. If you are a developer, ensure your developer status is properly set in the database.';
          } else if (userErrorMessage.includes('CONNECTION_REFUSED') || 
              userErrorMessage.includes('Failed to fetch') ||
              userErrorMessage.includes('ECONNREFUSED')) {
            userMessage += 'Cannot connect to the database. Please check your internet connection and try again. If the problem persists, the database may be temporarily unavailable.';
          } else if (userErrorMessage.includes('constraint') || userErrorMessage.includes('violates')) {
            userMessage += 'There was a data validation error. Please check your CSV format.';
          } else if (userErrorMessage.includes('null value') || userErrorMessage.includes('NOT NULL')) {
            userMessage += 'Some required fields are missing. Please check your CSV has all required columns.';
          } else if (userErrorMessage.includes('invalid input') || userErrorMessage.includes('syntax')) {
            userMessage += 'The CSV format appears to be invalid. Please verify your file format.';
          } else {
            userMessage += userErrorMessage;
          }
        } else {
          userMessage += 'Please try again or contact support if the issue persists.';
        }
        
        throw new Error(userMessage);
      }
    }
    
    // Check if data indicates failure even without RPC error
    if (data && typeof data === 'object') {
      const isSuccess = data.success === true || 
                       (data.success_count !== undefined && data.success_count > 0) ||
                       (data.processed !== undefined && data.processed > 0) ||
                       (data.processed_count !== undefined && data.processed_count > 0);
      
      if (!isSuccess && (data.error || data.message)) {
        // Database function returned an error
        const errorMessage = data.error || data.message || 'Failed to process trades';
        console.error('Database function returned error:', {
          success: data.success,
          error: data.error,
          message: data.message,
          processed: data.processed,
          success_count: data.success_count,
          error_count: data.error_count,
          debug_log: data.debug_log
        });
        
        // Don't throw here - return the data so frontend can handle it
        // The frontend will check result.success and show appropriate message
      }
    }
    
    console.log('RPC response:', data);
    
    // Add any preprocessing errors to the result
    if (errors.length > 0) {
      if (data) {
        data.preprocess_errors = errors;
      }
    }
    
    // Add warning logs to the result
    if (warningLogs.length > 0) {
      if (data) {
        data.warnings = warningLogs;
      }
    }
    
    return data;
  } catch (err) {
    console.error('Exception in RPC call:', err);
    // Provide a user-friendly error message
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Failed to upload trades: ${errorMessage}. Please try again or contact support.`);
  }
} 