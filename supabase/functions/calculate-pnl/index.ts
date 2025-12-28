import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno&no-check";
import { corsHeaders } from "../_shared/cors.ts";

interface Trade {
  user_id: string;
  symbol: string;
  position: 'long' | 'short';
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  pnl: number | null;
  strategy: string | null;
  broker: string;
  notes: string | null;
  tags: string[] | null;
  fees: number | null;
}

interface CalculateMetricsResponse {
  win_rate: number;
  total_pnl: number;
  largest_win: number;
  largest_loss: number;
  average_win: number;
  average_loss: number;
  profit_factor: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
}

function calculateMetrics(trades: Trade[]): CalculateMetricsResponse {
  // Handle empty trades array
  if (!trades || !trades.length) {
    return {
      win_rate: 0,
      total_pnl: 0,
      largest_win: 0,
      largest_loss: 0,
      average_win: 0,
      average_loss: 0,
      profit_factor: 0,
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0
    };
  }

  // Filter out trades with null PnL and convert undefined to 0
  const validTrades = trades.filter((t): t is Trade & { pnl: number } => 
    t.pnl !== null && t.pnl !== undefined && isFinite(t.pnl)
  );
  
  if (!validTrades.length) {
    return {
      win_rate: 0,
      total_pnl: 0,
      largest_win: 0,
      largest_loss: 0,
      average_win: 0,
      average_loss: 0,
      profit_factor: 0,
      total_trades: trades.length, // Keep original count but show 0 for metrics
      winning_trades: 0,
      losing_trades: 0
    };
  }

  const winningTrades = validTrades.filter(t => t.pnl > 0);
  const losingTrades = validTrades.filter(t => t.pnl < 0);
  
  const totalPnL = validTrades.reduce((sum, t) => {
    const pnl = t.pnl || 0;
    return isFinite(sum + pnl) ? sum + pnl : sum;
  }, 0);
  
  // Handle cases where there might be no winning or losing trades
  const largestWin = winningTrades.length > 0 
    ? Math.max(...winningTrades.map(t => isFinite(t.pnl || 0) ? (t.pnl || 0) : 0))
    : 0;
    
  const largestLoss = losingTrades.length > 0
    ? Math.min(...losingTrades.map(t => isFinite(t.pnl || 0) ? (t.pnl || 0) : 0))
    : 0;
  
  // Calculate averages safely
  const totalWinnings = winningTrades.reduce((sum, t) => {
    const pnl = t.pnl || 0;
    return isFinite(sum + pnl) ? sum + pnl : sum;
  }, 0);
  
  const totalLosses = losingTrades.reduce((sum, t) => {
    const pnl = t.pnl || 0;
    return isFinite(sum + pnl) ? sum + pnl : sum;
  }, 0);
  
  const averageWin = winningTrades.length > 0
    ? totalWinnings / winningTrades.length
    : 0;
    
  const averageLoss = losingTrades.length > 0
    ? Math.abs(totalLosses) / losingTrades.length
    : 0;

  // Calculate gross profit and loss safely
  const grossProfit = totalWinnings;
  const grossLoss = Math.abs(totalLosses);
  
  // Calculate win rate and profit factor safely
  const winRate = validTrades.length > 0
    ? (winningTrades.length / validTrades.length) * 100
    : 0;
    
  // Avoid division by zero for profit factor
  let profitFactor = 0;
  if (grossLoss > 0 && isFinite(grossLoss) && isFinite(grossProfit)) {
    profitFactor = grossProfit / grossLoss;
  } else if (grossProfit > 0) {
    profitFactor = Number.MAX_SAFE_INTEGER; // Instead of Infinity
  }
  
  // Ensure all values are finite
  return {
    win_rate: isFinite(winRate) ? winRate : 0,
    total_pnl: isFinite(totalPnL) ? totalPnL : 0,
    largest_win: isFinite(largestWin) ? largestWin : 0,
    largest_loss: isFinite(largestLoss) ? largestLoss : 0,
    average_win: isFinite(averageWin) ? averageWin : 0,
    average_loss: isFinite(averageLoss) ? averageLoss : 0,
    profit_factor: isFinite(profitFactor) ? profitFactor : 0,
    total_trades: validTrades.length,
    winning_trades: winningTrades.length,
    losing_trades: losingTrades.length
  };
}

// Add Content-Type to all responses
const responseHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

// Handle Supabase initialization
const getSupabaseClient = async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
    throw error;
  }
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: responseHeaders
    });
  }

  try {
    // Initialize Supabase client
    const supabase = await getSupabaseClient();
    
    // Verify request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: responseHeaders }
      );
    }

    // Parse request body
    const requestData = await req.json();
    const { user_id } = requestData;
    
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: responseHeaders }
      );
    }

    // First get the query builder
    const tradesQuery = supabase.from('trades').select('*');
    
    // Then apply the filter
    const { data: trades, error: fetchError } = await tradesQuery.eq('user_id', user_id);

    if (fetchError) {
      console.error('Failed to fetch trades:', fetchError);
      return new Response(
        JSON.stringify({ error: `Failed to fetch trades: ${fetchError.message}` }),
        { status: 500, headers: responseHeaders }
      );
    }

    if (!trades || !trades.length) {
      return new Response(
        JSON.stringify({ error: 'No trades found' }),
        { status: 404, headers: responseHeaders }
      );
    }

    // Calculate metrics
    const metrics = calculateMetrics(trades as Trade[]);

    // Update analytics table
    const { error: updateError } = await supabase
      .from('user_analytics')
      .upsert({
        user_id,
        ...metrics,
        updated_at: new Date().toISOString()
      });

    if (updateError) {
      console.error('Failed to update analytics:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update analytics: ${updateError.message}` }),
        { status: 500, headers: responseHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, metrics }),
      { status: 200, headers: responseHeaders }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: err.message
      }),
      { status: 500, headers: responseHeaders }
    );
  }
});