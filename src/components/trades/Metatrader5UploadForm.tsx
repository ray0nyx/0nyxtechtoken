import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Metatrader5UploadFormProps {
  directUpload?: boolean;
}

interface MT5Trade {
  time: string;
  position: string;
  symbol: string;
  type: string;
  volume: number;
  price: number;
  sl: number | null;
  tp: number | null;
  closeTime: string | null;
  commission: number;
  swap: number;
  profit: number;
}

export function Metatrader5UploadForm({ directUpload = false }: Metatrader5UploadFormProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  const parseHtmlContent = (htmlContent: string): MT5Trade[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    let table: HTMLTableElement | null = null;
    let foundHeaderRow: HTMLTableRowElement | null = null;
    let foundHeaderIndex = -1;

    console.log("Starting table search...");

    // Helper function to check if a row contains trade headers
    const isTradesTableHeader = (row: Element): boolean => {
      const cells = Array.from(row.querySelectorAll('th, td')).map(cell =>
        cell.textContent?.trim().toLowerCase() || ''
      );

      // Skip rows that look like titles or metadata
      if (cells.length <= 2 ||
        cells.some(cell =>
          cell.includes('history report') ||
          cell.includes('account statement') ||
          cell.includes('name:') ||
          cell.includes('account:') ||
          cell.includes('company:') ||
          cell.includes('date:')
        )) {
        return false;
      }

      // Check for common MT5 header combinations
      const hasSymbol = cells.some(h => h.includes('symbol') || h.includes('item'));
      const hasProfit = cells.some(h => h.includes('profit') || h.includes('result'));
      const hasTime = cells.some(h => h.includes('time') || h.includes('date'));
      const hasType = cells.some(h => h.includes('type') || h.includes('action') || h.includes('direction'));
      const hasVolume = cells.some(h => h.includes('volume') || h.includes('lot') || h.includes('size'));
      const hasPrice = cells.some(h => h.includes('price') || h.includes('rate'));

      // Log header check results
      console.log('Header check for row:', {
        cells,
        hasSymbol,
        hasProfit,
        hasTime,
        hasType,
        hasVolume,
        hasPrice
      });

      // Require at least 3 key headers
      return [hasSymbol, hasProfit, hasTime, hasType, hasVolume, hasPrice]
        .filter(Boolean).length >= 3;
    };

    // Helper function to find header row in a table
    const findHeaderRowInTable = (table: HTMLTableElement): { row: HTMLTableRowElement | null, index: number } => {
      const rows = Array.from(table.querySelectorAll('tr'));
      console.log(`Checking ${rows.length} rows for headers`);

      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        console.log(`Examining row ${i}:`, row.innerText.substring(0, 100));

        if (isTradesTableHeader(row)) {
          console.log(`Found valid header row at index ${i}`);
          return { row: row as HTMLTableRowElement, index: i };
        }
      }
      return { row: null, index: -1 };
    };

    // Strategy 1: Try tables after specific section headers
    const sectionKeywords = [
      'deals', // Move 'deals' to the front since that's where the actual trade data is
      'positions', 'closed orders', 'trades', 'account history',
      'history of deals', 'closed positions', 'orders'
    ];

    const sections = Array.from(doc.querySelectorAll('div, h1, h2, h3, h4, h5, h6, p'))
      .filter(el => {
        const text = el.textContent?.trim().toLowerCase() || '';
        return sectionKeywords.some(keyword => text.includes(keyword));
      });

    console.log(`Found ${sections.length} potential section headers`);

    for (const section of sections) {
      console.log(`Checking section: "${section.textContent?.trim()}"`);

      // Look for tables after this section
      let element: Element | null = section;
      let depth = 0;
      const maxDepth = 10;

      while (element && depth < maxDepth) {
        // Check if current element is a table
        if (element instanceof HTMLTableElement) {
          console.log('Found table, checking for headers...');
          const { row, index } = findHeaderRowInTable(element);
          if (row) {
            table = element;
            foundHeaderRow = row;
            foundHeaderIndex = index;
            break;
          }
        }

        // Check for nested tables
        const nestedTables = element.querySelectorAll('table');
        if (nestedTables.length > 0) {
          console.log(`Found ${nestedTables.length} nested tables`);
          for (const nestedTable of Array.from(nestedTables)) {
            const { row, index } = findHeaderRowInTable(nestedTable as HTMLTableElement);
            if (row) {
              table = nestedTable as HTMLTableElement;
              foundHeaderRow = row;
              foundHeaderIndex = index;
              break;
            }
          }
          if (table) break;
        }

        // Move to next sibling or parent's next sibling
        let next = element.nextElementSibling;
        while (!next && element.parentElement && depth < maxDepth) {
          element = element.parentElement;
          next = element.nextElementSibling;
          depth++;
        }
        element = next;
        depth++;
      }

      if (table) break;
    }

    // Strategy 2: If no table found, try all tables in the document
    if (!table) {
      console.log("Strategy 1 failed. Trying all tables...");
      const allTables = Array.from(doc.getElementsByTagName('table'));

      for (const currentTable of allTables) {
        const { row, index } = findHeaderRowInTable(currentTable);
        if (row) {
          table = currentTable;
          foundHeaderRow = row;
          foundHeaderIndex = index;
          break;
        }
      }
    }

    if (!table || !foundHeaderRow || foundHeaderIndex === -1) {
      console.error("Failed to find trades table with valid headers");
      throw new Error(
        'Could not find the trades table in the HTML file. Please ensure you are uploading a valid MT5 Account History report. ' +
        'To generate a correct report: 1) Open MT5, 2) Go to Account History, 3) Right-click, 4) Select "Report", 5) Save as HTML'
      );
    }

    console.log("Found valid trades table and header row!");

    // Process headers and continue with existing code
    const headers = Array.from(foundHeaderRow.querySelectorAll('th, td'))
      .map(h => h.textContent?.trim().toLowerCase() || '');
    console.log("Found Headers:", headers);

    // Map column indices with expanded matching patterns for Deals table
    const colIndices = {
      time: headers.findIndex(h =>
        h.includes('time') || h.includes('when') || h.includes('date')),
      deal: headers.findIndex(h =>
        h.includes('deal') || h.includes('ticket') || h.includes('#')),
      symbol: headers.findIndex(h =>
        h.includes('symbol') || h.includes('instrument')),
      type: headers.findIndex(h =>
        h.includes('type') || h.includes('direction') || h.includes('action')),
      direction: headers.findIndex(h =>
        h.includes('direction') || h.includes('in/out')),
      volume: headers.findIndex(h =>
        h.includes('volume') || h.includes('lot') || h.includes('amount')),
      price: headers.findIndex(h =>
        h.includes('price') || h.includes('rate')),
      order: headers.findIndex(h =>
        h.includes('order')),
      commission: headers.findIndex(h =>
        h.includes('commission') || h.includes('fee')),
      fee: headers.findIndex(h =>
        h.includes('fee')),
      swap: headers.findIndex(h =>
        h.includes('swap')),
      profit: headers.findIndex(h =>
        h.includes('profit') || h.includes('result'))
    };

    console.log("Column mappings:", Object.entries(colIndices)
      .map(([key, value]) => `${key}: ${value} (${headers[value] || 'not found'})`));

    // Validate required columns are present
    const requiredCols = ['time', 'symbol', 'type', 'volume', 'price'];
    const missingCols = requiredCols.filter(col => colIndices[col as keyof typeof colIndices] === -1);

    if (missingCols.length > 0) {
      console.error('Available headers:', headers);
      console.error('Missing columns:', missingCols);
      throw new Error(
        `Missing required columns in the trades table: ${missingCols.join(', ')}. ` +
        'Found headers: ' + headers.join(', ') + '. ' +
        'Please ensure you are uploading a complete MT5 Account History report.'
      );
    }

    const trades: MT5Trade[] = [];

    // Get all rows from the table
    const allTableRows = Array.from(table.querySelectorAll('tr'));

    // Process rows after the header row
    for (let i = foundHeaderIndex + 1; i < allTableRows.length; i++) {
      const cells = Array.from(allTableRows[i].querySelectorAll('td'));

      // Log the raw row content
      console.log(`Processing row ${i}:`, {
        rowText: allTableRows[i].innerText,
        cellCount: cells.length,
        cellsHtml: cells.map(cell => cell.outerHTML).join('\n'),
        expectedCellCount: Math.max(...Object.values(colIndices).filter(i => i !== -1))
      });

      // Skip empty rows or rows with insufficient cells
      if (cells.length === 0 || !cells[0]?.textContent?.trim()) {
        console.log(`Skipping empty row ${i}`);
        continue;
      }

      const getCellValue = (idx: number) => {
        if (idx === -1) return null;
        const cell = cells[idx];
        if (!cell) return null;

        const content = cell.textContent?.trim() || '';
        // Handle colspan by checking if this cell contains the profit
        if (cell.hasAttribute('colspan') && content.includes('.')) {
          console.log(`Found colspan cell with possible profit: ${content}`);
          return content;
        }
        return content;
      };

      // Enhanced number parsing with better handling of various formats
      const parseNumber = (value: string | null) => {
        if (!value) return null;
        // Remove any currency symbols, spaces, and handle thousands separators
        const cleanValue = value.replace(/[^0-9,.-]/g, '')
          .replace(/,(?=\d{3})/g, '')  // Remove thousands separators
          .replace(',', '.');  // Convert decimal comma to point
        const num = parseFloat(cleanValue);
        console.log('Parsing number:', { original: value, cleaned: cleanValue, result: num });
        return isNaN(num) ? null : num;
      };

      // Get raw values with special handling for profit in colspan cells
      const rawProfit = cells.find(cell =>
        cell.hasAttribute('colspan') &&
        cell.textContent?.trim().match(/^-?\d+\.?\d*$/)
      )?.textContent?.trim() || getCellValue(colIndices.profit);

      const trade: MT5Trade = {
        time: getCellValue(colIndices.time) || '',
        position: getCellValue(colIndices.deal) || '',
        symbol: getCellValue(colIndices.symbol) || '',
        type: getCellValue(colIndices.type) || '',
        volume: parseNumber(getCellValue(colIndices.volume)) || 0,
        price: parseNumber(getCellValue(colIndices.price)) || 0,
        sl: null,  // Not available in deals view
        tp: null,  // Not available in deals view
        closeTime: null,  // Will be set later if needed
        commission: parseNumber(getCellValue(colIndices.commission)) || 0,
        swap: parseNumber(getCellValue(colIndices.swap)) || 0,
        profit: parseNumber(rawProfit) || 0
      };

      // Enhanced validation with better logging
      const validationResults = {
        hasTime: Boolean(trade.time),
        hasSymbol: Boolean(trade.symbol),
        hasType: Boolean(trade.type),
        hasVolume: Boolean(trade.volume),
        hasPrice: Boolean(trade.price),
        hasProfit: Boolean(trade.profit),
        rawValues: {
          time: trade.time,
          symbol: trade.symbol,
          type: trade.type,
          volume: getCellValue(colIndices.volume),
          price: getCellValue(colIndices.price),
          profit: rawProfit
        }
      };

      console.log(`Validation results for row ${i}:`, validationResults);

      // Modified validation to focus on essential fields
      if (!trade.time || !trade.profit) {
        console.warn(`Skipping invalid trade row ${i}:`, {
          trade,
          validationResults
        });
        continue;
      }

      trades.push(trade);
      console.log(`Successfully added trade from row ${i}:`, trade);
    }

    if (trades.length === 0) {
      console.error('No valid trades found. Showing first 5 rows for debugging:');
      for (let i = foundHeaderIndex + 1; i < Math.min(foundHeaderIndex + 6, allTableRows.length); i++) {
        console.log(`Row ${i} content:`, {
          text: allTableRows[i].innerText,
          html: allTableRows[i].innerHTML
        });
      }
      throw new Error('No trades found in the HTML file. Please check the console for detailed debugging information.');
    }

    return trades;
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
      const trades = parseHtmlContent(content);

      if (trades.length === 0) {
        throw new Error('No trades found in the HTML file');
      }

      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('You must be logged in to upload trades');
      }

      // Transform and upload trades to your database
      const { error } = await supabase.from('trades').insert(
        trades.map(trade => {
          // Normalize the type to handle various possible values
          const normalizedType = trade.type.toLowerCase().trim();
          let side = 'short'; // default value

          if (normalizedType.includes('buy') || normalizedType.includes('long')) {
            side = 'long';
          } else if (normalizedType.includes('sell') || normalizedType.includes('short')) {
            side = 'short';
          } else {
            console.warn(`Unexpected trade type: ${trade.type}, defaulting to 'short'`);
          }

          // Find the corresponding exit time from the Time column
          const timeStr = trade.time;
          let exitTimeStr = null;

          // Look for the next row with the same symbol and opposite direction
          const tradeIndex = trades.indexOf(trade);
          if (tradeIndex !== -1) {
            const nextTrades = trades.slice(tradeIndex + 1);
            const exitTrade = nextTrades.find(t =>
              t.symbol === trade.symbol &&
              ((normalizedType.includes('buy') && t.type.toLowerCase().includes('sell')) ||
                (normalizedType.includes('sell') && t.type.toLowerCase().includes('buy')))
            );
            if (exitTrade) {
              exitTimeStr = exitTrade.time;
            }
          }

          // Parse dates ensuring they're valid
          const entryDate = new Date(timeStr);
          const exitDate = exitTimeStr ? new Date(exitTimeStr) : null;

          // Log the date parsing
          console.log('Trade date parsing:', {
            trade: trade.position,
            symbol: trade.symbol,
            type: trade.type,
            entryTime: timeStr,
            exitTime: exitTimeStr,
            parsedEntryDate: entryDate,
            parsedExitDate: exitDate
          });

          return {
            user_id: user.id,
            symbol: trade.symbol,
            side,
            entry_date: entryDate.toISOString(),
            exit_date: exitDate?.toISOString() || null,
            entry_price: trade.price,
            exit_price: exitDate ? trades.find(t => t.time === exitTimeStr)?.price || null : null,
            size: trade.volume,
            stop_price: trade.sl,
            limit_price: trade.tp,
            commission: trade.commission,
            fees: trade.swap,
            pnl: trade.profit,
            platform: 'mt5',
            // Add extended data for debugging
            extended_data: {
              original_entry_time: timeStr,
              original_exit_time: exitTimeStr,
              original_profit: trade.profit,
              original_type: trade.type,
              normalized_type: normalizedType,
              matching_exit_trade: exitTimeStr ? {
                time: exitTimeStr,
                price: trades.find(t => t.time === exitTimeStr)?.price,
                type: trades.find(t => t.time === exitTimeStr)?.type
              } : null
            }
          };
        })
      );

      if (error) {
        console.error('Supabase insert error:', error);
        if (error.code === '42501') {
          throw new Error('Permission denied. Please make sure you are logged in and try again.');
        }
        throw error;
      }

      toast({
        title: "Upload successful",
        description: `Successfully processed ${trades.length} trades from MT5`,
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
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-blue-800">
        <h3 className="font-medium mb-2">MT5 Trade Upload</h3>
        <p>Upload your trades from MetaTrader 5's HTML export. To export your trades:</p>
        <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
          <li>Open MetaTrader 5</li>
          <li>Go to Account History</li>
          <li>Right-click and select "Report"</li>
          <li>Save the report as HTML</li>
          <li>Upload the saved HTML file here</li>
        </ol>
      </div>

      <div className="flex items-center space-x-4">
        <input
          type="file"
          accept=".html,.htm"
          onChange={handleFileChange}
          className="hidden"
          id="metatrader5-html-upload"
        />
        <Button
          onClick={() => document.getElementById('metatrader5-html-upload')?.click()}
          disabled={uploading}
          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 shadow-lg"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Processing..." : "Upload MT5 HTML Report"}
        </Button>
      </div>
    </div>
  );
} 