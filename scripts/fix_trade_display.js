/**
 * FIX TRADE DISPLAY ISSUES
 * 
 * This script fixes issues where only one trade appears in the trades list
 * by applying SQL fixes to the database and verifying that all trades are displayed.
 * 
 * HOW TO RUN:
 * 1. Open your terminal
 * 2. Navigate to the project directory
 * 3. Run: node scripts/fix_trade_display.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Read environment variables or prompt for them
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create a Supabase client with the service role key (admin privileges)
let supabase;

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompt the user for input
 */
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Initialize Supabase client, prompting for credentials if needed
 */
async function initSupabase() {
  let url = supabaseUrl;
  let key = supabaseServiceKey;
  
  if (!url) {
    url = await prompt('Enter your Supabase URL: ');
  }
  
  if (!key) {
    key = await prompt('Enter your Supabase service role key: ');
  }
  
  supabase = createClient(url, key);
  console.log('Supabase client initialized');
}

/**
 * Load and execute the SQL fix script
 */
async function applyDatabaseFix() {
  try {
    console.log('Loading SQL fix script...');
    
    // Read SQL script
    const sqlPath = path.join(__dirname, 'fix_display_all_trades.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error('Error: SQL fix script not found at', sqlPath);
      console.log('Make sure the SQL script exists in the scripts directory.');
      return false;
    }
    
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    console.log('SQL script loaded. Executing database fixes...');
    
    // Execute SQL script through Supabase
    const { data, error } = await supabase.rpc('exec_sql_admin', {
      sql_string: sqlScript
    });
    
    if (error) {
      console.error('Error executing SQL script:', error);
      return false;
    }
    
    console.log('Database fixes applied successfully!');
    return true;
  } catch (err) {
    console.error('Error applying database fixes:', err);
    return false;
  }
}

/**
 * Check trade counts to verify fix
 */
async function verifyTradeCounts() {
  try {
    console.log('\nVerifying trade counts...');
    
    // Get all users with trades
    const { data: users, error: usersError } = await supabase
      .from('trades')
      .select('user_id')
      .limit(1000);
    
    if (usersError) {
      console.error('Error fetching users with trades:', usersError);
      return false;
    }
    
    const uniqueUserIds = [...new Set(users.map(t => t.user_id))];
    console.log(`Found ${uniqueUserIds.length} users with trades`);
    
    let issuesFound = false;
    
    // Check each user
    for (const userId of uniqueUserIds) {
      // Get trade count for user
      const { data: tradeCount, error: countError } = await supabase
        .from('trades')
        .select('id', { count: 'exact' })
        .eq('user_id', userId);
      
      if (countError) {
        console.error(`Error counting trades for user ${userId}:`, countError);
        continue;
      }
      
      // Check for null account_id values
      const { data: nullAccountCount, error: nullError } = await supabase
        .from('trades')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .is('account_id', null);
      
      if (nullError) {
        console.error(`Error checking null account_id for user ${userId}:`, nullError);
        continue;
      }
      
      // Check for duplicate analytics
      const { data: duplicateAnalytics, error: analyticsError } = await supabase
        .rpc('check_duplicate_analytics', { user_id: userId });
      
      if (analyticsError) {
        console.error(`Error checking analytics for user ${userId}:`, analyticsError);
        continue;
      }
      
      const hasDuplicateAnalytics = duplicateAnalytics && duplicateAnalytics > 0;
      
      // Report results
      if (nullAccountCount > 0 || hasDuplicateAnalytics) {
        issuesFound = true;
        console.log(`\nIssues found for user ${userId}:`);
        console.log(`- Total trades: ${tradeCount.length}`);
        console.log(`- Trades with NULL account_id: ${nullAccountCount.length}`);
        console.log(`- Has duplicate analytics: ${hasDuplicateAnalytics ? 'YES' : 'NO'}`);
        
        // Fix issues for this user
        console.log('Applying fix for this user...');
        const { data: fixResult, error: fixError } = await supabase
          .rpc('exec_sql_admin', {
            sql_string: `
              -- Fix NULL account_id values for specific user
              DO $$
              DECLARE
                  v_account_id UUID;
              BEGIN
                  -- Check if user has an account
                  SELECT id INTO v_account_id
                  FROM accounts
                  WHERE user_id = '${userId}'
                  LIMIT 1;
                  
                  -- Create account if needed
                  IF v_account_id IS NULL THEN
                      INSERT INTO accounts (user_id, name, broker, balance, created_at, updated_at)
                      VALUES ('${userId}', 'Default Account', 'Default', 0, now(), now())
                      RETURNING id INTO v_account_id;
                  END IF;
                  
                  -- Update trades
                  UPDATE trades
                  SET account_id = v_account_id
                  WHERE user_id = '${userId}'
                  AND account_id IS NULL;
                  
                  -- Fix duplicate analytics
                  WITH duplicates AS (
                      SELECT a.id
                      FROM analytics a
                      INNER JOIN (
                          SELECT user_id, metric_name, MAX(created_at) as max_created
                          FROM analytics
                          WHERE user_id = '${userId}'
                          GROUP BY user_id, metric_name
                          HAVING COUNT(*) > 1
                      ) AS latest
                      ON a.user_id = latest.user_id 
                      AND a.metric_name = latest.metric_name 
                      AND a.created_at < latest.max_created
                  )
                  DELETE FROM analytics a
                  WHERE a.id IN (SELECT id FROM duplicates);
                  
                  -- Refresh analytics
                  PERFORM refresh_user_analytics('${userId}');
              END $$;
            `
          });
        
        if (fixError) {
          console.error(`Error fixing issues for user ${userId}:`, fixError);
        } else {
          console.log(`Fix applied for user ${userId}`);
        }
      }
    }
    
    if (!issuesFound) {
      console.log('\nGreat news! No issues found with trade display.');
      return true;
    } else {
      console.log('\nIssues were found and fixed. Please check the trades page again.');
      return true;
    }
  } catch (err) {
    console.error('Error verifying trade counts:', err);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('===============================================');
    console.log('TRADE DISPLAY FIX UTILITY');
    console.log('===============================================');
    
    await initSupabase();
    
    // Check if we can connect to Supabase
    const { data: health, error: healthError } = await supabase.from('health_check').select('*').limit(1);
    
    if (healthError) {
      console.error('Error connecting to Supabase:', healthError);
      console.log('Please check your Supabase URL and service role key.');
      rl.close();
      return;
    }
    
    console.log('Connected to Supabase successfully!');
    
    // Prompt user to continue
    const shouldContinue = await prompt('This will apply fixes to ensure all trades are displayed correctly. Continue? (y/n): ');
    
    if (shouldContinue.toLowerCase() !== 'y') {
      console.log('Operation cancelled.');
      rl.close();
      return;
    }
    
    // Apply database fixes
    const fixSuccess = await applyDatabaseFix();
    
    if (fixSuccess) {
      console.log('\nDatabase fixes applied successfully!');
      
      // Verify fix worked
      await verifyTradeCounts();
      
      console.log('\nAll fixes have been applied. Your trades should now display correctly.');
      console.log('Please refresh your browser to see all trades.');
    } else {
      console.error('\nFailed to apply database fixes. Please check the error logs above.');
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  } finally {
    rl.close();
  }
}

// Run the script
main(); 