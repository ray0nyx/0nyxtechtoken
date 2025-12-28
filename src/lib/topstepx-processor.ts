import Papa from 'papaparse';
import { supabase } from './supabase';
import { processTopstepXBatch } from './topstepx-utils';

// Define the expected format from the TopstepX CSV
interface TopstepXTrade {
  // Core required fields with various possible naming conventions
  symbol?: string;                // Contract name in CSV
  Symbol?: string;                // Alternate format
  ContractName?: string;          // Alternate format
  contract_name?: string;         // Alternate format
  
  // Entry time fields
  EnteredAt?: string;             // Entry time
  EntryTime?: string;             // Alternate format
  entered_at?: string;            // Alternate format
  entry_time?: string;            // Alternate format
  
  // Exit time fields  
  ExitedAt?: string;              // Exit time
  ExitTime?: string;              // Alternate format
  exited_at?: string;             // Alternate format
  exit_time?: string;             // Alternate format
  
  // Price fields
  EntryPrice?: string;            // Entry price
  entry_price?: string;           // Alternate format
  Entry?: string;                 // Alternate format
  
  ExitPrice?: string;             // Exit price
  exit_price?: string;            // Alternate format
  Exit?: string;                  // Alternate format
  
  // Fee fields
  Fees?: string;                  // Fees
  fees?: string;                  // Alternate format
  Commission?: string;            // Alternate format
  commission?: string;            // Alternate format
  
  // P&L fields
  PnL?: string;                   // Profit/Loss
  pnl?: string;                   // Alternate format
  Profit?: string;                // Alternate format
  profit?: string;                // Alternate format
  P_L?: string;                   // Alternate format
  
  // Size/quantity fields
  Size?: string;                  // Position size
  size?: string;                  // Alternate format
  Quantity?: string;              // Alternate format
  quantity?: string;              // Alternate format
  Qty?: string;                   // Alternate format
  qty?: string;                   // Alternate format
  
  // Position/type fields
  Type?: string;                  // Long/Short
  type?: string;                  // Alternate format
  Direction?: string;             // Alternate format
  direction?: string;             // Alternate format
  Position?: string;              // Alternate format
  position?: string;              // Alternate format
  
  // Date fields
  TradeDay?: string;              // Date of trade
  trade_day?: string;             // Alternate format
  Date?: string;                  // Alternate format
  date?: string;                  // Alternate format
  
  // Duration fields
  TradeDuration?: string;         // Duration in seconds
  trade_duration?: string;        // Alternate format
  Duration?: string;              // Alternate format
  duration?: string;              // Alternate format
  
  // Additional fields that might be in the CSV
  boughtTimestampSoldTimestampDuration?: string;
  selfFillid?: string;
  qtypbuyPrice?: string;
  sellPrice?: string;
  _priceFormat?: string;
  _priceFormatType?: string;
  _tickSizebyFillId?: string;
  
  [key: string]: string | undefined; // Allow any other fields
}

/**
 * Process a TopstepX CSV file and store the trades
 * @param file The CSV file to process
 * @param userId The ID of the user uploading the file
 * @param accountId The ID of the account to associate with the trades
 * @returns A promise that resolves to the number of trades processed
 */
export async function processTopstepXCSV(
  file: File,
  userId: string,
  accountId: string
): Promise<{ tradesProcessed: number; dailySummaries: any[] }> {
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

      // Use FileReader to read the file content as text first
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          if (!event.target || typeof event.target.result !== 'string') {
            reject(new Error('Failed to read file content'));
            return;
          }

          const fileContent = event.target.result;
          
          // Now parse the file with robust error handling
          try {
            Papa.parse(fileContent, {
              header: true,
              skipEmptyLines: true,
              complete: async (results) => {
                try {
                  if (results.errors && results.errors.length > 0) {
                    console.error('CSV parsing errors:', results.errors);
                    throw new Error(`CSV parsing errors: ${JSON.stringify(results.errors)}`);
                  }

                  console.log('Parsed CSV data (sample):', 
                    results.data.slice(0, 3).map(row => JSON.stringify(row)));
                  console.log(`Total rows in CSV: ${results.data.length}`);
                  
                  if (results.data.length === 0) {
                    throw new Error('No data found in CSV file');
                  }

                  // Process the batch using our utility function
                  const data = await processTopstepXBatch(results.data, userId, accountId);

                  // Improved error checking
                  if (!data) {
                    throw new Error('Server returned no data when processing trades');
                  }
                  
                  if (!data.success) {
                    throw new Error(data.error || 'Failed to process trades');
                  }
                  
                  // Check for the case where processed is 0 despite success being true
                  if (data.processed === 0) {
                    // Check if there were errors during processing
                    if (data.errors && data.errors > 0) {
                      // Extract error messages from results if available
                      const errorMessages = data.results 
                        ? data.results
                            .filter((r: any) => !r.success && r.error)
                            .map((r: any) => r.error)
                            .join('; ')
                        : 'Unknown errors occurred during processing';
                        
                      throw new Error(`Failed to process any trades. Errors: ${errorMessages}`);
                    } else {
                      throw new Error('No trades were processed. Please check your CSV format and try again.');
                    }
                  }

                  // If we got preprocessing errors, mention them in the success message
                  let preprocessErrorsMsg = '';
                  if (data.preprocess_errors && data.preprocess_errors.length > 0) {
                    preprocessErrorsMsg = ` (${data.preprocess_errors.length} rows skipped due to format issues)`;
                  }

                  console.log('Successfully processed trades:', data);
                  resolve({ 
                    tradesProcessed: data.processed || 0,
                    dailySummaries: data.daily_summaries || []
                  });
                } catch (error) {
                  console.error('Error in processTopstepXCSV:', error);
                  reject(error);
                }
              },
              error: (error) => {
                console.error('Failed to parse CSV:', error);
                reject(new Error(`Failed to parse CSV: ${error.message}`));
              }
            });
          } catch (error) {
            console.error('Error in Papa.parse:', error);
            
            // Handle the specific meta property error
            if (error instanceof Error && 
                (error.message.includes('meta') || error.message.includes('undefined'))) {
              reject(new Error('CSV parsing failed. The file might be corrupt or have an invalid format. Try resaving it with a spreadsheet application.'));
            } else {
              reject(error);
            }
          }
        } catch (error) {
          console.error('Error handling file content:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read the file'));
      };
      
      // Read the file as text
      reader.readAsText(file);
    } catch (error) {
      console.error('Unexpected error in processTopstepXCSV:', error);
      reject(error);
    }
  });
} 