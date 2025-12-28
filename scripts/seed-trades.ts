import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from root .env
config({ path: path.resolve(__dirname, '../.env') });

console.log('Environment variables:', {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedTrades() {
  // Sign in with existing user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ramirezrayba@gmail.com',
    password: '12102801Rr!',
  });

  if (authError) {
    console.error('Error signing in:', authError);
    return;
  }

  const userId = authData.user?.id;
  if (!userId) {
    console.error('No user ID found');
    return;
  }

  console.log('Signed in with user ID:', userId);

  const trades = Array.from({ length: 50 }, (_, i) => {
    const isWin = Math.random() > 0.3; // 70% win rate
    const entryPrice = 21500 + Math.random() * 500;
    const exitPrice = isWin ? entryPrice + Math.random() * 500 : entryPrice - Math.random() * 300;
    const netPnl = exitPrice - entryPrice;
    const now = new Date();
    const openDate = new Date(now.getTime() - (50 - i) * 3600000);
    const closeDate = new Date(openDate.getTime() + 3600000);

    return {
      user_id: userId,
      symbol: ['MNQ', 'ES', 'NQ', 'RTY', 'CL'][Math.floor(Math.random() * 5)],
      open_date: openDate.toISOString(),
      close_date: closeDate.toISOString(),
      entry_price: entryPrice,
      exit_price: exitPrice,
      net_pnl: netPnl,
      zella_insights: isWin ? 'Strong trend following setup' : 'Weak market conditions',
      zella_scale: isWin ? Math.floor(Math.random() * 50 + 50) : -Math.floor(Math.random() * 50),
    };
  });

  const { error } = await supabase.from('trades').insert(trades);
  
  if (error) {
    console.error('Error seeding trades:', error);
    return;
  }

  console.log('Successfully seeded 50 trades');
}

seedTrades().catch(console.error); 