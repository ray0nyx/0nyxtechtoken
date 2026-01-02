import { createClient } from '@/lib/supabase/client';

export interface TradeData {
  entry_date: string;
  exit_date: string;
  date: string;
  pnl: number;
}

export interface DayPnL {
  date: string;
  pnl: number;
}

// Helper function to format a date to YYYY-MM-DD using UTC (for database consistency)
export function formatDateToLocalISOString(date: Date): string {
  // Use UTC methods to match how dates are stored/parsed from the database
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

// Helper function to get today's date string in local timezone (for Today's PnL)
export function getLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Helper function to check if a trade date matches a target date
export function isTradeDateMatch(trade: TradeData, targetDate: string): boolean {
  const tradeDate = trade.date || trade.entry_date || trade.exit_date;
  if (!tradeDate) return false;

  const tradeDateObj = new Date(tradeDate);
  const tradeDateStr = formatDateToLocalISOString(tradeDateObj);

  // Also try parsing the date string directly if it's already in YYYY-MM-DD format
  const directMatch = tradeDate === targetDate;

  console.log('isTradeDateMatch: Comparing dates:', {
    tradeDate,
    tradeDateStr,
    targetDate,
    directMatch,
    formattedMatch: tradeDateStr === targetDate
  });

  return directMatch || tradeDateStr === targetDate;
}

// Fetch all trades for a user
export async function fetchUserTrades(): Promise<TradeData[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('No authenticated user');
  }

  const { data: trades, error } = await supabase
    .from('trades')
    .select('entry_date, exit_date, date, pnl')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return trades || [];
}

// Get today's P&L data
export async function getTodayPnL(): Promise<{ trades: TradeData[]; totalPnL: number }> {
  const trades = await fetchUserTrades();
  const today = new Date();
  // Use local date string for "today" to match user's current day
  const todayStr = getLocalDateString(today);

  console.log('getTodayPnL: Looking for trades on:', todayStr);
  console.log('getTodayPnL: All trades:', trades);

  const todayTrades = trades.filter(trade => {
    const tradeDate = trade.date || trade.entry_date || trade.exit_date;
    if (!tradeDate) return false;

    // Extract just the date part (YYYY-MM-DD) from the trade date string
    // This handles both "2026-01-01" and "2026-01-01T12:00:00Z" formats
    const tradeDatePart = tradeDate.split('T')[0];
    const isMatch = tradeDatePart === todayStr;

    console.log('getTodayPnL: Trade date check:', {
      tradeDate,
      tradeDatePart,
      todayStr,
      isMatch,
      pnl: trade.pnl
    });
    return isMatch;
  });

  // If no trades found with exact date matching, try a more flexible approach
  let finalTrades = todayTrades;
  if (todayTrades.length === 0) {
    console.log('getTodayPnL: No exact matches found, trying flexible date matching...');

    // Try to find trades that are within today's date range
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    finalTrades = trades.filter(trade => {
      const tradeDate = trade.date || trade.entry_date || trade.exit_date;
      if (!tradeDate) return false;

      const tradeDateObj = new Date(tradeDate);
      const isToday = tradeDateObj >= todayStart && tradeDateObj < todayEnd;

      console.log('getTodayPnL: Flexible date check:', {
        tradeDate,
        tradeDateObj: tradeDateObj.toISOString(),
        todayStart: todayStart.toISOString(),
        todayEnd: todayEnd.toISOString(),
        isToday,
        pnl: trade.pnl
      });

      return isToday;
    });
  }

  const totalPnL = finalTrades.reduce((sum, trade) => sum + parseFloat(trade.pnl?.toString() || '0'), 0);

  console.log('getTodayPnL: Found trades:', finalTrades.length, 'Total P&L:', totalPnL);

  return { trades: finalTrades, totalPnL };
}

// Get P&L data for a specific date range
export async function getDateRangePnL(startDate: Date, endDate: Date): Promise<DayPnL[]> {
  const trades = await fetchUserTrades();
  const pnlByDate: { [key: string]: number } = {};

  // Process all trades and group by date
  trades.forEach(trade => {
    const tradeDate = trade.date || trade.entry_date || trade.exit_date;
    if (!tradeDate) return;

    const tradeDateObj = new Date(tradeDate);
    const dateStr = formatDateToLocalISOString(tradeDateObj);

    // Check if the date is within our range (using UTC date comparison)
    const tradeDateOnly = new Date(Date.UTC(tradeDateObj.getUTCFullYear(), tradeDateObj.getUTCMonth(), tradeDateObj.getUTCDate()));
    const startDateOnly = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const endDateOnly = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    if (tradeDateOnly >= startDateOnly && tradeDateOnly <= endDateOnly) {
      pnlByDate[dateStr] = (pnlByDate[dateStr] || 0) + parseFloat(trade.pnl?.toString() || '0');
    }
  });

  // Convert to array
  return Object.entries(pnlByDate).map(([date, pnl]) => ({ date, pnl }));
}

// Get P&L data for a specific month
export async function getMonthPnL(year: number, month: number): Promise<DayPnL[]> {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // Last day of the month

  console.log('getMonthPnL: Fetching data for month:', year, month, 'from', startDate, 'to', endDate);

  const result = await getDateRangePnL(startDate, endDate);
  console.log('getMonthPnL: Result:', result);

  return result;
}
