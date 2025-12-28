import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env file if it exists
const envPath = resolve(__dirname, '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Get environment variables with fallbacks to process.env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment check:');
console.log('SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Present' : 'Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Required environment variables are missing:');
  if (!supabaseUrl) console.error('- SUPABASE_URL');
  if (!supabaseServiceKey) console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateAnalytics() {
  try {
    console.log('Starting analytics update...');
    
    // Get all trades
    const { data: trades, error: tradesError } = await supabase
      .from('trades')
      .select('*');

    if (tradesError) {
      console.error('Error fetching trades:', tradesError);
      throw tradesError;
    }

    console.log(`Processing ${trades?.length || 0} trades...`);

    // Calculate analytics per user
    const userAnalytics = trades.reduce((acc, trade) => {
      const userId = trade.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          total_trades: 0,
          winning_trades: 0,
          losing_trades: 0,
          total_pnl: 0,
          largest_win: 0,
          largest_loss: 0,
          average_win: 0,
          average_loss: 0,
          win_rate: 0,
          winning_pnl: 0,
          losing_pnl: 0,
        };
      }

      const analytics = acc[userId];
      analytics.total_trades++;
      analytics.total_pnl += trade.pnl;

      if (trade.pnl > 0) {
        analytics.winning_trades++;
        analytics.winning_pnl += trade.pnl;
        analytics.largest_win = Math.max(analytics.largest_win, trade.pnl);
      } else if (trade.pnl < 0) {
        analytics.losing_trades++;
        analytics.losing_pnl += trade.pnl;
        analytics.largest_loss = Math.min(analytics.largest_loss, trade.pnl);
      }

      return acc;
    }, {});

    console.log(`Calculating analytics for ${Object.keys(userAnalytics).length} users...`);

    // Calculate averages and win rates
    for (const userId in userAnalytics) {
      const analytics = userAnalytics[userId];
      analytics.win_rate = (analytics.winning_trades / analytics.total_trades) * 100;
      analytics.average_win = analytics.winning_trades ? analytics.winning_pnl / analytics.winning_trades : 0;
      analytics.average_loss = analytics.losing_trades ? analytics.losing_pnl / analytics.losing_trades : 0;
    }

    // Update analytics for each user
    for (const [userId, analytics] of Object.entries(userAnalytics)) {
      console.log(`Updating analytics for user ${userId}...`);
      
      const { error: updateError } = await supabase
        .from('user_analytics')
        .upsert({
          user_id: userId,
          ...analytics,
          updated_at: new Date().toISOString(),
        });

      if (updateError) {
        console.error(`Error updating analytics for user ${userId}:`, updateError);
      }
    }

    console.log('Analytics update completed successfully');
  } catch (error) {
    console.error('Error updating analytics:', error);
    process.exit(1);
  }
}

// Run the analytics update
updateAnalytics(); 